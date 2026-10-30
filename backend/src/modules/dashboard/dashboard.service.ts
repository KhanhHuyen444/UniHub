import type { PrismaClient } from '../../generated/prisma/client.js';

function formatInstant(value: Date): string {
  return value.toISOString().replace('.000Z', 'Z');
}

export async function getAccountMetric(
  client: PrismaClient,
  evaluatedAt: Date,
) {
  const totalAccounts = await client.user.count();
  return { totalAccounts, evaluatedAt: formatInstant(evaluatedAt) };
}

export async function getOpportunityMetric(
  client: PrismaClient,
  evaluatedAt: Date,
) {
  const groups = await client.opportunity.groupBy({
    by: ['status'],
    where: {
      opportunity_type: { in: ['Thực tập', 'Việc làm', 'Học bổng'] },
      status: { in: ['Pending', 'Approved', 'Rejected'] },
    },
    _count: { _all: true },
  });
  const byStatus = { Pending: 0, Approved: 0, Rejected: 0 };
  for (const group of groups) {
    if (
      group.status === 'Pending' ||
      group.status === 'Approved' ||
      group.status === 'Rejected'
    )
      byStatus[group.status] = group._count._all;
  }
  return { byStatus, evaluatedAt: formatInstant(evaluatedAt) };
}

export async function getForumMetric(client: PrismaClient, evaluatedAt: Date) {
  const [posts, comments] = await Promise.all([
    client.forumPost.count({ where: { is_deleted: false } }),
    client.comment.count({
      where: { is_deleted: false, post: { is_deleted: false } },
    }),
  ]);
  return { posts, comments, evaluatedAt: formatInstant(evaluatedAt) };
}
