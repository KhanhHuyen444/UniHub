import { Router } from 'express';
import { getPrismaClient } from '../../lib/prisma.js';
import {
  createRequireAuth,
  requireRole,
  type AuthMiddlewareDependencies,
} from '../../middleware/auth.js';
import { ApiError, asPublicApiError } from '../../middleware/errors.js';
import {
  listRecommendations,
  type RecommendationsReadClient,
} from './recommendations.service.js';

export interface RecommendationsRouterDependencies {
  getPrismaClient?: () => RecommendationsReadClient;
  auth?: AuthMiddlewareDependencies;
  getEvaluatedAt?: () => Date;
}

export function createRecommendationsRouter(
  dependencies: RecommendationsRouterDependencies = {},
) {
  const router = Router();
  const getClient = dependencies.getPrismaClient ?? getPrismaClient;
  const getEvaluatedAt = dependencies.getEvaluatedAt ?? (() => new Date());
  router.get(
    '/',
    (request, _response, next) => {
      if (
        new URL(request.originalUrl, 'http://unihub.invalid').searchParams
          .size ||
        request.body !== undefined ||
        request.get('transfer-encoding') !== undefined ||
        Number(request.get('content-length') ?? 0) > 0
      ) {
        next(
          new ApiError(
            400,
            'INVALID_QUERY',
            'API gợi ý không nhận query hoặc body.',
          ),
        );
        return;
      }
      next();
    },
    createRequireAuth(dependencies.auth),
    requireRole('Student'),
    async (request, response, next) => {
      try {
        response.json(
          await listRecommendations(
            getClient(),
            request.authUser!.userId,
            getEvaluatedAt(),
          ),
        );
      } catch (error) {
        next(asPublicApiError(error));
      }
    },
  );
  return router;
}
