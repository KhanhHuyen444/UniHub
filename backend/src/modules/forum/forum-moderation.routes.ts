import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import {
  createRequireAuth,
  createRequireRole,
  type AuthMiddlewareDependencies,
} from '../../middleware/auth.js';
import { ApiError, asPublicApiError } from '../../middleware/errors.js';
import { getPrismaClient } from '../../lib/prisma.js';
import {
  listModerationQueue,
  removeForumComment,
  removeForumPost,
} from './forum-moderation.service.js';

export interface ForumModerationRouterDependencies {
  getPrismaClient?: () => PrismaClient;
  auth?: AuthMiddlewareDependencies;
  now?: () => Date;
}

function validateNoQuery(originalUrl: string): void {
  const params = new URL(originalUrl, 'http://unihub.invalid').searchParams;
  if ([...params.keys()].length > 0) {
    throw new ApiError(400, 'INVALID_QUERY', 'Tham số truy vấn không hợp lệ.');
  }
}

function validateNoBody(body: unknown): void {
  if (body !== undefined) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Yêu cầu không nhận body.');
  }
}

export function createForumModerationRouter(
  dependencies: ForumModerationRouterDependencies = {},
) {
  const router = Router();
  const getClient = dependencies.getPrismaClient ?? getPrismaClient;
  const requireAuth = createRequireAuth({
    ...dependencies.auth,
    getPrismaClient: getClient,
  });
  const requireAdmin = createRequireRole('Admin');
  const middleware = [requireAuth, requireAdmin];
  const now = dependencies.now ?? (() => new Date());

  router.get('/', ...middleware, async (request, response, next) => {
    try {
      validateNoBody(request.body);
      response.json(
        await listModerationQueue(getClient(), request.originalUrl),
      );
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  router.post(
    '/posts/:id/remove',
    ...middleware,
    async (request, response, next) => {
      try {
        validateNoQuery(request.originalUrl);
        response.json(
          await removeForumPost(
            getClient(),
            String(request.params.id),
            request.authUser!.userId,
            request.body as unknown,
            now,
          ),
        );
      } catch (error) {
        next(asPublicApiError(error));
      }
    },
  );

  router.post(
    '/comments/:id/remove',
    ...middleware,
    async (request, response, next) => {
      try {
        validateNoQuery(request.originalUrl);
        response.json(
          await removeForumComment(
            getClient(),
            String(request.params.id),
            request.authUser!.userId,
            request.body as unknown,
            now,
          ),
        );
      } catch (error) {
        next(asPublicApiError(error));
      }
    },
  );

  return router;
}
