import { ApiError } from '../../../lib/api';

export type UserRole = 'Student' | 'Admin';

export interface AdminUserItem {
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

export interface AdminUsersResponse {
  items: AdminUserItem[];
  meta: AdminUsersPaginationMeta;
}

export interface AdminUserRoleChangeResponse {
  changed: boolean;
  user: {
    id: number;
    role: UserRole;
  };
}

export function isUserRole(value: unknown): value is UserRole {
  return value === 'Student' || value === 'Admin';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalidResponse(
  message = 'Dữ liệu người dùng từ máy chủ không hợp lệ.',
): never {
  throw new ApiError(message, {
    code: 'INVALID_RESPONSE',
    kind: 'response',
  });
}

export function parseAdminUserItem(value: unknown): AdminUserItem {
  if (!isRecord(value)) invalidResponse();

  const { id, fullName, email, major, academicYear, role } = value;

  if (
    !Number.isSafeInteger(id) ||
    (id as number) < 1 ||
    typeof fullName !== 'string' ||
    typeof email !== 'string' ||
    !isUserRole(role)
  ) {
    invalidResponse();
  }

  let parsedMajor: AdminUserItem['major'] = null;
  if (major !== null && major !== undefined) {
    if (
      !isRecord(major) ||
      !Number.isSafeInteger(major.id) ||
      (major.id as number) < 1 ||
      typeof major.name !== 'string'
    ) {
      invalidResponse();
    }
    parsedMajor = {
      id: major.id as number,
      name: major.name as string,
    };
  }

  let parsedAcademicYear: number | null = null;
  if (academicYear !== null && academicYear !== undefined) {
    if (!Number.isSafeInteger(academicYear) || (academicYear as number) < 1) {
      invalidResponse();
    }
    parsedAcademicYear = academicYear as number;
  }

  return {
    id: id as number,
    fullName: fullName as string,
    email: email as string,
    major: parsedMajor,
    academicYear: parsedAcademicYear,
    role: role as UserRole,
  };
}

export function parseAdminUsersResponse(value: unknown): AdminUsersResponse {
  if (!isRecord(value)) invalidResponse();

  const { items, meta } = value;

  if (!Array.isArray(items) || !isRecord(meta)) invalidResponse();

  const { page, pageSize, total, totalPages } = meta;

  if (
    !Number.isSafeInteger(page) ||
    (page as number) < 1 ||
    !Number.isSafeInteger(pageSize) ||
    (pageSize as number) < 1 ||
    !Number.isSafeInteger(total) ||
    (total as number) < 0 ||
    !Number.isSafeInteger(totalPages) ||
    (totalPages as number) < 0
  ) {
    invalidResponse();
  }

  return {
    items: items.map(parseAdminUserItem),
    meta: {
      page: page as number,
      pageSize: pageSize as number,
      total: total as number,
      totalPages: totalPages as number,
    },
  };
}

export function parseAdminUserRoleChange(
  value: unknown,
): AdminUserRoleChangeResponse {
  if (!isRecord(value)) invalidResponse();

  const { changed, user } = value;

  if (typeof changed !== 'boolean' || !isRecord(user)) invalidResponse();

  const { id, role } = user;

  if (!Number.isSafeInteger(id) || (id as number) < 1 || !isUserRole(role)) {
    invalidResponse();
  }

  return {
    changed,
    user: {
      id: id as number,
      role: role as UserRole,
    },
  };
}
