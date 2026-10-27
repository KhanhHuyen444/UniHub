import type { PrismaClient } from '../../generated/prisma/client.js';

export type CategoryReadClient = Pick<PrismaClient, 'category'>;

export async function listActiveMajors(client: CategoryReadClient) {
  const categories = await client.category.findMany({
    where: { type: 'Major', status: 'Active' },
    select: { category_id: true, name: true, type: true },
    orderBy: [{ name: 'asc' }, { category_id: 'asc' }],
  });

  return {
    items: categories.map(({ category_id, name, type }) => ({
      id: category_id,
      name,
      type,
    })),
  };
}
