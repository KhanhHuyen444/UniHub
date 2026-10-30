import { Router, type Request } from 'express';
import { getPrismaClient } from '../../lib/prisma.js';
import {
  createRequireAuth,
  createRequireRole,
  type AuthMiddlewareDependencies,
} from '../../middleware/auth.js';
import { ApiError, asPublicApiError } from '../../middleware/errors.js';
import {
  getAccountMetric,
  getOpportunityMetric,
  getForumMetric,
} from './dashboard.service.js';

export interface DashboardRouterDependencies
  extends AuthMiddlewareDependencies {
  getEvaluatedAt?: () => Date;
}

function validateRequest(request: Request): void {
  if (new URL(request.originalUrl, 'http://unihub.invalid').searchParams.size)
    throw new ApiError(400, 'INVALID_QUERY', 'Tham số truy vấn không hợp lệ.');
  const length = request.get('content-length');
  if (
    (length !== undefined && length !== '0') ||
    request.get('transfer-encoding') !== undefined ||
    (length !== '0' && request.body !== undefined && request.body !== null)
  )
    throw new ApiError(
      400,
      'INVALID_REQUEST',
      'Yêu cầu không được chứa nội dung.',
    );
}

export function createDashboardRouter(
  dependencies: DashboardRouterDependencies = {},
) {
  const router = Router();
  const getClient = dependencies.getPrismaClient ?? getPrismaClient;
  const getEvaluatedAt = dependencies.getEvaluatedAt ?? (() => new Date());
  router.use(createRequireAuth(dependencies), createRequireRole('Admin'));
  for (const [path, metric] of [
    ['/accounts', getAccountMetric],
    ['/opportunities', getOpportunityMetric],
    ['/forum', getForumMetric],
  ] as const) {
    router.get(path, async (request, response, next) => {
      try {
        validateRequest(request);
        const evaluatedAt = getEvaluatedAt();
        response.json(await metric(getClient(), evaluatedAt));
      } catch (error) {
        next(asPublicApiError(error));
      }
    });
  }
  return router;
}
