import { Router } from 'express';
import { getPrismaClient } from '../../lib/prisma.js';
import {
  createRequireAuth,
  requireRole,
  type AuthMiddlewareDependencies,
} from '../../middleware/auth.js';
import { ApiError, asPublicApiError } from '../../middleware/errors.js';
import {
  getProfile,
  putProfile,
  validateProfile,
  type ProfileClient,
} from './profile.service.js';

export interface ProfileRouterDependencies {
  getPrismaClient?: () => ProfileClient;
  auth?: AuthMiddlewareDependencies;
}
export function createProfileRouter(
  dependencies: ProfileRouterDependencies = {},
) {
  const router = Router();
  const getClient = dependencies.getPrismaClient ?? getPrismaClient;
  router.use(createRequireAuth(dependencies.auth), requireRole('Student'));
  router.get('/', async (request, response, next) => {
    try {
      if (
        new URL(request.originalUrl, 'http://unihub.invalid').searchParams
          .size ||
        request.body !== undefined ||
        Number(request.get('content-length') ?? 0) > 0 ||
        request.get('transfer-encoding') !== undefined
      )
        throw new ApiError(
          400,
          'INVALID_REQUEST',
          'API hồ sơ không nhận query hoặc body.',
        );
      response.json(await getProfile(getClient(), request.authUser!.userId));
    } catch (error) {
      next(asPublicApiError(error));
    }
  });
  router.put('/', async (request, response, next) => {
    try {
      if (
        new URL(request.originalUrl, 'http://unihub.invalid').searchParams.size
      )
        throw new ApiError(
          400,
          'INVALID_REQUEST',
          'API hồ sơ không nhận query.',
        );
      response.json(
        await putProfile(
          getClient(),
          request.authUser!.userId,
          validateProfile(request.body),
        ),
      );
    } catch (error) {
      next(asPublicApiError(error));
    }
  });
  return router;
}
