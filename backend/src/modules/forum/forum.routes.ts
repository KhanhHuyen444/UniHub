import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { ApiError, asPublicApiError } from '../../middleware/errors.js';
import {
  createRequireAuth,
  createRequireRole,
  type AuthMiddlewareDependencies,
} from '../../middleware/auth.js';
import { getPrismaClient } from '../../lib/prisma.js';
import {
  listPublicPosts,
  getPublicPost,
  listPostComments,
  createForumPost,
  createForumComment,
  type ForumReadClient,
  type ForumWriteClient,
} from './forum.service.js';

export interface ForumRouterDependencies {
  getPrismaClient?: () => PrismaClient | ForumReadClient;
  auth?: AuthMiddlewareDependencies;
}

function validateNoQuery(originalUrl: string): void {
  const params = new URL(originalUrl, 'http://unihub.invalid').searchParams;
  if ([...params.keys()].length > 0) {
    throw new ApiError(400, 'INVALID_QUERY', 'Tham số truy vấn không hợp lệ.');
  }
}

export function createForumRouter(
  dependencies: ForumRouterDependencies = {},
): Router {
  const router = Router();
  const getClient = dependencies.getPrismaClient ?? getPrismaClient;
  const requireStudentAuth = createRequireAuth({
    ...dependencies.auth,
    getPrismaClient: getClient as () => PrismaClient,
  });
  const requireStudent = createRequireRole('Student');

  // GET /api/forum/posts
  router.get('/posts', async (request, response, next) => {
    try {
      const result = await listPublicPosts(
        getClient() as ForumReadClient,
        request.originalUrl,
      );
      response.json(result);
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  // GET /api/forum/posts/:id
  router.get('/posts/:id', async (request, response, next) => {
    try {
      validateNoQuery(request.originalUrl);
      const result = await getPublicPost(
        getClient() as ForumReadClient,
        String(request.params.id),
      );
      response.json(result);
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  // GET /api/forum/posts/:id/comments
  router.get('/posts/:id/comments', async (request, response, next) => {
    try {
      const result = await listPostComments(
        getClient() as ForumReadClient,
        request.params.id,
        request.originalUrl,
      );
      response.json(result);
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  // POST /api/forum/posts — Student only
  router.post(
    '/posts',
    requireStudentAuth,
    requireStudent,
    async (request, response, next) => {
      try {
        const result = await createForumPost(
          getClient() as ForumWriteClient,
          request.authUser!.userId,
          request.body as unknown,
        );
        response.status(201).json(result);
      } catch (error) {
        next(asPublicApiError(error));
      }
    },
  );

  // POST /api/forum/posts/:id/comments — Student only
  router.post(
    '/posts/:id/comments',
    requireStudentAuth,
    requireStudent,
    async (request, response, next) => {
      try {
        const result = await createForumComment(
          getClient() as ForumWriteClient,
          String(request.params.id),
          request.authUser!.userId,
          request.body as unknown,
        );
        response.status(201).json(result);
      } catch (error) {
        next(asPublicApiError(error));
      }
    },
  );

  return router;
}
