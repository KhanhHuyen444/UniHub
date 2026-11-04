import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getPrismaClient, disconnectPrismaClient } from '../lib/prisma.js';
import {
  extractOfficialSources,
  processCollectedOpportunities,
  formatNeedsReviewCsv,
} from './opportunities-collector.js';
import type { OfficialPageSource } from './opportunities-collector.js';

// Read-only companion CLI. Never calls the importer or grants leader approval.
async function main() {
  const prisma = getPrismaClient();
  try {
    const categories = await prisma.category.findMany({
      where: { status: 'Active' },
      select: { type: true, name: true, category_id: true },
    });
    const catalog = {
      majors: new Map(
        categories
          .filter((c) => c.type === 'Major')
          .map((c) => [c.name, c.category_id]),
      ),
      skills: new Map(
        categories
          .filter((c) => c.type === 'Skill')
          .map((c) => [c.name, c.category_id]),
      ),
    };
    if (catalog.majors.size !== 117 || catalog.skills.size !== 328)
      throw new Error('Active catalog differs from 117 Major / 328 Skill.');
    const existing = await prisma.opportunity.findMany({
      select: { item_id: true, source_url: true, title: true, publisher: true },
    });
    const databaseRows = existing.length;
    const output = resolve('data/opportunities/source-coverage-proposals.json');
    let oldBatchRows = 0;
    for (const directory of ['data/opportunities', '.']) {
      for (const file of await readdir(directory)) {
        if (!file.endsWith('.json')) continue;
        const path = resolve(directory, file);
        if (path === output) continue;
        const old = JSON.parse(await readFile(path, 'utf8'));
        if (!Array.isArray(old?.items)) continue;
        for (const record of old.items) {
          const o = record.opportunity;
          if (o?.source_url && o?.title) {
            existing.push({
              item_id: 0,
              source_url: o.source_url,
              title: o.title,
              publisher: o.publisher,
            });
            oldBatchRows++;
          }
        }
      }
    }
    const sources: OfficialPageSource[] = JSON.parse(
      await readFile('data/opportunities/official-sources.json', 'utf8'),
    );
    const extracted = await extractOfficialSources(sources);
    const result = await processCollectedOpportunities(
      extracted.items,
      catalog,
      existing,
    );
    const review = [...extracted.needsReview, ...result.needsReviewRows];
    const proposals = result.importCandidatesBatch.items;
    const report = {
      checkedAt: new Date().toISOString(),
      writes: 0,
      databaseRows,
      oldBatchRows,
      catalog: { majors: catalog.majors.size, skills: catalog.skills.size },
      sources: [...new Set(sources.map((s) => s.item.publisher))].map(
        (publisher) => {
          const attempted = sources.filter(
            (s) => s.item.publisher === publisher,
          ).length;
          const proposed = proposals.filter(
            (x) => x.opportunity.publisher === publisher,
          ).length;
          return {
            publisher,
            attempted,
            proposed,
            acceptanceRate: proposed / attempted,
          };
        },
      ),
      byType: Object.fromEntries(
        ['Vi\u1ec7c l\u00e0m', 'Th\u1ef1c t\u1eadp', 'H\u1ecdc b\u1ed5ng'].map(
          (type) => [
            type,
            proposals.filter((x) => x.opportunity.opportunity_type === type)
              .length,
          ],
        ),
      ),
      proposed: proposals.length,
      needsReview: review.length,
      missingFrom60: Math.max(0, 60 - proposals.length),
    };
    await writeFile(
      output,
      JSON.stringify(result.importCandidatesBatch, null, 2) + '\n',
    );
    await writeFile(
      'data/opportunities/source-coverage-needs-review.csv',
      formatNeedsReviewCsv(review),
    );
    await writeFile(
      'data/opportunities/source-coverage-report.json',
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await disconnectPrismaClient();
  }
}
main().catch(() => {
  console.error(
    'Official-source collection failed; database/evidence unavailable or input invalid. No writes performed.',
  );
  process.exitCode = 1;
});
