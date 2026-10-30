import {
  createRecommendationsRouter,
  type RecommendationsRouterDependencies,
} from './modules/recommendations/recommendations.routes.js';
import {
  createAdminCategoriesRouter,
  type AdminCategoriesRouterDependencies,
} from './modules/categories/admin-categories.routes.js';
import {
  createGuidanceRouter,
  type GuidanceRouterDependencies,
} from './modules/guidance/guidance.routes.js';
import express from 'express';
import {
  createProfileRouter,
  type ProfileRouterDependencies,
} from './modules/users/profile.routes.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { healthRouter } from './modules/health/health.routes.js';
import { createReadyRouter } from './modules/health/ready.routes.js';
import {
  createAuthRouter,
  type GoogleAuthDependencies,
} from './modules/auth/auth.routes.js';
import {
  createCategoriesRouter,
  type CategoriesRouterDependencies,
} from './modules/categories/categories.routes.js';
import {
  createOpportunitiesRouter,
  type OpportunitiesRouterDependencies,
} from './modules/opportunities/opportunities.routes.js';
import { createEventsRouter } from './modules/events/events.routes.js';
import type { EventsRouterDependencies } from './modules/events/events.types.js';
import {
  createAdminOpportunitiesRouter,
  type AdminOpportunitiesRouterDependencies,
} from './modules/admin-opportunities/admin-opportunities.routes.js';

interface AppDependencies {
  profile?: ProfileRouterDependencies;
  checkDatabase?: () => Promise<void>;
  logDatabaseFailure?: () => void;
  categories?: CategoriesRouterDependencies;
  adminCategories?: AdminCategoriesRouterDependencies;
  guidance?: GuidanceRouterDependencies;
  recommendations?: RecommendationsRouterDependencies;
  opportunities?: OpportunitiesRouterDependencies;
  auth?: GoogleAuthDependencies;
  events?: EventsRouterDependencies;
  adminOpportunities?: AdminOpportunitiesRouterDependencies;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    '/api/admin/categories',
    createAdminCategoriesRouter(dependencies.adminCategories),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/health', healthRouter);
  app.use('/api/ready', createReadyRouter(dependencies));
  app.use('/api/auth', createAuthRouter(dependencies.auth));
  app.use('/api/users/me/profile', createProfileRouter(dependencies.profile));
  app.use('/api/categories', createCategoriesRouter(dependencies.categories));
  app.use(
    '/api/recommendations',
    createRecommendationsRouter(dependencies.recommendations),
  );
  app.use('/api/guidance', createGuidanceRouter(dependencies.guidance));
  app.use(
    '/api/opportunities',
    createOpportunitiesRouter(dependencies.opportunities),
  );
  app.use('/api/events', createEventsRouter(dependencies.events));
  app.use(
    '/api/admin/opportunities',
    createAdminOpportunitiesRouter(dependencies.adminOpportunities),
  );
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
