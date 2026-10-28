import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { timingSafeEqual } from 'node:crypto';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { Router, type Request } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { getPrismaClient } from '../../lib/prisma.js';
import { ApiError, asPublicApiError } from '../../middleware/errors.js';
import { createRequireAuth } from '../../middleware/auth.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  assertAccessTokenConfiguration,
  InvalidJwtConfigurationError,
  signAccessToken,
  type AuthRole,
  type VerifiedAuthIdentity,
  verifyAccessToken as verifyAccessTokenDefault,
} from './access-token.js';

export const REFRESH_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const REFRESH_COOKIE_NAME = 'unihub_refresh';
const GOOGLE_ISSUERS = new Set([
  'accounts.google.com',
  'https://accounts.google.com',
]);
const GOOGLE_CLIENT_ID_PATTERN =
  /^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/;

export interface GoogleAuthConfiguration {
  googleClientId: string;
  allowedOrigins: string[];
}

export interface GoogleAuthDependencies {
  getPrismaClient?: () => PrismaClient;
  getConfiguration?: () => GoogleAuthConfiguration;
  getAllowedOrigins?: () => string[];
  verifyGoogleIdToken?: (
    idToken: string,
    audience: string,
  ) => Promise<TokenPayload>;
  validateAccessTokenConfiguration?: () => void;
  signAccessToken?: typeof signAccessToken;
  verifyAccessToken?: (token: string) => Promise<VerifiedAuthIdentity>;
  now?: () => Date;
  createSessionId?: () => string;
  createRefreshSecret?: () => string;
}

class AuthConfigurationError extends Error {
  constructor() {
    super('Google authentication configuration is unavailable or invalid.');
    this.name = 'AuthConfigurationError';
  }
}

function validateConfiguration(configuration: GoogleAuthConfiguration): void {
  if (
    !GOOGLE_CLIENT_ID_PATTERN.test(configuration.googleClientId) ||
    configuration.googleClientId.startsWith('replace-with-') ||
    !configuration.allowedOrigins.length ||
    configuration.allowedOrigins.some((origin) => !isCanonicalOrigin(origin))
  ) {
    throw new AuthConfigurationError();
  }
}

function readConfiguration(): GoogleAuthConfiguration {
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? '';
  const allowedOrigins = readAllowedOrigins();

  const configuration = { googleClientId, allowedOrigins };
  validateConfiguration(configuration);
  return configuration;
}

function readAllowedOrigins(): string[] {
  const configuredOrigins = process.env.AUTH_ALLOWED_ORIGINS ?? '';
  const allowedOrigins = configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (
    !allowedOrigins.length ||
    allowedOrigins.some((origin) => !isCanonicalOrigin(origin))
  ) {
    throw new AuthConfigurationError();
  }
  return allowedOrigins;
}

