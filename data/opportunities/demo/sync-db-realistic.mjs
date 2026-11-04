import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getPrismaClient,
  disconnectPrismaClient,
} from '../../../backend/dist/lib/prisma.js';

async function main() {
  const batch = JSON.parse(
    await readFile(new URL('./batch-proposal.json', import.meta.url), 'utf8'),
  );
  assert.equal(batch.items.length, 100);

  const prisma = getPrismaClient();
  try {
    const dbName = await prisma.$queryRaw`SELECT DATABASE() as db`;
    console.log('Connected database:', dbName[0]?.db);
    assert.equal(
      dbName[0]?.db,
      'unihub_demo',
      'SAFETY CHECK: Target database must be unihub_demo',
    );

    let updatedCount = 0;
    await prisma.$transaction(async (tx) => {
      for (const item of batch.items) {
        const o = item.opportunity;
        const existing = await tx.opportunity.findFirst({
          where: { source_url: o.source_url },
          select: { item_id: true, status: true, is_verified: true },
        });
        assert(existing, `Opportunity not found for ${o.source_url}`);
        assert.equal(
          existing.status,
          'Approved',
          `Expected Approved status for ${o.source_url}`,
        );
        assert.equal(
          existing.is_verified,
          true,
          `Expected is_verified=true for ${o.source_url}`,
        );

        await tx.opportunity.update({
          where: { item_id: existing.item_id },
          data: {
            title: o.title,
            publisher: o.publisher,
            description: o.description,
            requirements: o.requirements,
          },
        });
        updatedCount++;
      }
    });

    console.log(
      `Successfully updated ${updatedCount} opportunities with realistic content.`,
    );
  } finally {
    await disconnectPrismaClient();
  }
}

main().catch((err) => {
  console.error('Update failed:', err);
  process.exit(1);
});
