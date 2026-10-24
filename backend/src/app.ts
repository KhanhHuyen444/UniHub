import express from 'express';
import { errorHandler, notFound } from './middleware/errors.js';
import { healthRouter } from './modules/health/health.routes.js';

export const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use('/api/health', healthRouter);
app.use(notFound);
app.use(errorHandler);
