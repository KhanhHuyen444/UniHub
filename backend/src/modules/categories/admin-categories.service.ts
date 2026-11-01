import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { ApiError } from '../../middleware/errors.js';
import {
  ActivityLogValidationError,
  writeActivityLog,
} from '../activity-logs/activity-log.writer.js';

export type AdminCategoriesClient = Pick<
  PrismaClient,
  'category' | '$transaction'
>;
type CategoryType = 'Major' | 'Skill';
type Status = 'Active' | 'Closed';
type CategoryRow = {
  category_id: number;
  type: string;
  name: string;
  status: string;
  created_at: Date;
};
export type CategoryMutation =
  | { kind: 'create'; type: CategoryType; name: string; reason: string | null }
  | { kind: 'rename'; id: number; name: string; reason: string | null }
  | { kind: 'status'; id: number; status: Status; reason: string | null };

const select = {
  category_id: true,
  type: true,
  name: true,
  status: true,
  created_at: true,
} as const;
const toCategory = (row: CategoryRow) => ({
  id: row.category_id,
  name: row.name,
  type: row.type,
  status: row.status,
  createdAt: row.created_at.toISOString(),
});
const invalid = (code: string) =>
  new ApiError(400, code, 'Yêu cầu danh mục không hợp lệ.');

export function parseCategoryId(value: string): number {
  const id = Number(value);
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(id) ||
    id < 1 ||
    id > 2_147_483_647
  )
    throw invalid('INVALID_ID');
  return id;
}

export function parseAdminCategoryQuery(originalUrl: string): CategoryType {
  const params = new URL(originalUrl, 'http://unihub.invalid').searchParams;
  const type = params.get('type');
  if (params.size !== 1 || (type !== 'Major' && type !== 'Skill'))
    throw invalid('INVALID_QUERY');
  return type;
}

export function parseCategoryMutation(
  kind: CategoryMutation['kind'],
  body: unknown,
  id?: number,
): CategoryMutation {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw invalid('INVALID_REQUEST');
  const input = body as Record<string, unknown>;
  const allowed =
    kind === 'create'
      ? ['type', 'name', 'reason']
      : kind === 'rename'
        ? ['name', 'reason']
        : ['status', 'reason'];
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    throw invalid('INVALID_REQUEST');
  if (
    input.reason !== undefined &&
    input.reason !== null &&
    (typeof input.reason !== 'string' || Array.from(input.reason).length > 500)
  )
    throw invalid('VALIDATION_ERROR');
  const reason = (input.reason ?? null) as string | null;
  if (kind === 'status') {
    if (input.status !== 'Active' && input.status !== 'Closed')
      throw invalid('VALIDATION_ERROR');
    return { kind, id: id!, status: input.status, reason };
  }
  if (typeof input.name !== 'string') throw invalid('VALIDATION_ERROR');
  const name = input.name.trim();
  if (!name || Array.from(name).length > 100) throw invalid('VALIDATION_ERROR');
  if (kind === 'rename') return { kind, id: id!, name, reason };
  if (input.type !== 'Major' && input.type !== 'Skill')
    throw invalid('VALIDATION_ERROR');
  return { kind, type: input.type, name, reason };
}

export async function listAdminCategories(
  client: AdminCategoriesClient,
  type: CategoryType,
) {
  const rows = await client.category.findMany({
    where: { type },
    select,
    orderBy: [{ name: 'asc' }, { category_id: 'asc' }],
  });
  return { items: rows.map(toCategory) };
}

async function mutate(
  tx: Prisma.TransactionClient,
  adminId: number,
  input: CategoryMutation,
) {
  // A current locking read, not a repeatable-read snapshot. All category writes
  // acquire the same ordered locks, serializing lifecycle checks across types.
  // There is no pagination: lock all category rows (and InnoDB gaps) consistently.
  const rows = await tx.$queryRaw<CategoryRow[]>`
    SELECT category_id, type, name, status, created_at FROM categories ORDER BY category_id FOR UPDATE
  `;
  if (input.kind === 'create') {
    const row = await tx.category.create({
      data: {
        type: input.type,
        name: input.name,
        status: 'Active',
      },
      select,
    });
    await writeActivityLog(tx, {
      adminId,
      targetId: row.category_id,
      targetType: 'Category',
      actionType: 'CREATE_CATEGORY',
      oldValue: null,
      newValue: { type: input.type, name: row.name, status: 'Active' },
      reason: input.reason,
    });
    return { category: toCategory(row) };
  }
  const old = rows.find((row) => row.category_id === input.id);
  if (!old) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy danh mục.');
  if (
    (input.kind === 'rename' && old.name === input.name) ||
    (input.kind === 'status' && old.status === input.status)
  )
    return { changed: false, category: toCategory(old) };
  if (
    input.kind === 'status' &&
    input.status === 'Closed' &&
    rows.filter((row) => row.type === old.type && row.status === 'Active')
      .length <= 1
  )
    throw new ApiError(
      409,
      'LAST_ACTIVE_CATEGORY',
      'Không thể đóng danh mục Active cuối cùng.',
    );
  const row = await tx.category.update({
    where: { category_id: input.id },
    data:
      input.kind === 'rename' ? { name: input.name } : { status: input.status },
    select,
  });
  if (input.kind === 'rename') {
    await writeActivityLog(tx, {
      adminId,
      targetId: input.id,
      targetType: 'Category',
      actionType: 'RENAME_CATEGORY',
      oldValue: { name: old.name },
      newValue: { name: row.name },
      reason: input.reason,
    });
  } else {
    if (old.status !== 'Active' && old.status !== 'Closed')
      throw new Error('Invalid category status');
    await writeActivityLog(tx, {
      adminId,
      targetId: input.id,
      targetType: 'Category',
      actionType:
        input.status === 'Closed' ? 'CLOSE_CATEGORY' : 'REOPEN_CATEGORY',
      oldValue: { status: old.status },
      newValue: { status: input.status },
      reason: input.reason,
    });
  }
  return { changed: true, category: toCategory(row) };
}

export async function mutateAdminCategory(
  client: AdminCategoriesClient,
  adminId: number,
  input: CategoryMutation,
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.$transaction((tx) => mutate(tx, adminId, input), {
        isolationLevel: 'RepeatableRead',
      });
    } catch (error) {
      if (error instanceof ActivityLogValidationError)
        throw invalid('VALIDATION_ERROR');
      const failure = error as {
        code?: string;
        meta?: { code?: string };
      } | null;
      if (failure?.code === 'P2002')
        throw new ApiError(
          409,
          'DUPLICATE_CATEGORY',
          'Tên danh mục đã tồn tại trong loại này.',
        );
      const deadlock =
        failure?.code === 'P2034' ||
        (failure?.code === 'P2010' && failure.meta?.code === '1213');
      if (!deadlock) throw error;
      if (attempt >= 2)
        throw new ApiError(
          503,
          'SERVICE_UNAVAILABLE',
          'Vui lòng thử lại thao tác danh mục.',
        );
    }
  }
}
