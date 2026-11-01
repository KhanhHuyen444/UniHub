import { json, Router, type RequestHandler } from 'express';
import { getPrismaClient } from '../../lib/prisma.js';
import {
  createRequireAuth,
  requireRole,
  type AuthMiddlewareDependencies,
} from '../../middleware/auth.js';
import { ApiError, asPublicApiError } from '../../middleware/errors.js';
import {
  listAdminCategories,
  mutateAdminCategory,
  parseAdminCategoryQuery,
  parseCategoryId,
  parseCategoryMutation,
  type AdminCategoriesClient,
  type CategoryMutation,
} from './admin-categories.service.js';

export interface AdminCategoriesRouterDependencies {
  getPrismaClient?: () => AdminCategoriesClient;
  auth?: AuthMiddlewareDependencies;
}

export function createAdminCategoriesRouter(
  dependencies: AdminCategoriesRouterDependencies = {},
) {
  const router = Router();
  const getClient = dependencies.getPrismaClient ?? getPrismaClient;
  // Mounted before the app JSON parser so duplicate top-level JSON fields are
  // still observable. Syntax, encoding and size errors use the shared handler.
  router.use(
    json({
      limit: '100kb',
      verify: (_request, _response, buffer, encoding) => {
        let raw: string;
        try {
          raw = new TextDecoder(encoding).decode(buffer);
        } catch {
          throw new ApiError(
            415,
            'UNSUPPORTED_ENCODING',
            'Mã hóa nội dung không được hỗ trợ.',
          );
        }
        try {
          JSON.parse(raw);
        } catch {
          return;
        }
        let depth = 0;
        const keys = new Set<string>();
        const tokens = raw.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\]]/g);
        for (const token of tokens) {
          if (token[0] === '{' || token[0] === '[') depth++;
          else if (token[0] === '}' || token[0] === ']') depth--;
          else if (
            depth === 1 &&
            raw
              .slice(token.index + token[0].length)
              .trimStart()
              .startsWith(':')
          ) {
            const key = JSON.parse(token[0]) as string;
            if (keys.has(key))
              throw new ApiError(
                400,
                'INVALID_REQUEST',
                'Trường JSON không được lặp.',
              );
            keys.add(key);
          }
        }
      },
    }),
  );
  router.use(createRequireAuth(dependencies.auth), requireRole('Admin'));
  router.get('/', async (request, response, next) => {
    try {
      const type = parseAdminCategoryQuery(request.originalUrl);
      if (
        request.body !== undefined ||
        request.get('transfer-encoding') !== undefined ||
        Number(request.get('content-length') ?? 0) > 0
      )
        throw new ApiError(
          400,
          'INVALID_REQUEST',
          'Yêu cầu GET không nhận body.',
        );
      response.json(await listAdminCategories(getClient(), type));
    } catch (error) {
      next(asPublicApiError(error));
    }
  });
  const mutation =
    (kind: CategoryMutation['kind']): RequestHandler =>
    async (request, response, next) => {
      try {
        const id =
          kind === 'create'
            ? undefined
            : parseCategoryId(String(request.params.id));
        if (
          new URL(request.originalUrl, 'http://unihub.invalid').searchParams
            .size
        )
          throw new ApiError(
            400,
            'INVALID_QUERY',
            'Tham số truy vấn không hợp lệ.',
          );
        const input = parseCategoryMutation(kind, request.body, id);
        const result = await mutateAdminCategory(
          getClient(),
          request.authUser!.userId,
          input,
        );
        response.status(kind === 'create' ? 201 : 200).json(result);
      } catch (error) {
        next(asPublicApiError(error));
      }
    };
  router.post('/', mutation('create'));
  router.patch('/:id', mutation('rename'));
  router.patch('/:id/status', mutation('status'));
  return router;
}
