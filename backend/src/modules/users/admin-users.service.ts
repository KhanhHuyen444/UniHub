import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { ApiError } from '../../middleware/errors.js';
import { writeActivityLog } from '../activity-logs/activity-log.writer.js';

export type AdminUsersClient = Pick<PrismaClient, 'user' | '$transaction'>;

export type UserRole = 'Student' | 'Admin';

export interface AdminUserListItem {
  id: number;
  fullName: string;
  email: string;
  major: {
    id: number;
    name: string;
  } | null;
  academicYear: number | null;
  role: UserRole;
}

export interface AdminUsersPaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminUsersListResponse {
  items: AdminUserListItem[];
  meta: AdminUsersPaginationMeta;
}

export interface ParsedAdminUsersQuery {
  page: number;
  pageSize: number;
  q?: string;
}

export interface RoleChangeResult {
  changed: boolean;
  user: {
    id: number;
    role: UserRole;
  };
}

const MAX_PAGE = 1_000_000;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_SEARCH_LENGTH = 100;
const MAX_INT = 2_147_483_647;

export function parseAdminUsersQuery(
  originalUrl: string,
): ParsedAdminUsersQuery {
  const url = new URL(originalUrl, 'http://unihub.invalid');
  const allowedKeys = new Set(['page', 'pageSize', 'q']);

  const keyCounts = new Map<string, number>();
  for (const [key] of url.searchParams.entries()) {
    if (!allowedKeys.has(key)) {
      throw new ApiError(
        400,
        'INVALID_QUERY',
        'Tham số truy vấn không hợp lệ.',
      );
    }
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    if ((keyCounts.get(key) ?? 0) > 1) {
      throw new ApiError(
        400,
        'INVALID_QUERY',
        'Tham số truy vấn không được lặp.',
      );
    }
  }

  let page = DEFAULT_PAGE;
  if (url.searchParams.has('page')) {
    const rawPage = url.searchParams.get('page')!;
    if (!/^[1-9]\d*$/.test(rawPage)) {
      throw new ApiError(
        400,
        'INVALID_QUERY',
        'Số trang page phải là số nguyên dương.',
      );
    }
    page = Number(rawPage);
    if (!Number.isSafeInteger(page) || page < 1 || page > MAX_PAGE) {
      throw new ApiError(
        400,
        'INVALID_QUERY',
        `Số trang page phải trong khoảng 1 đến ${MAX_PAGE}.`,
      );
    }
  }

  let pageSize = DEFAULT_PAGE_SIZE;
  if (url.searchParams.has('pageSize')) {
    const rawPageSize = url.searchParams.get('pageSize')!;
    if (!/^[1-9]\d*$/.test(rawPageSize)) {
      throw new ApiError(
        400,
        'INVALID_QUERY',
        'Kích thước trang pageSize phải là số nguyên dương.',
      );
    }
    pageSize = Number(rawPageSize);
    if (
      !Number.isSafeInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > MAX_PAGE_SIZE
    ) {
      throw new ApiError(
        400,
        'INVALID_QUERY',
        `Kích thước trang pageSize phải trong khoảng 1 đến ${MAX_PAGE_SIZE}.`,
      );
    }
  }

  let q: string | undefined;
  if (url.searchParams.has('q')) {
    const rawQ = url.searchParams.get('q')!;
    const trimmed = rawQ.trim();
    if (Array.from(trimmed).length > MAX_SEARCH_LENGTH) {
      throw new ApiError(
        400,
        'INVALID_QUERY',
        `Từ khóa tìm kiếm không được vượt quá ${MAX_SEARCH_LENGTH} ký tự.`,
      );
    }
    q = trimmed.length > 0 ? trimmed : undefined;
  }

  return { page, pageSize, q };
}

export function parseTargetUserId(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ApiError(400, 'INVALID_ID', 'ID người dùng không hợp lệ.');
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1 || id > MAX_INT) {
    throw new ApiError(400, 'INVALID_ID', 'ID người dùng không hợp lệ.');
  }
  return id;
}

