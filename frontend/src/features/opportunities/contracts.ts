export type OpportunityType = 'Thực tập' | 'Việc làm' | 'Học bổng';
export type WorkFormat = 'Online' | 'Offline' | 'Hybrid';

export type OpportunityDeadline =
  | {
      precision: 'date';
      date: string;
      sourceTimeZone: null;
      instant: string;
      state: 'open' | 'expired';
    }
  | {
      precision: 'datetime';
      date: string;
      sourceTimeZone: string;
      instant: string;
      state: 'open' | 'expired';
    }
  | {
      precision: 'unknown';
      date: null;
      sourceTimeZone: null;
      instant: string;
      state: 'unknown';
    };

export interface PublicOpportunitySummary {
  id: number;
  type: OpportunityType;
  title: string;
  publisher: string;
  workFormat: WorkFormat | null;
  location: string | null;
  deadline: OpportunityDeadline | null;
  isVerified: boolean;
}

export interface OpportunityListResponse {
  items: PublicOpportunitySummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    evaluatedAt: string;
  };
}

export interface MajorOption {
  id: number;
  name: string;
  type: 'Major';
}

export interface OpportunityDetailResponse {
  item: PublicOpportunitySummary & {
    descriptionText: string | null;
    requirementsText: string | null;
    sourceUrl: string | null;
    majors: Array<{ id: number; name: string }>;
    skills: Array<{ id: number; name: string }>;
    eligibleAcademicYears: number[];
  };
  meta: { evaluatedAt: string };
}

export interface OpportunityFilters {
  q: string;
  majorId: string;
  type: string;
  workFormat: string;
}

const opportunityTypes = new Set<OpportunityType>([
  'Thực tập',
  'Việc làm',
  'Học bổng',
]);
const workFormats = new Set<WorkFormat>(['Online', 'Offline', 'Hybrid']);
const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function isInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    instantPattern.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function invalidResponse(): OpportunityContractError {
  return new OpportunityContractError();
}

export class OpportunityContractError extends Error {
  readonly code = 'INVALID_RESPONSE';
  readonly kind = 'response';

  constructor() {
    super('Máy chủ trả dữ liệu cơ hội không hợp lệ.');
    this.name = 'OpportunityContractError';
  }
}

function parseDeadline(value: unknown): OpportunityDeadline | null {
  if (value === null) return null;
  if (!isRecord(value) || !isInstant(value.instant)) throw invalidResponse();

  if (
    value.precision === 'date' &&
    isDate(value.date) &&
    value.sourceTimeZone === null &&
    (value.state === 'open' || value.state === 'expired')
  ) {
    return {
      precision: 'date',
      date: value.date,
      sourceTimeZone: null,
      instant: value.instant,
      state: value.state,
    };
  }

  if (
    value.precision === 'datetime' &&
    isDate(value.date) &&
    typeof value.sourceTimeZone === 'string' &&
    value.sourceTimeZone.length > 0 &&
    (value.state === 'open' || value.state === 'expired')
  ) {
    return {
      precision: 'datetime',
      date: value.date,
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

  throw invalidResponse();
}

function parseSummary(value: unknown): PublicOpportunitySummary {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.id) ||
    typeof value.type !== 'string' ||
    !opportunityTypes.has(value.type as OpportunityType) ||
    typeof value.title !== 'string' ||
    typeof value.publisher !== 'string' ||
    (value.workFormat !== null &&
      (typeof value.workFormat !== 'string' ||
        !workFormats.has(value.workFormat as WorkFormat))) ||
    (value.location !== null && typeof value.location !== 'string') ||
    typeof value.isVerified !== 'boolean'
  ) {
    throw invalidResponse();
  }

  return {
    id: value.id,
    type: value.type as OpportunityType,
    title: value.title,
    publisher: value.publisher,
    workFormat: value.workFormat as WorkFormat | null,
    location: value.location as string | null,
    deadline: parseDeadline(value.deadline),
    isVerified: value.isVerified,
  };
}

function isIsoInstant(value: unknown): value is string {
  return isInstant(value);
}

export function parseOpportunityList(value: unknown): OpportunityListResponse {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !isRecord(value.meta)
  ) {
    throw invalidResponse();
  }
  const { page, pageSize, total, totalPages, evaluatedAt } = value.meta;
  if (
    !isPositiveInteger(page) ||
    page > 1_000_000 ||
    !isPositiveInteger(pageSize) ||
    pageSize > 100 ||
    !isNonNegativeInteger(total) ||
    !isNonNegativeInteger(totalPages) ||
    !isIsoInstant(evaluatedAt)
  ) {
    throw invalidResponse();
  }
  const expectedTotalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  if (totalPages !== expectedTotalPages) throw invalidResponse();
  const items = value.items.map(parseSummary);
  if (items.length > pageSize || items.length > total) throw invalidResponse();
  return { items, meta: { page, pageSize, total, totalPages, evaluatedAt } };
}

