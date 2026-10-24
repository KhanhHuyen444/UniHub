import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_request, response) => {
  response.set('Cache-Control', 'no-store');
  response.json({ status: 'ok', service: 'unihub-api' });
});
