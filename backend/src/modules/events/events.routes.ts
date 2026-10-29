import { Router, type Request } from 'express';
import { getPrismaClient } from '../../lib/prisma.js';
import { ApiError, asPublicApiError } from '../../middleware/errors.js';
import { createRequireAuth, createRequireRole } from '../../middleware/auth.js';
import type { EventsRouterDependencies } from './events.types.js';
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  patchEvent,
  patchEventStatus,
} from './events.service.js';

function assertNoBody(request: Request): void {
  if (
    request.body &&
    typeof request.body === 'object' &&
    Object.keys(request.body).length > 0
  ) {
    throw new ApiError(
      400,
      'INVALID_REQUEST',
      'Yêu cầu không được chứa nội dung.',
    );
  }
}

function assertNoQuery(request: Request): void {
  const url = new URL(request.originalUrl, 'http://unihub.invalid');
  if (url.searchParams.size > 0) {
    throw new ApiError(400, 'INVALID_QUERY', 'Tham số truy vấn không hợp lệ.');
  }
}

export function createEventsRouter(
  dependencies: EventsRouterDependencies = {},
) {
  const router = Router();
  const getClient = dependencies.getPrismaClient ?? getPrismaClient;
  const getEvaluatedAt = dependencies.getEvaluatedAt ?? (() => new Date());

  const authMiddleware = createRequireAuth({
    getPrismaClient: getClient as any,
    verifyToken: dependencies.verifyToken,
    now: dependencies.now,
  });
  const studentRoleMiddleware = createRequireRole('Student');

  router.use(authMiddleware);
  router.use(studentRoleMiddleware);

  router.get('/', async (request, response, next) => {
    try {
      assertNoBody(request);
      const result = await listEvents(
        getClient(),
        request.authUser!.userId,
        request.originalUrl,
      );
      response.json(result);
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  router.post('/', async (request, response, next) => {
    try {
      assertNoQuery(request);
      const evaluatedAt = getEvaluatedAt();
      const result = await createEvent(
        getClient(),
        request.authUser!.userId,
        request.body,
        evaluatedAt,
      );
      response.status(201).json(result);
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  router.get('/:id', async (request, response, next) => {
    try {
      assertNoBody(request);
      assertNoQuery(request);
      const result = await getEvent(
        getClient(),
        request.authUser!.userId,
        request.params.id,
      );
      response.json(result);
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  router.patch('/:id/status', async (request, response, next) => {
    try {
      assertNoQuery(request);
      const result = await patchEventStatus(
        getClient(),
        request.authUser!.userId,
        request.params.id,
        request.body,
      );
      response.json(result);
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  router.patch('/:id', async (request, response, next) => {
    try {
      assertNoQuery(request);
      const evaluatedAt = getEvaluatedAt();
      const result = await patchEvent(
        getClient(),
        request.authUser!.userId,
        request.params.id,
        request.body,
        evaluatedAt,
      );
      response.json(result);
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  router.delete('/:id', async (request, response, next) => {
    try {
      assertNoBody(request);
      assertNoQuery(request);
      await deleteEvent(
        getClient(),
        request.authUser!.userId,
        request.params.id,
      );
      response.status(204).end();
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  return router;
}
