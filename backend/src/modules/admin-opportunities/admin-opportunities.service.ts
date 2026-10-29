import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { ApiError } from '../../middleware/errors.js';
import { writeActivityLog } from '../activity-logs/activity-log.writer.js';
import {
  opportunityRelationsInclude,
  parseOpportunityId,
  toAdminOpportunityItem,
  type OpportunityWithRelations,
} from '../opportunities/opportunities.service.js';

const MAX_PAGE = 1_000_000;
const MAX_PAGE_SIZE = 100;

type ReviewClient = PrismaClient;
type ReviewTransaction = Prisma.TransactionClient;

function notFound(): ApiError {
  return new ApiError(404, 'NOT_FOUND', 'Không tìm thấy cơ hội.');
}

function notPending(): ApiError {
  return new ApiError(
    409,
    'OPPORTUNITY_NOT_PENDING',
    'Cơ hội không còn ở trạng thái chờ duyệt.',
  );
}

function notReviewable(): ApiError {
  return new ApiError(
    422,
    'OPPORTUNITY_NOT_REVIEWABLE',
    'Cơ hội chưa đủ điều kiện để duyệt.',
  );
}

function formatInstant(value: Date): string {
  return value.toISOString().replace('.000Z', 'Z');
}

function requirePending(row: OpportunityWithRelations | null) {
  if (!row) throw notFound();
  if (row.status !== 'Pending') throw notPending();
  return row;
}

function hasContent(value: string | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isReviewable(row: OpportunityWithRelations): boolean {
  if (
    !row.source_url ||
    !hasContent(row.description) ||
    !hasContent(row.requirements) ||
    !hasContent(row.publisher)
  ) {
    return false;
  }

  try {
    const source = new URL(row.source_url);
    if (source.protocol !== 'http:' && source.protocol !== 'https:')
      return false;
  } catch {
    return false;
  }

  if (
    (row.work_format === 'Offline' || row.work_format === 'Hybrid') &&
    !hasContent(row.location)
  ) {
    return false;
  }

  return true;
}

export function parseAdminOpportunityPage(originalUrl: string) {
  const url = new URL(originalUrl, 'http://unihub.invalid');
  const values = new Map<string, string>();
  for (const [key, value] of url.searchParams) {
    if ((key !== 'page' && key !== 'pageSize') || values.has(key)) {
      throw new ApiError(
        400,
        'INVALID_QUERY',
        'Tham số truy vấn không hợp lệ.',
      );
    }
    values.set(key, value);
  }

  const parseInteger = (
    key: 'page' | 'pageSize',
    fallback: number,
    max: number,
  ) => {
    const value = values.get(key);
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(value)) {
      throw new ApiError(
        400,
        'INVALID_QUERY',
        'Tham số truy vấn không hợp lệ.',
      );
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
      throw new ApiError(
        400,
        'INVALID_QUERY',
        'Tham số truy vấn không hợp lệ.',
      );
    }
    return parsed;
  };

  return {
    page: parseInteger('page', 1, MAX_PAGE),
    pageSize: parseInteger('pageSize', 20, MAX_PAGE_SIZE),
  };
}

export async function listPendingAdminOpportunities(
  client: ReviewClient,
  originalUrl: string,
  evaluatedAt: Date,
) {
  const { page, pageSize } = parseAdminOpportunityPage(originalUrl);
  const result = await client.$transaction(async (transaction) => {
    const where = { status: 'Pending' } satisfies Prisma.OpportunityWhereInput;
    const total = await transaction.opportunity.count({ where });
    const rows = await transaction.opportunity.findMany({
      where,
      include: opportunityRelationsInclude,
      orderBy: [{ created_at: 'asc' }, { item_id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      total,
      items: rows.map((row) => toAdminOpportunityItem(row, evaluatedAt)),
    };
  });

  return {
    items: result.items,
    meta: {
      page,
      pageSize,
      total: result.total,
      totalPages: result.total === 0 ? 0 : Math.ceil(result.total / pageSize),
    },
  };
}

export async function getAdminOpportunity(
  client: ReviewClient,
  rawId: string,
  evaluatedAt: Date,
) {
  const id = parseOpportunityId(rawId);
  const row = await client.opportunity.findUnique({
    where: { item_id: id },
    include: opportunityRelationsInclude,
  });
  if (!row) throw notFound();
  return { item: toAdminOpportunityItem(row, evaluatedAt) };
}

export async function approveOpportunity(
  client: ReviewClient,
  input: { rawId: string; adminId: number; verified: boolean; now: Date },
) {
  const id = parseOpportunityId(input.rawId);
  return client.$transaction(async (transaction) => {
    const current = requirePending(
      await transaction.opportunity.findUnique({
        where: { item_id: id },
        include: opportunityRelationsInclude,
      }),
    );
    if (!isReviewable(current)) throw notReviewable();

    const updated = await conditionallyUpdatePending(transaction, id, {
      status: 'Approved',
      is_verified: input.verified,
      reviewed_by: input.adminId,
      reviewed_at: input.now,
    });

    await writeActivityLog(transaction, {
      adminId: input.adminId,
      actionType: 'APPROVE_OPPORTUNITY',
      targetType: 'Opportunity',
      targetId: id,
      oldValue: { status: 'Pending', is_verified: current.is_verified },
      newValue: { status: 'Approved', is_verified: input.verified },
    });

    return {
      item: {
        id,
        status: updated.status,
        isVerified: updated.is_verified,
        reviewedAt: formatInstant(updated.reviewed_at!),
      },
    };
  });
}

export async function rejectOpportunity(
  client: ReviewClient,
  input: { rawId: string; adminId: number; reason: string; now: Date },
) {
  const id = parseOpportunityId(input.rawId);
  return client.$transaction(async (transaction) => {
    const current = requirePending(
      await transaction.opportunity.findUnique({
        where: { item_id: id },
        include: opportunityRelationsInclude,
      }),
    );
    const updated = await conditionallyUpdatePending(transaction, id, {
      status: 'Rejected',
      is_verified: false,
      reviewed_by: input.adminId,
      reviewed_at: input.now,
    });

    await writeActivityLog(transaction, {
      adminId: input.adminId,
      actionType: 'REJECT_OPPORTUNITY',
      targetType: 'Opportunity',
      targetId: id,
      oldValue: { status: 'Pending', is_verified: current.is_verified },
      newValue: { status: 'Rejected', is_verified: false },
      reason: input.reason,
    });

    return {
      item: {
        id,
        status: updated.status,
        isVerified: updated.is_verified,
        reviewedAt: formatInstant(updated.reviewed_at!),
      },
    };
  });
}

async function conditionallyUpdatePending(
  transaction: ReviewTransaction,
  id: number,
  data: Prisma.OpportunityUncheckedUpdateManyInput,
) {
  const result = await transaction.opportunity.updateMany({
    where: { item_id: id, status: 'Pending' },
    data,
  });
  if (result.count !== 1) throw notPending();

  const updated = await transaction.opportunity.findUnique({
    where: { item_id: id },
    select: {
      status: true,
      is_verified: true,
      reviewed_at: true,
    },
  });
  if (!updated?.reviewed_at)
    throw new Error('Updated review timestamp missing.');
  return updated;
}
