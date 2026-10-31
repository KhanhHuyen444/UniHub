import express from 'express';
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
import {
  createForumRouter,
  type ForumRouterDependencies,
} from './modules/forum/forum.routes.js';
import {
  createForumModerationRouter,
  type ForumModerationRouterDependencies,
} from './modules/forum/forum-moderation.routes.js';

interface AppDependencies {
  checkDatabase?: () => Promise<void>;
  logDatabaseFailure?: () => void;
  categories?: CategoriesRouterDependencies;
  opportunities?: OpportunitiesRouterDependencies;
  auth?: GoogleAuthDependencies;
  forum?: ForumRouterDependencies;
  forumModeration?: ForumModerationRouterDependencies;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/health', healthRouter);
  app.use('/api/ready', createReadyRouter(dependencies));
  app.use('/api/auth', createAuthRouter(dependencies.auth));
  app.use('/api/categories', createCategoriesRouter(dependencies.categories));
  app.use(
    '/api/opportunities',
    createOpportunitiesRouter(dependencies.opportunities),
  );
  app.use('/api/forum', createForumRouter(dependencies.forum));
  app.use(
    '/api/admin/moderation/forum',
    createForumModerationRouter(dependencies.forumModeration),
  );
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
