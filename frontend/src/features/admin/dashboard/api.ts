import { ApiError } from '../../../lib/api';
import { protectedApiRequest } from '../../auth/auth-api';

export interface AccountMetric {
  totalAccounts: number;
  evaluatedAt: string;
}
export interface OpportunityMetric {
  byStatus: { Pending: number; Approved: number; Rejected: number };
  evaluatedAt: string;
}
export interface ForumMetric {
  posts: number;
  comments: number;
  evaluatedAt: string;
}
function invalid(): never {
  throw new ApiError('Dữ liệu Dashboard không hợp lệ.', {
    code: 'INVALID_RESPONSE',
    kind: 'response',
  });
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function envelope(
  value: unknown,
): asserts value is Record<string, unknown> & { evaluatedAt: string } {
  if (
    !record(value) ||
    typeof value.evaluatedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(
      value.evaluatedAt,
    ) ||
    !Number.isFinite(Date.parse(value.evaluatedAt)) ||
    new Date(value.evaluatedAt).toISOString().slice(0, 19) !==
      value.evaluatedAt.slice(0, 19)
  )
    invalid();
}
export function parseAccounts(value: unknown): AccountMetric {
  envelope(value);
  if (!count(value.totalAccounts)) return invalid();
  return { totalAccounts: value.totalAccounts, evaluatedAt: value.evaluatedAt };
}
export function parseOpportunities(value: unknown): OpportunityMetric {
  envelope(value);
  const statuses = value.byStatus;
  if (
    !record(statuses) ||
    !count(statuses.Pending) ||
    !count(statuses.Approved) ||
    !count(statuses.Rejected)
  )
    return invalid();
  return {
    byStatus: {
      Pending: statuses.Pending,
      Approved: statuses.Approved,
      Rejected: statuses.Rejected,
    },
    evaluatedAt: value.evaluatedAt,
  };
}
export function parseForum(value: unknown): ForumMetric {
  envelope(value);
  if (!count(value.posts) || !count(value.comments)) return invalid();
  return {
    posts: value.posts,
    comments: value.comments,
    evaluatedAt: value.evaluatedAt,
  };
}
export const getAccounts = async (signal: AbortSignal) =>
  parseAccounts(
    await protectedApiRequest('/api/admin/dashboard/accounts', { signal }),
  );
export const getOpportunities = async (signal: AbortSignal) =>
  parseOpportunities(
    await protectedApiRequest('/api/admin/dashboard/opportunities', { signal }),
  );
export const getForum = async (signal: AbortSignal) =>
  parseForum(
    await protectedApiRequest('/api/admin/dashboard/forum', { signal }),
  );
