import express from 'express';
import { errorHandler, notFound } from './middleware/errors.js';
import { healthRouter } from './modules/health/health.routes.js';
import { createReadyRouter } from './modules/health/ready.routes.js';
import {
  createOpportunitiesRouter,
  type OpportunitiesRouterDependencies,
} from './modules/opportunities/opportunities.routes.js';

interface AppDependencies {
  checkDatabase?: () => Promise<void>;
  logDatabaseFailure?: () => void;
  opportunities?: OpportunitiesRouterDependencies;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/health', healthRouter);
  app.use('/api/ready', createReadyRouter(dependencies));
  app.use(
    '/api/opportunities',
    createOpportunitiesRouter(dependencies.opportunities),
  );
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
