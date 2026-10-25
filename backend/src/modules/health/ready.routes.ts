import { Router } from 'express';
import {
  checkDatabaseConnection,
  DatabaseNotConfiguredError,
  InvalidDatabaseConfigurationError,
} from '../../lib/prisma.js';

interface ReadyRouterDependencies {
  checkDatabase?: () => Promise<void>;
  logDatabaseFailure?: () => void;
}

export function createReadyRouter({
  checkDatabase = checkDatabaseConnection,
  logDatabaseFailure = () =>
    console.error('Database readiness check failed; details are omitted.'),
}: ReadyRouterDependencies = {}) {
  const router = Router();

  router.get('/', async (_request, response) => {
    response.set('Cache-Control', 'no-store');
    try {
      await checkDatabase();
      response.json({
        status: 'ready',
        service: 'unihub-api',
        database: 'available',
      });
    } catch (error) {
      if (error instanceof DatabaseNotConfiguredError) {
        response.status(503).json({
          error: {
            code: 'DATABASE_NOT_CONFIGURED',
            message: 'Database chưa được cấu hình.',
          },
        });
        return;
      }

      if (error instanceof InvalidDatabaseConfigurationError) {
        response.status(503).json({
          error: {
            code: 'DATABASE_CONFIGURATION_INVALID',
            message: 'Cấu hình database không hợp lệ.',
          },
        });
        return;
      }

      logDatabaseFailure();
      response.status(503).json({
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database hiện không sẵn sàng.',
        },
      });
    }
  });

  return router;
}
