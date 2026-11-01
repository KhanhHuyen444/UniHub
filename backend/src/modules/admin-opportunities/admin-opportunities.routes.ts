import { Router, type Request } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { getPrismaClient } from '../../lib/prisma.js';
import {
  createRequireAuth,
  createRequireRole,
  type AuthMiddlewareDependencies,
} from '../../middleware/auth.js';
import {
  ApiError,
  asPublicApiError,
  type ApiFieldError,
} from '../../middleware/errors.js';
import {
  approveOpportunity,
  getAdminOpportunity,
  listPendingAdminOpportunities,
  rejectOpportunity,
} from './admin-opportunities.service.js';

export interface AdminOpportunitiesRouterDependencies
  extends AuthMiddlewareDependencies {
  getPrismaClient?: () => PrismaClient;
  getEvaluatedAt?: () => Date;
}

function invalidRequest(): ApiError {
  return new ApiError(400, 'INVALID_REQUEST', 'Yêu cầu không hợp lệ.');
}

function invalidQuery(): ApiError {
  return new ApiError(400, 'INVALID_QUERY', 'Tham số truy vấn không hợp lệ.');
}

function validationError(fieldErrors: ApiFieldError[]): ApiError {
  return new ApiError(
    400,
    'VALIDATION_ERROR',
    'Dữ liệu gửi lên chưa hợp lệ.',
    fieldErrors,
  );
}

function hasBody(request: Request): boolean {
  return (
    request.body !== undefined ||
    Number(request.get('content-length') ?? 0) > 0 ||
    request.get('transfer-encoding') !== undefined
  );
}

function hasQuery(request: Request): boolean {
  return (
    new URL(request.originalUrl, 'http://unihub.invalid').searchParams.size > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

function exactBody(
  request: Request,
  expectedKey: string,
): Record<string, unknown> {
  const body = request.body;
  if (
    !isRecord(body) ||
    Object.keys(body).length !== 1 ||
    !Object.hasOwn(body, expectedKey)
  ) {
    throw invalidRequest();
  }
  return body;
}

function noQuery(request: Request): void {
  if (hasQuery(request)) throw invalidQuery();
}

function noBody(request: Request): void {
  if (hasBody(request)) throw invalidRequest();
}

function parseVerified(request: Request): boolean {
  const body = exactBody(request, 'verified');
  if (typeof body.verified !== 'boolean') {
    throw validationError([
      {
        source: 'body',
        field: 'verified',
        code: 'INVALID_BOOLEAN',
        message: 'Giá trị xác minh phải là true hoặc false.',
      },
    ]);
  }
  return body.verified;
}

function parseReason(request: Request): string {
  const body = exactBody(request, 'reason');
  if (typeof body.reason !== 'string') {
    throw validationError([
      {
        source: 'body',
        field: 'reason',
        code: 'INVALID_TYPE',
        message: 'Lý do từ chối phải là văn bản.',
      },
    ]);
  }

  const reason = body.reason.trim();
  if (!reason) {
    throw validationError([
      {
        source: 'body',
        field: 'reason',
        code: 'REQUIRED',
        message: 'Vui lòng nhập lý do từ chối.',
      },
    ]);
  }
  if (Array.from(reason).length > 500) {
    throw validationError([
      {
        source: 'body',
        field: 'reason',
        code: 'TOO_LONG',
        message: 'Lý do từ chối không được vượt quá 500 ký tự.',
      },
    ]);
  }
  return reason;
}

export function createAdminOpportunitiesRouter(
  dependencies: AdminOpportunitiesRouterDependencies = {},
) {
  const router = Router();
  const getClient = dependencies.getPrismaClient ?? getPrismaClient;
  const now = dependencies.now ?? (() => new Date());
  const getEvaluatedAt = dependencies.getEvaluatedAt ?? now;
  const requireAuth = createRequireAuth({
    ...dependencies,
    getPrismaClient: getClient,
  });

  router.use(requireAuth, createRequireRole('Admin'));

  router.get('/', async (request, response, next) => {
    try {
      noBody(request);
      const result = await listPendingAdminOpportunities(
        getClient(),
        request.originalUrl,
        getEvaluatedAt(),
      );
      response.json(result);
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  router.get('/:id', async (request, response, next) => {
    try {
      noQuery(request);
      noBody(request);
      response.json(
        await getAdminOpportunity(
          getClient(),
          request.params.id,
          getEvaluatedAt(),
        ),
      );
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  router.post('/:id/approve', async (request, response, next) => {
    try {
      noQuery(request);
      const verified = parseVerified(request);
      const authUser = request.authUser;
      if (!authUser)
        throw new ApiError(401, 'UNAUTHORIZED', 'Yêu cầu xác thực hợp lệ.');
      response.json(
        await approveOpportunity(getClient(), {
          rawId: request.params.id,
          adminId: authUser.userId,
          verified,
          now: now(),
        }),
      );
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  router.post('/:id/reject', async (request, response, next) => {
    try {
      noQuery(request);
      const reason = parseReason(request);
      const authUser = request.authUser;
      if (!authUser)
        throw new ApiError(401, 'UNAUTHORIZED', 'Yêu cầu xác thực hợp lệ.');
      response.json(
        await rejectOpportunity(getClient(), {
          rawId: request.params.id,
          adminId: authUser.userId,
          reason,
          now: now(),
        }),
      );
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  return router;
}
