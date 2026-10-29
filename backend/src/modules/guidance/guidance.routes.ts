import { Router, type RequestHandler } from 'express';
import { getPrismaClient } from '../../lib/prisma.js';
import {
  createRequireAuth,
  type AuthMiddlewareDependencies,
} from '../../middleware/auth.js';
import { ApiError, asPublicApiError } from '../../middleware/errors.js';
import {
  getPublicGuidance,
  listPublicGuidance,
  parseGuidanceId,
  parseGuidanceQuery,
  type GuidanceReadClient,
} from './guidance.service.js';

export interface GuidanceRouterDependencies {
  getPrismaClient?: () => GuidanceReadClient;
  auth?: AuthMiddlewareDependencies;
}

export function createGuidanceRouter(
  dependencies: GuidanceRouterDependencies = {},
) {
  const router = Router();
  const getClient = dependencies.getPrismaClient ?? getPrismaClient;
  const authenticate = createRequireAuth(dependencies.auth);
  // Only missing/invalid credentials are optional. Service/config errors propagate.
  const optionalAuth: RequestHandler = (request, response, next) =>
    authenticate(request, response, (error?: unknown) => {
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        error.code === 'UNAUTHORIZED'
      ) {
        delete request.authUser;
        next();
      } else next(error);
    });
  const validate: RequestHandler = (request, _response, next) => {
    try {
      if (
        request.headers['transfer-encoding'] ||
        Number(request.headers['content-length'] ?? 0) > 0
      ) {
        throw new ApiError(
          400,
          'INVALID_REQUEST',
          'Yêu cầu GET không nhận body.',
        );
      }
      if (request.params.id !== undefined) {
        parseGuidanceId(String(request.params.id), 'INVALID_ID');
        if (
          new URL(request.originalUrl, 'http://unihub.invalid').searchParams
            .size
        ) {
          throw new ApiError(
            400,
            'INVALID_QUERY',
            'Tham số truy vấn không hợp lệ.',
          );
        }
      } else parseGuidanceQuery(request.originalUrl);
      next();
    } catch (error) {
      next(error);
    }
  };
  router.get('/', validate, optionalAuth, async (request, response, next) => {
    try {
      response.json(
        await listPublicGuidance(
          getClient(),
          parseGuidanceQuery(request.originalUrl),
          request.authUser,
        ),
      );
    } catch (error) {
      next(asPublicApiError(error));
    }
  });
  router.get(
    '/:id',
    validate,
    optionalAuth,
    async (request, response, next) => {
      try {
        response.json(
          await getPublicGuidance(
            getClient(),
            parseGuidanceId(String(request.params.id), 'INVALID_ID'),
          ),
        );
      } catch (error) {
        next(asPublicApiError(error));
      }
    },
  );
  return router;
}
