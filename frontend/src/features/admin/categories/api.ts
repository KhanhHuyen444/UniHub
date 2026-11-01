import { ApiError } from '../../../lib/api';
import { protectedApiRequest } from '../../auth/auth-api';
import {
  invalidResponse,
  isCategoryId,
  isCategoryType,
  isCategoryStatus,
  parseAdminCategories,
  parseCategoryChange,
  parseCreatedCategory,
  type CategoryType,
  type CategoryStatus,
} from './contracts';

function invalid(code = 'VALIDATION_ERROR'): never {
  throw new ApiError(
    'Tên phải có 1–100 ký tự; lý do tối đa 500 ký tự. Dữ liệu danh mục không hợp lệ.',
    { code, kind: 'request' },
  );
}
function validateToken(token: string) {
  if (!token.trim())
    throw new ApiError('Cần đăng nhập Admin.', {
      code: 'UNAUTHORIZED',
      kind: 'request',
      status: 401,
    });
}
function fields(name: string, reason: string | null) {
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    Array.from(name.trim()).length > 100
  )
    return invalid();
  validateReason(reason);
  return { name: name.trim(), reason };
}
function validateReason(reason: string | null) {
  if (
    reason !== null &&
    (typeof reason !== 'string' || Array.from(reason).length > 500)
  )
    invalid();
}
export async function getAdminCategories(
  token: string,
  type: CategoryType,
  signal?: AbortSignal,
) {
  validateToken(token);
  if (!isCategoryType(type)) invalid('INVALID_QUERY');
  const result = await protectedApiRequest<unknown>('/api/admin/categories', {
    query: new URLSearchParams({ type }),
    signal,
  });
  return parseAdminCategories(result, type);
}
export async function createAdminCategory(
  token: string,
  type: CategoryType,
  name: string,
  reason: string | null,
  signal?: AbortSignal,
) {
  validateToken(token);
  if (!isCategoryType(type)) invalid();
  const body = { type, ...fields(name, reason) };
  const category = parseCreatedCategory(
    await protectedApiRequest<unknown>('/api/admin/categories', {
      method: 'POST',
      body,
      signal,
    }),
  );
  if (category.type !== type || category.name !== body.name)
    return invalidResponse();
  return category;
}
export async function renameAdminCategory(
  token: string,
  id: number,
  name: string,
  reason: string | null,
  signal?: AbortSignal,
) {
  validateToken(token);
  if (!isCategoryId(id)) invalid('INVALID_ID');
  const body = fields(name, reason);
  const result = parseCategoryChange(
    await protectedApiRequest<unknown>(`/api/admin/categories/${id}`, {
      method: 'PATCH',
      body,
      signal,
    }),
  );
  if (result.category.id !== id || result.category.name !== body.name)
    return invalidResponse();
  return result;
}
export async function setAdminCategoryStatus(
  token: string,
  id: number,
  status: CategoryStatus,
  reason: string | null,
  signal?: AbortSignal,
) {
  validateToken(token);
  if (!isCategoryId(id)) invalid('INVALID_ID');
  if (!isCategoryStatus(status)) invalid();
  validateReason(reason);
  const result = parseCategoryChange(
    await protectedApiRequest<unknown>(`/api/admin/categories/${id}/status`, {
      method: 'PATCH',
      body: { status, reason },
      signal,
    }),
  );
  if (result.category.id !== id || result.category.status !== status)
    return invalidResponse();
  return result;
}
