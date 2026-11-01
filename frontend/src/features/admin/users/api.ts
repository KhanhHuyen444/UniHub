import { ApiError, apiRequest } from '../../../lib/api';
import {
  isUserRole,
  parseAdminUserRoleChange,
  parseAdminUsersResponse,
  type AdminUserRoleChangeResponse,
  type AdminUsersResponse,
  type UserRole,
} from './contracts';

function authHeaders(token: string) {
  if (!token || !token.trim()) {
    throw new ApiError('Cần đăng nhập Admin.', {
      code: 'UNAUTHORIZED',
      kind: 'request',
      status: 401,
    });
  }
  return { Authorization: `Bearer ${token.trim()}` };
}

export interface GetAdminUsersQuery {
  page?: number;
  pageSize?: number;
  q?: string;
}

export async function getAdminUsers(
  token: string,
  query: GetAdminUsersQuery = {},
  signal?: AbortSignal,
): Promise<AdminUsersResponse> {
  const headers = authHeaders(token);
  const searchParams = new URLSearchParams();

  if (query.page !== undefined) {
    if (!Number.isSafeInteger(query.page) || query.page < 1) {
      throw new ApiError('Số trang không hợp lệ.', {
        code: 'INVALID_QUERY',
        kind: 'request',
      });
    }
    searchParams.set('page', String(query.page));
  }

  if (query.pageSize !== undefined) {
    if (
      !Number.isSafeInteger(query.pageSize) ||
      query.pageSize < 1 ||
      query.pageSize > 100
    ) {
      throw new ApiError('Kích thước trang không hợp lệ.', {
        code: 'INVALID_QUERY',
        kind: 'request',
      });
    }
    searchParams.set('pageSize', String(query.pageSize));
  }

  if (query.q !== undefined) {
    const trimmed = query.q.trim();
    if (Array.from(trimmed).length > 100) {
      throw new ApiError('Từ khóa tìm kiếm không được vượt quá 100 ký tự.', {
        code: 'INVALID_QUERY',
        kind: 'request',
      });
    }
    if (trimmed.length > 0) {
      searchParams.set('q', trimmed);
    }
  }

  const result = await apiRequest<unknown>('/api/admin/users', {
    headers,
    query: searchParams.size > 0 ? searchParams : undefined,
    signal,
  });

  return parseAdminUsersResponse(result);
}

export async function patchAdminUserRole(
  token: string,
  userId: number,
  role: UserRole,
  signal?: AbortSignal,
): Promise<AdminUserRoleChangeResponse> {
  const headers = authHeaders(token);

  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new ApiError('ID người dùng không hợp lệ.', {
      code: 'INVALID_ID',
      kind: 'request',
    });
  }

  if (!isUserRole(role)) {
    throw new ApiError('Vai trò người dùng phải là Student hoặc Admin.', {
      code: 'VALIDATION_ERROR',
      kind: 'request',
    });
  }

  const result = await apiRequest<unknown>(`/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    headers,
    body: { role },
    signal,
  });

  return parseAdminUserRoleChange(result);
}
