import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const ACCESS_TOKEN_ALGORITHM = 'HS256' as const;

export type AuthRole = 'Student' | 'Admin';

export interface AuthIdentity {
  userId: number;
  role: AuthRole;
  sessionId: string;
}

export interface VerifiedAuthIdentity extends AuthIdentity {
  issuedAt: number;
  expiresAt: number;
}

export interface JwtConfiguration {
  signingSecret: string;
  issuer: string;
  audience: string;
}

export class InvalidAccessTokenError extends Error {
  constructor() {
    super('Invalid access token.');
    this.name = 'InvalidAccessTokenError';
  }
}

export class InvalidJwtConfigurationError extends Error {
  constructor() {
    super('JWT configuration is unavailable or invalid.');
    this.name = 'InvalidJwtConfigurationError';
  }
}

function readConfiguration(): JwtConfiguration {
  return {
    signingSecret: process.env.JWT_SIGNING_SECRET ?? '',
    issuer: process.env.JWT_ISSUER ?? '',
    audience: process.env.JWT_AUDIENCE ?? '',
  };
}

function getKey(configuration: JwtConfiguration): Uint8Array {
  const signingSecret = configuration.signingSecret;
  if (
    !signingSecret.trim() ||
    signingSecret.trim() ===
      'replace-with-a-random-secret-of-at-least-32-bytes' ||
    new TextEncoder().encode(signingSecret).byteLength < 32 ||
    !configuration.issuer.trim() ||
    !configuration.audience.trim()
  ) {
    throw new InvalidJwtConfigurationError();
  }

  return new TextEncoder().encode(signingSecret);
}

export function assertAccessTokenConfiguration(): void {
  getKey(readConfiguration());
}

function isRole(value: unknown): value is AuthRole {
  return value === 'Student' || value === 'Admin';
}

function parseIdentity(
  payload: JWTPayload,
  currentTime: Date,
): VerifiedAuthIdentity {
  const { sub, role, sid, iat, exp } = payload;
  if (
    typeof sub !== 'string' ||
    !/^[1-9]\d*$/.test(sub) ||
    !Number.isSafeInteger(Number(sub)) ||
    !isRole(role) ||
    typeof sid !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      sid,
    ) ||
    typeof iat !== 'number' ||
    !Number.isInteger(iat) ||
    typeof exp !== 'number' ||
    !Number.isInteger(exp) ||
    exp <= iat ||
    iat > Math.floor(currentTime.getTime() / 1000) ||
    exp - iat > ACCESS_TOKEN_TTL_SECONDS
  ) {
    throw new InvalidAccessTokenError();
  }

  return {
    userId: Number(sub),
    role,
    sessionId: sid,
    issuedAt: iat,
    expiresAt: exp,
  };
}

export function createAccessTokenService(
  configuration: JwtConfiguration,
  now: () => Date = () => new Date(),
) {
  const key = getKey(configuration);

  return {
    async sign(identity: AuthIdentity): Promise<string> {
      if (
        !Number.isSafeInteger(identity.userId) ||
        identity.userId <= 0 ||
        !isRole(identity.role) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          identity.sessionId,
        )
      ) {
        throw new TypeError('Invalid access-token identity.');
      }

      const issuedAt = Math.floor(now().getTime() / 1000);
      return new SignJWT({ role: identity.role, sid: identity.sessionId })
        .setProtectedHeader({ alg: ACCESS_TOKEN_ALGORITHM, typ: 'JWT' })
        .setIssuer(configuration.issuer)
        .setAudience(configuration.audience)
        .setSubject(String(identity.userId))
        .setIssuedAt(issuedAt)
        .setExpirationTime(issuedAt + ACCESS_TOKEN_TTL_SECONDS)
        .sign(key);
    },

    async verify(token: string): Promise<VerifiedAuthIdentity> {
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: [ACCESS_TOKEN_ALGORITHM],
          issuer: configuration.issuer,
          audience: configuration.audience,
          currentDate: now(),
          requiredClaims: ['iss', 'aud', 'sub', 'iat', 'exp'],
        });
        return parseIdentity(payload, now());
      } catch {
        throw new InvalidAccessTokenError();
      }
    },
  };
}

export async function signAccessToken(identity: AuthIdentity): Promise<string> {
  return createAccessTokenService(readConfiguration()).sign(identity);
}

export async function verifyAccessToken(
  token: string,
): Promise<VerifiedAuthIdentity> {
  return createAccessTokenService(readConfiguration()).verify(token);
}
