import type { Request, RequestHandler } from 'express';
import { ApiError, asPublicApiError } from './errors.js';
import { getPrismaClient } from '../lib/prisma.js';
import {
  InvalidJwtConfigurationError,
  type VerifiedAuthIdentity,
  verifyAccessToken,
} from '../modules/auth/access-token.js';
import type { PrismaClient } from '../generated/prisma/client.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: VerifiedAuthIdentity;
    }
  }
}

export interface AuthMiddlewareDependencies {
  getPrismaClient?: () => PrismaClient;
  verifyToken?: (token: string) => Promise<VerifiedAuthIdentity>;
  now?: () => Date;
}

function unauthorized(): ApiError {
  return new ApiError(401, 'UNAUTHORIZED', 'Yêu cầu xác thực hợp lệ.');
}

function parseBearerToken(request: Request): string | undefined {
  const authorization = request.get('authorization');
  if (!authorization) return undefined;
  const match =
    /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(
      authorization,
    );
  return match?.[1];
}

export function createRequireAuth({
  getPrismaClient: getClient = getPrismaClient,
  verifyToken = verifyAccessToken,
  now = () => new Date(),
}: AuthMiddlewareDependencies = {}): RequestHandler {
  return async (request, _response, next) => {
    const token = parseBearerToken(request);
    if (!token) {
      next(unauthorized());
      return;
    }

    let identity: VerifiedAuthIdentity;
    try {
      identity = await verifyToken(token);
    } catch (error) {
      if (error instanceof InvalidJwtConfigurationError) {
        next(
          new ApiError(
            503,
            'SERVICE_UNAVAILABLE',
            'Dịch vụ xác thực hiện không sẵn sàng.',
          ),
        );
        return;
      }
      next(unauthorized());
      return;
    }

    try {
      const session = await getClient().authSession.findUnique({
        where: { session_id: identity.sessionId },
        select: {
          session_id: true,
          user_id: true,
          expires_at: true,
          revoked_at: true,
        },
      });

      if (
        !session ||
        session.user_id !== identity.userId ||
        session.revoked_at !== null ||
        session.expires_at.getTime() <= now().getTime()
      ) {
        next(unauthorized());
        return;
      }

      request.authUser = identity;
      next();
    } catch (error) {
      next(asPublicApiError(error));
    }
  };
}

export function createRequireRole(role: 'Student' | 'Admin'): RequestHandler {
  return (request, _response, next) => {
    if (!request.authUser) {
      next(unauthorized());
      return;
    }
    if (request.authUser.role !== role) {
      next(
        new ApiError(
          403,
          'FORBIDDEN',
          'Bạn không có quyền thực hiện thao tác này.',
        ),
      );
      return;
    }
    next();
  };
}

export const requireAuth = createRequireAuth();
export const requireRole = createRequireRole;
export const requireAdmin = createRequireRole('Admin');
