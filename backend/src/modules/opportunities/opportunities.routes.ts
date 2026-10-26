import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { ApiError } from '../../middleware/errors.js';
import {
  DatabaseNotConfiguredError,
  getPrismaClient,
  InvalidDatabaseConfigurationError,
} from '../../lib/prisma.js';
import {
  getPublicOpportunity,
  listPublicOpportunities,
  type OpportunityReadClient,
} from './opportunities.service.js';

export interface OpportunitiesRouterDependencies {
  getPrismaClient?: () => PrismaClient | OpportunityReadClient;
  getEvaluatedAt?: () => Date;
}

function isDatabaseUnavailable(error: unknown): boolean {
  if (
    error instanceof DatabaseNotConfiguredError ||
    error instanceof InvalidDatabaseConfigurationError
  ) {
    return true;
  }
  const pending = [error];
  const seen = new Set<unknown>();
  const unavailableCodes = new Set([
    'P1000',
    'P1001',
    'P1002',
    'P1003',
    'P1008',
    'P1010',
    'P1011',
    'P1017',
    'P2024',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'EPIPE',
    'PROTOCOL_CONNECTION_LOST',
    'ER_ACCESS_DENIED_ERROR',
    'ER_CON_COUNT_ERROR',
    'ER_BAD_DB_ERROR',
    'ER_TABLEACCESS_DENIED_ERROR',
  ]);

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);

    const candidate = current as {
      code?: unknown;
      errorCode?: unknown;
      cause?: unknown;
    };
    if (
      (typeof candidate.code === 'string' &&
        unavailableCodes.has(candidate.code)) ||
      (typeof candidate.errorCode === 'string' &&
        unavailableCodes.has(candidate.errorCode))
    ) {
      return true;
    }
    pending.push(candidate.cause);
  }

  return false;
}

function asPublicApiError(error: unknown): unknown {
  if (error instanceof ApiError) return error;
  if (isDatabaseUnavailable(error)) {
    return new ApiError(
      503,
      'SERVICE_UNAVAILABLE',
      'Database hiện không sẵn sàng.',
    );
  }
  return error;
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
