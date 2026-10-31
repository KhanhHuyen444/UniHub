import { ApiError } from '../../../lib/api';

export type CategoryType = 'Major' | 'Skill';
export type CategoryStatus = 'Active' | 'Closed';
export interface AdminCategory {
  id: number;
  type: CategoryType;
  name: string;
  status: CategoryStatus;
  createdAt: string | null;
}
export interface CategoryChange {
  changed: boolean;
  category: AdminCategory;
}
export const isCategoryType = (value: unknown): value is CategoryType =>
  value === 'Major' || value === 'Skill';
export const isCategoryStatus = (value: unknown): value is CategoryStatus =>
  value === 'Active' || value === 'Closed';
export const isCategoryId = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value > 0 &&
  value <= 2_147_483_647;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export function invalidResponse(): never {
  throw new ApiError('Dữ liệu danh mục trả về không hợp lệ.', {
    code: 'INVALID_RESPONSE',
    kind: 'response',
  });
}
// Invalid metadata must not hide an otherwise usable category list.
export function parseCreatedAt(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  )
    return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value
    ? value
    : null;
}
export function parseAdminCategory(value: unknown): AdminCategory {
  if (
    !record(value) ||
    !isCategoryId(value.id) ||
    !isCategoryType(value.type) ||
    !isCategoryStatus(value.status) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    Array.from(value.name).length > 100
  )
    return invalidResponse();
  return {
    id: value.id,
    type: value.type,
    name: value.name,
    status: value.status,
    createdAt: parseCreatedAt(value.createdAt),
  };
}
export function parseAdminCategories(
  value: unknown,
  type: CategoryType,
): AdminCategory[] {
  if (!record(value) || !Array.isArray(value.items)) return invalidResponse();
  const ids = new Set<number>();
  return value.items.map((item) => {
    const category = parseAdminCategory(item);
    if (category.type !== type || ids.has(category.id))
      return invalidResponse();
    ids.add(category.id);
    return category;
  });
}
export function parseCategoryChange(value: unknown): CategoryChange {
  if (!record(value) || typeof value.changed !== 'boolean')
    return invalidResponse();
  return {
    changed: value.changed,
    category: parseAdminCategory(value.category),
  };
}
export function parseCreatedCategory(value: unknown): AdminCategory {
  if (!record(value)) return invalidResponse();
  const category = parseAdminCategory(value.category);
  if (category.status !== 'Active') return invalidResponse();
  return category;
}
