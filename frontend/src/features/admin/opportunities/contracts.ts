import type {
  OpportunityDeadline,
  OpportunityType,
  WorkFormat,
} from '../../opportunities/contracts';

export interface AdminOpportunity {
  id: number;
  type: OpportunityType;
  title: string;
  publisher: string | null;
  descriptionText: string | null;
  requirementsText: string | null;
  workFormat: WorkFormat | null;
  location: string | null;
  deadline: OpportunityDeadline | null;
  isVerified: boolean;
  sourceUrl: string | null;
  majors: Array<{ id: number; name: string }>;
  skills: Array<{ id: number; name: string }>;
  eligibleAcademicYears: number[];
  createdAt: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reviewedAt: string | null;
}

export interface PendingOpportunitiesResponse {
  items: AdminOpportunity[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface AdminOpportunityMutation {
  id: number;
  status: 'Approved' | 'Rejected';
  isVerified: boolean;
  reviewedAt: string;
}

export class AdminOpportunityContractError extends Error {
  readonly code = 'INVALID_RESPONSE';
  readonly kind = 'response';

  constructor() {
    super('Máy chủ trả về dữ liệu kiểm duyệt không hợp lệ.');
    this.name = 'AdminOpportunityContractError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function parseDeadline(value: unknown): OpportunityDeadline | null {
  if (value === null) return null;
  if (!isRecord(value) || !isDate(value.instant)) {
    throw new AdminOpportunityContractError();
  }
  const dateValue = value.date;
  const validDate =
    typeof dateValue === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateValue) &&
    Number.isFinite(Date.parse(`${dateValue}T00:00:00Z`)) &&
    new Date(`${dateValue}T00:00:00Z`).toISOString().slice(0, 10) === dateValue;
  if (
    value.precision === 'date' &&
    validDate &&
    value.sourceTimeZone === null &&
    (value.state === 'open' || value.state === 'expired')
  ) {
    return {
      precision: 'date',
      date: dateValue,
      sourceTimeZone: null,
      instant: value.instant,
      state: value.state,
    };
  }
  if (
    value.precision === 'datetime' &&
    validDate &&
    typeof value.sourceTimeZone === 'string' &&
    value.sourceTimeZone.length > 0 &&
    (value.state === 'open' || value.state === 'expired')
  ) {
    return {
      precision: 'datetime',
      date: dateValue,
      sourceTimeZone: value.sourceTimeZone,
      instant: value.instant,
      state: value.state,
    };
  }
  if (
    value.precision === 'unknown' &&
    value.date === null &&
    value.sourceTimeZone === null &&
    value.state === 'unknown'
  ) {
    return {
      precision: 'unknown',
      date: null,
      sourceTimeZone: null,
      instant: value.instant,
      state: 'unknown',
    };
  }
  throw new AdminOpportunityContractError();
}

function parseNamedIds(value: unknown): Array<{ id: number; name: string }> {
  if (!Array.isArray(value)) throw new AdminOpportunityContractError();
  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      !Number.isSafeInteger(entry.id) ||
      Number(entry.id) < 1 ||
      typeof entry.name !== 'string'
    ) {
      throw new AdminOpportunityContractError();
    }
    return { id: Number(entry.id), name: entry.name };
  });
}

