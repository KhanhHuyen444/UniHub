import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { getPrismaClient } from '../../lib/prisma.js';
import { ApiError, asPublicApiError } from '../../middleware/errors.js';
import {
  listActiveMajors,
  type CategoryReadClient,
} from './categories.service.js';

export interface CategoriesRouterDependencies {
  getPrismaClient?: () => PrismaClient | CategoryReadClient;
}

function validateMajorQuery(originalUrl: string): void {
  const params = new URL(originalUrl, 'http://unihub.invalid').searchParams;
  const entries = [...params.entries()];
  const types = params.getAll('type');

  if (
    entries.some(([key]) => key !== 'type') ||
    types.length !== 1 ||
    types[0] !== 'Major'
  ) {
    throw new ApiError(400, 'INVALID_QUERY', 'Tham số truy vấn không hợp lệ.');
  }
}

export function createCategoriesRouter(
  dependencies: CategoriesRouterDependencies = {},
) {
  const router = Router();
  const getClient = dependencies.getPrismaClient ?? getPrismaClient;

  router.get('/', async (request, response, next) => {
    try {
      validateMajorQuery(request.originalUrl);
      response.json(await listActiveMajors(getClient()));
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  return router;
}
