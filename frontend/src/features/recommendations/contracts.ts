import type { PublicOpportunitySummary } from '../opportunities/contracts';

export type RecommendationDeadline = Exclude<
  PublicOpportunitySummary['deadline'],
  { precision: 'unknown' }
>;
export interface RecommendedOpportunity
  extends Omit<PublicOpportunitySummary, 'deadline'> {
  deadline: RecommendationDeadline;
  matchScore: number;
}
export interface RecommendationsResponse {
  items: RecommendedOpportunity[];
  meta: { evaluatedAt: string };
}
export class RecommendationsContractError extends Error {
  readonly code = 'INVALID_RESPONSE';
  readonly kind = 'response';
  constructor() {
    super('Dữ liệu gợi ý cơ hội không hợp lệ.');
    this.name = 'RecommendationsContractError';
  }
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
function isInstant(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    return false;
  return (
    new Date(value).toISOString() ===
    value.replace(
      /(?:\.(\d{1,3}))?Z$/,
      (_match, digits: string | undefined) =>
        `.${(digits ?? '').padEnd(3, '0')}Z`,
    )
  );
}
function invalid(): never {
  throw new RecommendationsContractError();
}
function deadline(value: unknown, evaluatedAt: string): RecommendationDeadline {
  if (value === null) return null;
  if (
    !record(value) ||
    !isInstant(value.instant) ||
    !isDate(value.date) ||
    value.state !== 'open'
  )
    return invalid();
  const instant = Date.parse(value.instant),
    evaluated = Date.parse(evaluatedAt);
  if (
    value.precision === 'date' &&
    value.sourceTimeZone === null &&
    instant > evaluated
  )
    return {
      precision: 'date',
      date: value.date,
      instant: value.instant,
      sourceTimeZone: null,
      state: 'open',
    };
  if (
    value.precision === 'datetime' &&
    typeof value.sourceTimeZone === 'string' &&
    value.sourceTimeZone.trim() &&
    instant >= evaluated
  )
    return {
      precision: 'datetime',
      date: value.date,
      instant: value.instant,
      sourceTimeZone: value.sourceTimeZone,
      state: 'open',
    };
  return invalid();
}
export function parseRecommendations(value: unknown): RecommendationsResponse {
  if (
    !record(value) ||
    !Array.isArray(value.items) ||
    !record(value.meta) ||
    !isInstant(value.meta.evaluatedAt)
  )
    return invalid();
  const evaluatedAt = value.meta.evaluatedAt;
  const ids = new Set<number>();
  const items = value.items.map((item: unknown): RecommendedOpportunity => {
    if (
      !record(item) ||
      typeof item.id !== 'number' ||
      !Number.isInteger(item.id) ||
      item.id < 1 ||
      item.id > 2_147_483_647 ||
      ids.has(item.id) ||
      typeof item.type !== 'string' ||
      !['Thực tập', 'Việc làm', 'Học bổng'].includes(item.type) ||
      typeof item.title !== 'string' ||
      typeof item.publisher !== 'string' ||
      typeof item.isVerified !== 'boolean' ||
      (item.workFormat !== null &&
        (typeof item.workFormat !== 'string' ||
          !['Online', 'Offline', 'Hybrid'].includes(item.workFormat))) ||
      (item.location !== null && typeof item.location !== 'string') ||
      (item.workFormat === 'Online' && item.location !== null) ||
      typeof item.matchScore !== 'number' ||
      !Number.isFinite(item.matchScore) ||
      item.matchScore < 0.5 ||
      item.matchScore > 1 ||
      Math.abs(item.matchScore * 10000 - Math.round(item.matchScore * 10000)) >
        1e-8
    )
      return invalid();
    ids.add(item.id);
    return {
      id: item.id,
      type: item.type as RecommendedOpportunity['type'],
      title: item.title,
      publisher: item.publisher,
      workFormat: item.workFormat as RecommendedOpportunity['workFormat'],
      location: item.location as string | null,
      isVerified: item.isVerified,
      deadline: deadline(item.deadline, evaluatedAt),
      matchScore: item.matchScore,
    };
  });
  // Rounded scores may tie even though raw scores differ. The server alone owns
  // threshold/ranking; preserve its order rather than sorting displayed values.
  return { items, meta: { evaluatedAt } };
}