export function parseAdminOpportunity(value: unknown): AdminOpportunity {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.id) ||
    Number(value.id) < 1 ||
    (value.type !== 'Thực tập' &&
      value.type !== 'Việc làm' &&
      value.type !== 'Học bổng') ||
    typeof value.title !== 'string' ||
    (value.publisher !== null && typeof value.publisher !== 'string') ||
    (value.descriptionText !== null &&
      typeof value.descriptionText !== 'string') ||
    (value.requirementsText !== null &&
      typeof value.requirementsText !== 'string') ||
    (value.workFormat !== null &&
      value.workFormat !== 'Online' &&
      value.workFormat !== 'Offline' &&
      value.workFormat !== 'Hybrid') ||
    (value.location !== null && typeof value.location !== 'string') ||
    typeof value.isVerified !== 'boolean' ||
    (value.sourceUrl !== null && typeof value.sourceUrl !== 'string') ||
    !Array.isArray(value.eligibleAcademicYears) ||
    !value.eligibleAcademicYears.every(
      (year) => Number.isSafeInteger(year) && Number(year) > 0,
    ) ||
    !isDate(value.createdAt) ||
    (value.status !== 'Pending' &&
      value.status !== 'Approved' &&
      value.status !== 'Rejected') ||
    (value.reviewedAt !== null && !isDate(value.reviewedAt))
  ) {
    throw new AdminOpportunityContractError();
  }
  if (value.sourceUrl !== null) {
    try {
      const url = new URL(value.sourceUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new AdminOpportunityContractError();
      }
    } catch {
      throw new AdminOpportunityContractError();
    }
  }
  return {
    id: Number(value.id),
    type: value.type as OpportunityType,
    title: value.title,
    publisher: value.publisher,
    descriptionText: value.descriptionText,
    requirementsText: value.requirementsText,
    workFormat: value.workFormat as WorkFormat | null,
    location: value.location,
    deadline: parseDeadline(value.deadline),
    isVerified: value.isVerified,
    sourceUrl: value.sourceUrl,
    majors: parseNamedIds(value.majors),
    skills: parseNamedIds(value.skills),
    eligibleAcademicYears: value.eligibleAcademicYears as number[],
    createdAt: value.createdAt,
    status: value.status,
    reviewedAt: value.reviewedAt,
  };
}

export function parseAdminOpportunityResponse(
  value: unknown,
): AdminOpportunity {
  if (!isRecord(value) || !Object.hasOwn(value, 'item')) {
    throw new AdminOpportunityContractError();
  }
  return parseAdminOpportunity(value.item);
}

export function parsePendingOpportunities(
  value: unknown,
): PendingOpportunitiesResponse {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !isRecord(value.meta) ||
    !Number.isSafeInteger(value.meta.page) ||
    Number(value.meta.page) < 1 ||
    !Number.isSafeInteger(value.meta.pageSize) ||
    Number(value.meta.pageSize) < 1 ||
    !Number.isSafeInteger(value.meta.total) ||
    Number(value.meta.total) < 0 ||
    !Number.isSafeInteger(value.meta.totalPages) ||
    Number(value.meta.totalPages) < 0
  ) {
    throw new AdminOpportunityContractError();
  }
  return {
    items: value.items.map(parseAdminOpportunity),
    meta: {
      page: Number(value.meta.page),
      pageSize: Number(value.meta.pageSize),
      total: Number(value.meta.total),
      totalPages: Number(value.meta.totalPages),
    },
  };
}

export function lastValidQueuePage(
  requestedPage: number,
  totalPages: number,
): number {
  return Math.min(requestedPage, Math.max(totalPages, 1));
}

export function isReviewTargetCurrent(
  targetId: number | null,
  routeId: string | undefined,
  loadedItemId: number | undefined,
): boolean {
  return (
    targetId !== null &&
    routeId === String(targetId) &&
    loadedItemId === targetId
  );
}

export function parseAdminOpportunityMutation(
  value: unknown,
): AdminOpportunityMutation {
  if (
    !isRecord(value) ||
    !isRecord(value.item) ||
    !Number.isSafeInteger(value.item.id) ||
    Number(value.item.id) < 1 ||
    (value.item.status !== 'Approved' && value.item.status !== 'Rejected') ||
    typeof value.item.isVerified !== 'boolean' ||
    !isDate(value.item.reviewedAt)
  ) {
    throw new AdminOpportunityContractError();
  }
  return {
    id: Number(value.item.id),
    status: value.item.status,
    isVerified: value.item.isVerified,
    reviewedAt: value.item.reviewedAt,
  };
}