function isCanonicalOrigin(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      parsed.origin === value &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

const googleOAuthClient = new OAuth2Client();

async function verifyGoogleIdToken(
  idToken: string,
  audience: string,
): Promise<TokenPayload> {
  const ticket = await googleOAuthClient.verifyIdToken({ idToken, audience });
  const payload = ticket.getPayload();
  if (!payload) throw new Error('Missing verified Google ID token payload.');
  return payload;
}

function invalidRequest(): ApiError {
  return new ApiError(
    400,
    'INVALID_REQUEST',
    'Yêu cầu đăng nhập không hợp lệ.',
  );
}

function unauthorized(): ApiError {
  return new ApiError(401, 'UNAUTHORIZED', 'Thông tin phiên không hợp lệ.');
}

function forbiddenOrigin(): ApiError {
  return new ApiError(403, 'FORBIDDEN', 'Nguồn gửi yêu cầu không được phép.');
}

function hasRequestBody(request: Request): boolean {
  const contentLength = request.get('content-length');
  if (contentLength !== undefined) return Number(contentLength) > 0;
  return request.get('transfer-encoding') !== undefined;
}

function validateCookieRequest(
  request: Request,
  allowedOrigins: string[],
): ApiError | undefined {
  const origin = request.get('origin');
  const fetchSite = request.get('sec-fetch-site');
  if (
    !origin ||
    !allowedOrigins.includes(origin) ||
    (fetchSite !== undefined && fetchSite !== 'same-origin')
  ) {
    return forbiddenOrigin();
  }
  if (
    !/^application\/json(?:\s*;|$)/i.test(request.get('content-type') ?? '') ||
    hasRequestBody(request) ||
    Object.keys(request.query).length > 0
  ) {
    return invalidRequest();
  }
  return undefined;
}

const UUID_PATTERN =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const REFRESH_COOKIE_VALUE_PATTERN = new RegExp(
  `^(${UUID_PATTERN})\\.([A-Za-z0-9_-]{43})$`,
  'i',
);

interface RefreshCredential {
  sessionId: string;
  secret: string;
}

function parseRefreshCookie(request: Request): RefreshCredential | undefined {
  const cookieHeader = request.get('cookie');
  if (!cookieHeader) return undefined;
  const matchingCookies = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${REFRESH_COOKIE_NAME}=`));
  if (matchingCookies.length !== 1) return undefined;
  const value = matchingCookies[0].slice(REFRESH_COOKIE_NAME.length + 1);
  const match = REFRESH_COOKIE_VALUE_PATTERN.exec(value);
  if (!match) return undefined;
  return { sessionId: match[1], secret: match[2] };
}

function hashesMatch(actual: unknown, expected: string): boolean {
  if (typeof actual !== 'string' || !/^[0-9a-f]{64}$/i.test(actual)) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(actual, 'hex'),
    Buffer.from(expected, 'hex'),
  );
}

function clearRefreshCookie(response: import('express').Response): void {
  response.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/api/auth',
  });
}

function invalidGoogleToken(): ApiError {
  return new ApiError(
    401,
    'GOOGLE_TOKEN_INVALID',
    'Không thể xác minh thông tin đăng nhập Google.',
  );
}

function isGoogleVerificationUnavailable(error: unknown): boolean {
  const pending = [error];
  const seen = new Set<unknown>();
  const networkCodes = new Set([
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'EAI_AGAIN',
    'ENOTFOUND',
  ]);

  while (pending.length) {
    const current = pending.pop();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);

    const candidate = current as {
      code?: unknown;
      status?: unknown;
      response?: { status?: unknown };
      cause?: unknown;
    };
    if (
      (typeof candidate.code === 'string' &&
        networkCodes.has(candidate.code)) ||
      (typeof candidate.status === 'number' && candidate.status >= 500) ||
      (typeof candidate.response?.status === 'number' &&
        candidate.response.status >= 500)
    ) {
      return true;
    }
    pending.push(candidate.cause);
  }

  return false;
}

function accountLinkRequired(): ApiError {
  return new ApiError(
    409,
    'ACCOUNT_LINK_REQUIRED',
    'Tài khoản Google cần được liên kết với hồ sơ hiện có.',
  );
}

function validateGooglePayload(
  payload: TokenPayload,
  googleClientId: string,
  now: Date,
): asserts payload is TokenPayload & {
  iss: string;
  aud: string;
  exp: number;
  sub: string;
  email: string;
  email_verified: true;
} {
  const email = payload.email;
  if (
    !payload.iss ||
    !GOOGLE_ISSUERS.has(payload.iss) ||
    payload.aud !== googleClientId ||
    typeof payload.exp !== 'number' ||
    !Number.isFinite(payload.exp) ||
    payload.exp <= Math.floor(now.getTime() / 1000) ||
    typeof payload.sub !== 'string' ||
    !payload.sub.trim() ||
    payload.sub.length > 255 ||
    typeof email !== 'string' ||
    email.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    payload.email_verified !== true
  ) {
    throw invalidGoogleToken();
  }
}

function isRetryableConflict(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error.code === 'P2002' || error.code === 'P2034')
  );
}

function verifiedDisplayName(payload: TokenPayload): string | undefined {
  const name = payload.name?.trim();
  return name && name.length <= 150 ? name : undefined;
}

function verifiedAvatarUrl(payload: TokenPayload): string | null {
  const picture = payload.picture;
  if (typeof picture !== 'string' || picture.length > 500) return null;
  try {
    const url = new URL(picture);
    return url.protocol === 'https:' && !url.username && !url.password
      ? picture
      : null;
  } catch {
    return null;
  }
}

export function createAuthRouter({
  getPrismaClient: getClient = getPrismaClient,
  getConfiguration = readConfiguration,
  getAllowedOrigins: getOrigins = readAllowedOrigins,
  verifyGoogleIdToken: verifyGoogle = verifyGoogleIdToken,
  validateAccessTokenConfiguration:
    validateJwt = assertAccessTokenConfiguration,
  signAccessToken: signToken = signAccessToken,
  verifyAccessToken: verifyToken = verifyAccessTokenDefault,
  now = () => new Date(),
  createSessionId = randomUUID,
  createRefreshSecret = () => randomBytes(32).toString('base64url'),
}: GoogleAuthDependencies = {}) {
  const router = Router();
  const requireAuth = createRequireAuth({
    getPrismaClient: getClient,
    verifyToken,
    now,
  });

  router.post('/google', async (request, response, next) => {
    let configuration: GoogleAuthConfiguration;
    try {
      configuration = getConfiguration();
      validateConfiguration(configuration);
      validateJwt();
    } catch (error) {
      if (
        error instanceof AuthConfigurationError ||
        error instanceof InvalidJwtConfigurationError
      ) {
        next(
          new ApiError(
            503,
            'SERVICE_UNAVAILABLE',
            'Dịch vụ xác thực hiện không sẵn sàng.',
          ),
        );
      } else {
        next(asPublicApiError(error));
      }
      return;
    }

    const origin = request.get('origin');
    if (!origin || !configuration.allowedOrigins.includes(origin)) {
      next(
        new ApiError(403, 'FORBIDDEN', 'Nguồn gửi yêu cầu không được phép.'),
      );
      return;
    }

    const body = request.body as unknown;
    if (
      !request.is('application/json') ||
      body === null ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !('idToken' in body) ||
      typeof body.idToken !== 'string' ||
      !body.idToken.trim()
    ) {
      next(invalidRequest());
      return;
    }

    let googlePayload: TokenPayload;
    try {
      googlePayload = await verifyGoogle(
        body.idToken,
        configuration.googleClientId,
      );
      validateGooglePayload(googlePayload, configuration.googleClientId, now());
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else if (isGoogleVerificationUnavailable(error)) {
        next(
          new ApiError(
            503,
            'SERVICE_UNAVAILABLE',
            'Dịch vụ xác thực hiện không sẵn sàng.',
          ),
        );
      } else {
        next(invalidGoogleToken());
      }
      return;
    }

    const sessionId = createSessionId();
    const refreshSecret = createRefreshSecret();
    const refreshTokenHash = createHash('sha256')
      .update(refreshSecret, 'utf8')
      .digest('hex');
    const sessionExpiresAt = new Date(
      now().getTime() + REFRESH_SESSION_TTL_SECONDS * 1000,
    );

    try {
      const database = getClient();
      let result;
      for (let attempt = 0; ; attempt += 1) {
        try {
          result = await database.$transaction(async (transaction) => {
            const linkedUser = await transaction.user.findUnique({
              where: { google_sub: googlePayload.sub },
            });
            const emailUser = await transaction.user.findUnique({
              where: { email: googlePayload.email },
            });

            if (
              (linkedUser &&
                emailUser &&
                linkedUser.user_id !== emailUser.user_id) ||
              (!linkedUser && emailUser)
            ) {
              throw accountLinkRequired();
            }

            const verifiedName = verifiedDisplayName(googlePayload);
            const fullName =
              verifiedName ??
              googlePayload.email.split('@', 1)[0].slice(0, 150);
            const avatarUrl = verifiedAvatarUrl(googlePayload);

            const user = linkedUser
              ? await transaction.user.update({
                  where: { user_id: linkedUser.user_id },
                  data: {
                    ...(verifiedName ? { full_name: verifiedName } : {}),
                    avatar_url: avatarUrl,
                  },
                })
              : await transaction.user.create({
                  data: {
                    google_sub: googlePayload.sub,
                    email: googlePayload.email,
                    full_name: fullName,
                    avatar_url: avatarUrl,
                    role: 'Student',
                  },
                });

            if (user.role !== 'Student' && user.role !== 'Admin') {
              throw new Error('Unexpected account role.');
            }
            const role: AuthRole = user.role;

            await transaction.authSession.create({
              data: {
                session_id: sessionId,
                user_id: user.user_id,
                refresh_token_hash: refreshTokenHash,
                expires_at: sessionExpiresAt,
              },
            });

            const accessToken = await signToken({
              userId: user.user_id,
              role,
              sessionId,
            });
            return { user, accessToken };
          });
          break;
        } catch (error) {
          if (!isRetryableConflict(error) || attempt >= 2) {
            if (
              error !== null &&
              typeof error === 'object' &&
              'code' in error &&
              error.code === 'P2002'
            ) {
              throw accountLinkRequired();
            }
            throw error;
          }
        }
      }

      response.set('Cache-Control', 'no-store');
      response.cookie(REFRESH_COOKIE_NAME, `${sessionId}.${refreshSecret}`, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/api/auth',
        maxAge: REFRESH_SESSION_TTL_SECONDS * 1000,
      });
      response.status(200).json({
        accessToken: result.accessToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        user: {
          id: result.user.user_id,
          email: result.user.email,
          fullName: result.user.full_name,
          avatarUrl: result.user.avatar_url,
          role: result.user.role,
        },
      });
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  router.post('/refresh', async (request, response, next) => {
    let allowedOrigins: string[];
    try {
      allowedOrigins = getOrigins();
      if (
        !allowedOrigins.length ||
        allowedOrigins.some((origin) => !isCanonicalOrigin(origin))
      ) {
        throw new AuthConfigurationError();
      }
      validateJwt();
    } catch (error) {
      if (
        error instanceof AuthConfigurationError ||
        error instanceof InvalidJwtConfigurationError
      ) {
        next(
          new ApiError(
            503,
            'SERVICE_UNAVAILABLE',
            'Dịch vụ xác thực hiện không sẵn sàng.',
          ),
        );
      } else {
        next(asPublicApiError(error));
      }
      return;
    }

    const requestError = validateCookieRequest(request, allowedOrigins);
    if (requestError) {
      next(requestError);
      return;
    }

    const credential = parseRefreshCookie(request);
    if (!credential) {
      clearRefreshCookie(response);
      next(unauthorized());
      return;
    }

    const oldHash = createHash('sha256')
      .update(credential.secret, 'utf8')
      .digest('hex');
    const newSecret = createRefreshSecret();
    const newHash = createHash('sha256').update(newSecret).digest('hex');
    const evaluatedAt = now();

    try {
      const result = await getClient().$transaction(async (transaction) => {
        const session = await transaction.authSession.findUnique({
          where: { session_id: credential.sessionId },
          select: {
            session_id: true,
            user_id: true,
            refresh_token_hash: true,
            expires_at: true,
            revoked_at: true,
          },
        });
        if (
          !session ||
          session.revoked_at !== null ||
          session.expires_at.getTime() <= evaluatedAt.getTime() ||
          !hashesMatch(session.refresh_token_hash, oldHash)
        ) {
          throw unauthorized();
        }

        const rotation = await transaction.authSession.updateMany({
          where: {
            session_id: credential.sessionId,
            refresh_token_hash: oldHash,
            revoked_at: null,
            expires_at: { gt: evaluatedAt },
          },
          data: { refresh_token_hash: newHash },
        });
        if (rotation.count !== 1) throw unauthorized();

        const user = await transaction.user.findUnique({
          where: { user_id: session.user_id },
          select: {
            user_id: true,
            email: true,
            full_name: true,
            avatar_url: true,
            role: true,
          },
        });
        if (!user) throw unauthorized();
        if (user.role !== 'Student' && user.role !== 'Admin') {
          throw new Error('Unexpected account role.');
        }

        const role: AuthRole = user.role;
        const accessToken = await signToken({
          userId: user.user_id,
          role,
          sessionId: credential.sessionId,
        });
        return { user, role, accessToken, expiresAt: session.expires_at };
      });

      response.set('Cache-Control', 'no-store');
      response.cookie(
        REFRESH_COOKIE_NAME,
        `${credential.sessionId}.${newSecret}`,
        {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/api/auth',
          maxAge: REFRESH_SESSION_TTL_SECONDS * 1000,
        },
      );
      response.status(200).json({
        accessToken: result.accessToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        user: {
          id: result.user.user_id,
          email: result.user.email,
          fullName: result.user.full_name,
          avatarUrl: result.user.avatar_url,
          role: result.role,
        },
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearRefreshCookie(response);
        next(error);
      } else {
        next(asPublicApiError(error));
      }
    }
  });

  router.get('/me', requireAuth, async (request, response, next) => {
    if (Object.keys(request.query).length > 0 || hasRequestBody(request)) {
      next(invalidRequest());
      return;
    }

    try {
      const identity = request.authUser;
      if (!identity) {
        next(unauthorized());
        return;
      }
      const user = await getClient().user.findUnique({
        where: { user_id: identity.userId },
        select: {
          user_id: true,
          email: true,
          full_name: true,
          avatar_url: true,
        },
      });
      if (!user) {
        next(unauthorized());
        return;
      }
      response.set('Cache-Control', 'no-store');
      response.json({
        user: {
          id: user.user_id,
          email: user.email,
          fullName: user.full_name,
          avatarUrl: user.avatar_url,
          role: identity.role,
        },
      });
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  router.post('/logout', async (request, response, next) => {
    let allowedOrigins: string[];
    try {
      allowedOrigins = getOrigins();
      if (
        !allowedOrigins.length ||
        allowedOrigins.some((origin) => !isCanonicalOrigin(origin))
      ) {
        throw new AuthConfigurationError();
      }
    } catch (error) {
      if (error instanceof AuthConfigurationError) {
        next(
          new ApiError(
            503,
            'SERVICE_UNAVAILABLE',
            'Dịch vụ xác thực hiện không sẵn sàng.',
          ),
        );
      } else {
        next(asPublicApiError(error));
      }
      return;
    }

    const requestError = validateCookieRequest(request, allowedOrigins);
    if (requestError) {
      next(requestError);
      return;
    }

    const credential = parseRefreshCookie(request);
    if (!credential) {
      clearRefreshCookie(response);
      response.status(204).end();
      return;
    }

    const refreshTokenHash = createHash('sha256')
      .update(credential.secret, 'utf8')
      .digest('hex');
    try {
      await getClient().authSession.updateMany({
        where: {
          session_id: credential.sessionId,
          refresh_token_hash: refreshTokenHash,
          revoked_at: null,
        },
        data: { revoked_at: now() },
      });
      clearRefreshCookie(response);
      response.status(204).end();
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  return router;
}
