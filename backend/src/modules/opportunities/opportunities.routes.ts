import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { asPublicApiError } from '../../middleware/errors.js';
import { getPrismaClient } from '../../lib/prisma.js';
import {
  getPublicOpportunity,
  listPublicOpportunities,
  type OpportunityReadClient,
} from './opportunities.service.js';

export interface OpportunitiesRouterDependencies {
  getPrismaClient?: () => PrismaClient | OpportunityReadClient;
  getEvaluatedAt?: () => Date;
}

export function createOpportunitiesRouter(
  dependencies: OpportunitiesRouterDependencies = {},
) {
  const router = Router();
  const getClient = dependencies.getPrismaClient ?? getPrismaClient;
  const getEvaluatedAt = dependencies.getEvaluatedAt ?? (() => new Date());

  router.get('/', async (request, response, next) => {
    try {
      const evaluatedAt = getEvaluatedAt();
      const result = await listPublicOpportunities(
        getClient(),
        request.originalUrl,
        evaluatedAt,
      );
      response.json(result);
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  router.get('/:id', async (request, response, next) => {
    try {
      const evaluatedAt = getEvaluatedAt();
      const result = await getPublicOpportunity(
        getClient(),
        request.params.id,
        evaluatedAt,
      );
      response.json({
        item: result.item,
        meta: { evaluatedAt: result.evaluatedAt },
      });
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  return router;
}