export function parseMajorOptions(value: unknown): MajorOption[] {
  if (!isRecord(value) || !Array.isArray(value.items)) throw invalidResponse();
  return value.items.map((item) => {
    if (
      !isRecord(item) ||
      !isPositiveInteger(item.id) ||
      typeof item.name !== 'string' ||
      item.type !== 'Major'
    ) {
      throw invalidResponse();
    }
    return { id: item.id, name: item.name, type: 'Major' };
  });
}

function parseNameLinks(value: unknown): Array<{ id: number; name: string }> {
  if (!Array.isArray(value)) throw invalidResponse();
  return value.map((item) => {
    if (
      !isRecord(item) ||
      !isPositiveInteger(item.id) ||
      typeof item.name !== 'string'
    ) {
      throw invalidResponse();
    }
    return { id: item.id, name: item.name };
  });
}

export function parseOpportunityDetail(
  value: unknown,
): OpportunityDetailResponse {
  if (
    !isRecord(value) ||
    !isRecord(value.item) ||
    !isRecord(value.meta) ||
    !isIsoInstant(value.meta.evaluatedAt)
  ) {
    throw invalidResponse();
  }
  const summary = parseSummary(value.item);
  const {
    descriptionText,
    requirementsText,
    sourceUrl,
    eligibleAcademicYears,
  } = value.item;
  if (
    (descriptionText !== null && typeof descriptionText !== 'string') ||
    (requirementsText !== null && typeof requirementsText !== 'string') ||
    (sourceUrl !== null && typeof sourceUrl !== 'string') ||
    !Array.isArray(eligibleAcademicYears) ||
    !eligibleAcademicYears.every(
      (year) => Number.isInteger(year) && year >= 1 && year <= 4,
    )
  ) {
    throw invalidResponse();
  }
  if (typeof sourceUrl === 'string') {
    let parsedSource: URL;
    try {
      parsedSource = new URL(sourceUrl);
    } catch {
      throw invalidResponse();
    }
    if (
      parsedSource.protocol !== 'https:' &&
      parsedSource.protocol !== 'http:'
    ) {
      throw invalidResponse();
    }
  }
  return {
    item: {
      ...summary,
      descriptionText,
      requirementsText,
      sourceUrl,
      majors: parseNameLinks(value.item.majors),
      skills: parseNameLinks(value.item.skills),
      eligibleAcademicYears: eligibleAcademicYears as number[],
    },
    meta: { evaluatedAt: value.meta.evaluatedAt },
  };
}

export function buildOpportunityQuery(
  filters: OpportunityFilters,
  options: { page?: number; pageSize?: number } = {},
): URLSearchParams {
  const query = new URLSearchParams();
  const keyword = filters.q.trim().normalize('NFC');
  if (keyword) query.set('q', keyword);
  if (filters.majorId.trim()) query.set('majorId', filters.majorId.trim());
  if (filters.type) query.set('type', filters.type);
  if (filters.workFormat) query.set('workFormat', filters.workFormat);
  if (options.page !== undefined && options.page > 1) {
    query.set('page', String(options.page));
  }
  if (options.pageSize !== undefined && options.pageSize !== 20) {
    query.set('pageSize', String(options.pageSize));
  }
  return query;
}

export function filtersFromSearch(search: string): OpportunityFilters {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  );
  return {
    q: params.get('q') ?? '',
    majorId: params.get('majorId') ?? '',
    type: params.get('type') ?? '',
    workFormat: params.get('workFormat') ?? '',
  };
}

export function hasOpportunityFilters(search: string): boolean {
  const filters = filtersFromSearch(search);
  return Boolean(
    filters.q.trim() ||
      filters.majorId.trim() ||
      filters.type ||
      filters.workFormat,
  );
}

export function pageFromSearch(search: string): number {
  const value = new URLSearchParams(search).get('page');
  return value && /^\d+$/.test(value) ? Number(value) : 1;
}

export function pageSizeFromSearch(search: string): number | undefined {
  const value = new URLSearchParams(search).get('pageSize');
  if (!value || !/^\d+$/.test(value)) return undefined;
  const pageSize = Number(value);
  return pageSize >= 1 && pageSize <= 100 ? pageSize : undefined;
}

export function formatOpportunityDate(date: string): string {
  if (!isDate(date)) return '';
  const [, year, month, day] = datePattern.exec(date)!;
  return `${day}/${month}/${year}`;
}
