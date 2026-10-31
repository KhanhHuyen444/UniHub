import { Router, type Request } from 'express';
import { getPrismaClient } from '../../lib/prisma.js';
import {
  createRequireAuth,
  createRequireRole,
  type AuthMiddlewareDependencies,
} from '../../middleware/auth.js';
import { ApiError, asPublicApiError } from '../../middleware/errors.js';
import {
  listNotifications,
  markNotificationRead,
} from './notifications.service.js';

export type NotificationsRouterDependencies = AuthMiddlewareDependencies;

function assertNoBody(request: Request) {
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

export function createNotificationsRouter(
  dependencies: NotificationsRouterDependencies = {},
) {
  const router = Router();
  const getClient = dependencies.getPrismaClient ?? getPrismaClient;
  router.use(createRequireAuth(dependencies));
  router.use(createRequireRole('Student'));
  router.get('/', async (request, response, next) => {
    try {
      assertNoBody(request);
      response.json(
        await listNotifications(
          getClient(),
          request.authUser!.userId,
          request.originalUrl,
        ),
      );
    } catch (error) {
      next(asPublicApiError(error));
    }
  });
  router.patch('/:id/read', async (request, response, next) => {
    try {
      assertNoBody(request);
      if (
        new URL(request.originalUrl, 'http://unihub.invalid').searchParams.size
      )
        throw new ApiError(
          400,
          'INVALID_QUERY',
          'Tham số truy vấn không hợp lệ.',
        );
      response.json(
        await markNotificationRead(
          getClient(),
          request.authUser!.userId,
          request.params.id,
        ),
      );
    } catch (error) {
      next(asPublicApiError(error));
    }
  });
  return router;
}
