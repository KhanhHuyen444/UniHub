import type { PrismaClient } from '../../generated/prisma/client.js';
import { Prisma } from '../../generated/prisma/client.js';

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
  // Explicit case/accent-sensitive predicates match Public Opportunities even
  // when the database default collation is case-insensitive. Aggregate in SQL;
  // never load descriptions or individual opportunity rows for this metric.
  const groups = await client.$queryRaw<
    Array<{ status: string; count: bigint | number }>
  >(
    Prisma.sql`SELECT status, COUNT(*) AS count FROM opportunities
      WHERE opportunity_type COLLATE utf8mb4_0900_as_cs IN (${'Thực tập'}, ${'Việc làm'}, ${'Học bổng'})
        AND status COLLATE utf8mb4_0900_as_cs IN (${'Pending'}, ${'Approved'}, ${'Rejected'})
      GROUP BY status`,
  );
  const byStatus = { Pending: 0, Approved: 0, Rejected: 0 };
  for (const group of groups) {
    if (
      group.status === 'Pending' ||
      group.status === 'Approved' ||
      group.status === 'Rejected'
    ) {
      const count = Number(group.count);
      if (!Number.isSafeInteger(count) || count < 0)
        throw new Error('Invalid opportunity count.');
      byStatus[group.status] = count;
    }
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
