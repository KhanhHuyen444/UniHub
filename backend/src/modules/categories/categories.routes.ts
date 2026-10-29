import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { getPrismaClient } from '../../lib/prisma.js';
import {
  createRequireAuth,
  requireRole,
  type AuthMiddlewareDependencies,
} from '../../middleware/auth.js';
import { ApiError, asPublicApiError } from '../../middleware/errors.js';
import {
  listActiveCategories,
  type CategoryOptionType,
  type CategoryReadClient,
} from './categories.service.js';

export interface CategoriesRouterDependencies {
  getPrismaClient?: () => PrismaClient | CategoryReadClient;
  auth?: AuthMiddlewareDependencies;
}

function validateCategoryQuery(originalUrl: string): CategoryOptionType {
  const params = new URL(originalUrl, 'http://unihub.invalid').searchParams;
  const entries = [...params.entries()];
  const types = params.getAll('type');

  if (
    entries.some(([key]) => key !== 'type') ||
    types.length !== 1 ||
    (types[0] !== 'Major' && types[0] !== 'Skill')
  ) {
    throw new ApiError(400, 'INVALID_QUERY', 'Tham số truy vấn không hợp lệ.');
  }

  return types[0];
}

export function createCategoriesRouter(
  dependencies: CategoriesRouterDependencies = {},
) {
  const router = Router();
  const getClient = dependencies.getPrismaClient ?? getPrismaClient;

  const authenticate = createRequireAuth(dependencies.auth);
  const requireStudent = requireRole('Student');

  router.get(
    '/',
    (request, _response, next) => {
      try {
        validateCategoryQuery(request.originalUrl);
        next();
      } catch (error) {
        next(error);
      }
    },
    (request, response, next) => {
      if (validateCategoryQuery(request.originalUrl) === 'Skill') {
        return authenticate(request, response, next);
      }
      next();
    },
    (request, response, next) => {
      if (validateCategoryQuery(request.originalUrl) === 'Skill') {
        return requireStudent(request, response, next);
      }
      next();
    },
    async (request, response, next) => {
      try {
        const type = validateCategoryQuery(request.originalUrl);
        response.json(await listActiveCategories(getClient(), type));
      } catch (error) {
        next(asPublicApiError(error));
      }
    },
  );

  return router;
}
