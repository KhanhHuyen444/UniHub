import { json, Router } from 'express';
import { getPrismaClient } from '../../lib/prisma.js';
import {
  createRequireAuth,
  requireRole,
  type AuthMiddlewareDependencies,
} from '../../middleware/auth.js';
import { ApiError, asPublicApiError } from '../../middleware/errors.js';
import {
  changeUserRole,
  listAdminUsers,
  parseAdminUsersQuery,
  parseRoleChangeBody,
  parseTargetUserId,
  type AdminUsersClient,
} from './admin-users.service.js';

export interface AdminUsersRouterDependencies {
  getPrismaClient?: () => AdminUsersClient;
  auth?: AuthMiddlewareDependencies;
}

export function createAdminUsersRouter(
  dependencies: AdminUsersRouterDependencies = {},
) {
  const router = Router();
  const getClient = dependencies.getPrismaClient ?? getPrismaClient;

  // Mounted before the global express.json() so duplicate top-level keys
  // and malformed encodings can be intercepted.
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
            if (keys.has(key)) {
              throw new ApiError(
                400,
                'INVALID_REQUEST',
                'Trường JSON không được lặp.',
              );
            }
            keys.add(key);
          }
        }
      },
    }),
  );

  router.use(createRequireAuth(dependencies.auth), requireRole('Admin'));

  router.get('/', async (request, response, next) => {
    try {
      if (
        request.body !== undefined ||
        request.get('transfer-encoding') !== undefined ||
        Number(request.get('content-length') ?? 0) > 0
      ) {
        throw new ApiError(
          400,
          'INVALID_REQUEST',
          'Yêu cầu GET không nhận body.',
        );
      }

      const query = parseAdminUsersQuery(request.originalUrl);
      const result = await listAdminUsers(getClient(), query);
      response.json(result);
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  router.patch('/:id/role', async (request, response, next) => {
    try {
      const url = new URL(request.originalUrl, 'http://unihub.invalid');
      if (url.searchParams.size > 0) {
        throw new ApiError(
          400,
          'INVALID_QUERY',
          'Tham số truy vấn không hợp lệ.',
        );
      }

      const targetUserId = parseTargetUserId(String(request.params.id));
      const { role } = parseRoleChangeBody(request.body);

      const result = await changeUserRole(getClient(), {
        callerAdminId: request.authUser!.userId,
        targetUserId,
        newRole: role,
      });

      response.status(200).json(result);
    } catch (error) {
      next(asPublicApiError(error));
    }
  });

  return router;
}