export function parseRoleChangeBody(body: unknown): { role: UserRole } {
  if (
    body === null ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.getPrototypeOf(body) !== Object.prototype
  ) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Dữ liệu yêu cầu phải là JSON object.',
    );
  }

  const keys = Object.keys(body as Record<string, unknown>);
  if (keys.length !== 1 || keys[0] !== 'role') {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Yêu cầu chỉ được chứa trường role.',
    );
  }

  const role = (body as { role: unknown }).role;
  if (role !== 'Student' && role !== 'Admin') {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Vai trò người dùng phải là Student hoặc Admin.',
    );
  }

  return { role };
}

export async function listAdminUsers(
  client: AdminUsersClient,
  query: ParsedAdminUsersQuery,
): Promise<AdminUsersListResponse> {
  const { page, pageSize, q } = query;

  const where: Prisma.UserWhereInput = q
    ? {
        OR: [{ full_name: { contains: q } }, { email: { contains: q } }],
      }
    : {};

  const total = await client.user.count({ where });
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  if (total === 0 || page > totalPages) {
    return {
      items: [],
      meta: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  const skip = (page - 1) * pageSize;
  const take = pageSize;

  const users = await client.user.findMany({
    where,
    select: {
      user_id: true,
      full_name: true,
      email: true,
      academic_year: true,
      role: true,
      major: {
        select: {
          category_id: true,
          name: true,
        },
      },
    },
    orderBy: [{ full_name: 'asc' }, { user_id: 'asc' }],
    skip,
    take,
  });

  const items: AdminUserListItem[] = users.map((u) => ({
    id: u.user_id,
    fullName: u.full_name,
    email: u.email,
    major: u.major
      ? {
          id: u.major.category_id,
          name: u.major.name,
        }
      : null,
    academicYear: u.academic_year,
    role: u.role as UserRole,
  }));

  return {
    items,
    meta: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}

export async function changeUserRole(
  client: AdminUsersClient,
  params: {
    callerAdminId: number;
    targetUserId: number;
    newRole: UserRole;
  },
): Promise<RoleChangeResult> {
  const { callerAdminId, targetUserId, newRole } = params;

  // Self-demotion check (BR-14.4):
  // Admin cannot demote themselves from Admin to Student
  if (callerAdminId === targetUserId && newRole === 'Student') {
    throw new ApiError(
      403,
      'SELF_DEMOTION_FORBIDDEN',
      'Quản trị viên không thể tự hạ quyền của chính mình.',
    );
  }

  // Update in a Prisma transaction alongside activity log
  return await client.$transaction(
    async (tx) => {
      // If demoting to Student, lock all Admin rows in deterministic order
      // to serialize concurrent demotions and prevent cross-demotion race condition.
      // Otherwise, lock only target user row.
      if (newRole === 'Student') {
        await tx.$queryRaw`SELECT user_id FROM users WHERE role = 'Admin' ORDER BY user_id FOR UPDATE`;
      } else {
        await tx.$queryRaw`SELECT user_id FROM users WHERE user_id = ${targetUserId} FOR UPDATE`;
      }

      const targetUser = await tx.user.findUnique({
        where: { user_id: targetUserId },
        select: {
          user_id: true,
          role: true,
        },
      });

      if (!targetUser) {
        throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy người dùng.');
      }

      const currentRole = targetUser.role as UserRole;

      // No-op handling: if target's role is already newRole, do not write log or update
      if (currentRole === newRole) {
        return {
          changed: false,
          user: {
            id: targetUser.user_id,
            role: currentRole,
          },
        };
      }

      // Last admin protection: when demoting an Admin to Student, ensure there is at least one other Admin remaining
      if (currentRole === 'Admin' && newRole === 'Student') {
        const adminCount = await tx.user.count({
          where: { role: 'Admin' },
        });

        if (adminCount <= 1) {
          throw new ApiError(
            409,
            'LAST_ADMIN_PROTECTED',
            'Không thể hạ quyền Quản trị viên cuối cùng của hệ thống.',
          );
        }
      }

      const updatedUser = await tx.user.update({
        where: { user_id: targetUserId },
        data: { role: newRole },
        select: {
          user_id: true,
          role: true,
        },
      });

      await writeActivityLog(tx, {
        adminId: callerAdminId,
        targetId: targetUserId,
        actionType: 'CHANGE_ROLE',
        targetType: 'User',
        oldValue: { role: currentRole },
        newValue: { role: newRole },
      });

      return {
        changed: true,
        user: {
          id: updatedUser.user_id,
          role: updatedUser.role as UserRole,
        },
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
