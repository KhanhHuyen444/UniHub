import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  getPrismaClient,
  disconnectPrismaClient,
} from '../../../backend/dist/lib/prisma.js';

export async function syncDataRefinement(
  options = { apply: false },
  prismaClient = null,
) {
  const isApply = Boolean(options.apply);
  const mode = isApply ? 'APPLY' : 'DRY-RUN';
  console.log(`\n======================================================`);
  console.log(`=== UniHub Final Data Refinement Sync [${mode}] ===`);
  console.log(`======================================================\n`);

  const prisma = prismaClient ?? getPrismaClient();

  const dbRes = await prisma.$queryRawUnsafe('SELECT DATABASE() as db');
  const targetDb = dbRes[0]?.db;
  console.log(`Target Database: "${targetDb}"`);

  // SAFETY RULE: Never touch unihub_dev!
  assert.notEqual(
    targetDb,
    'unihub_dev',
    'CRITICAL SAFETY ERROR: sync-data-refinement must NEVER run against unihub_dev!',
  );

  // 1. Load data files
  const batchPath = path.resolve('data/opportunities/demo/batch-proposal.json');
  const coverageFixturePath = path.resolve(
    'data/opportunities/demo/major-coverage-fixture.json',
  );
  const devFixturePath = path.resolve(
    'data/opportunities/demo/dev-opportunities-fixture.json',
  );

  const batch = JSON.parse(await readFile(batchPath, 'utf8'));
  const coverageItems = JSON.parse(await readFile(coverageFixturePath, 'utf8'));
  const devItems = JSON.parse(await readFile(devFixturePath, 'utf8'));

  assert.equal(coverageItems.length, 6, 'Coverage fixture must have 6 items');
  assert.equal(devItems.length, 11, 'Dev fixture must have 11 items');

  // Categories map
  const categories = await prisma.category.findMany({
    select: { category_id: true, type: true, name: true },
  });
  const catMap = new Map(
    categories.map((c) => [`${c.type}:${c.name}`, c.category_id]),
  );

  // Admin user
  const adminUser = await prisma.user.findFirst({
    where: { role: 'Admin' },
    select: { user_id: true },
  });
  const adminId = adminUser?.user_id ?? null;

  // Filter synthetic items to refine from batch (40 internships + 25 scholarships)
  const syntheticToRefine = batch.items.filter(
    (x) =>
      x.opportunity.opportunity_type === 'Học bổng' ||
      x.opportunity.opportunity_type === 'Thực tập',
  );
  assert.equal(
    syntheticToRefine.length,
    65,
    'Must have exactly 65 synthetic items (40 internships + 25 scholarships) in batch',
  );

  // Check plan counters
  const plan = {
    syntheticToUpdate: [],
    coverageToCreate: [],
    coverageToUpdate: [],
    devFixturesUnchanged: 0,
    devFixturesModified: 0,
    recordsToDelete: 0,
  };

  // Analyze Refined Synthetic Opportunities
  for (const item of syntheticToRefine) {
    const o = item.opportunity;
    const existing = await prisma.opportunity.findFirst({
      where: { source_url: o.source_url },
      select: {
        item_id: true,
        title: true,
        publisher: true,
        description: true,
        requirements: true,
        status: true,
        is_verified: true,
      },
    });
    assert(
      existing,
      `Existing synthetic opportunity not found for URL: ${o.source_url}`,
    );
    assert.equal(existing.status, 'Approved');
    assert.equal(existing.is_verified, true);

    const isDifferent =
      existing.title !== o.title ||
      existing.publisher !== o.publisher ||
      existing.description !== o.description ||
      existing.requirements !== o.requirements;

    plan.syntheticToUpdate.push({
      item_id: existing.item_id,
      source_url: o.source_url,
      currentTitle: existing.title,
      newTitle: o.title,
      currentPublisher: existing.publisher,
      newPublisher: o.publisher,
      isDifferent,
      newItem: o,
    });
  }

  // Analyze Coverage items (6 items)
  for (const item of coverageItems) {
    const existing = await prisma.opportunity.findFirst({
      where: { source_url: item.source_url },
      select: { item_id: true, title: true, status: true },
    });
    if (existing) {
      plan.coverageToUpdate.push({ item, existingId: existing.item_id });
    } else {
      plan.coverageToCreate.push(item);
    }
  }

  // Analyze Dev fixtures (11 items) - confirm 0 changes
  for (const item of devItems) {
    const existing = await prisma.opportunity.findFirst({
      where: { source_url: item.source_url, title: item.title },
      select: { item_id: true, status: true, is_verified: true },
    });
    if (
      existing &&
      existing.status === item.status &&
      existing.is_verified === item.is_verified
    ) {
      plan.devFixturesUnchanged++;
    } else {
      plan.devFixturesModified++;
    }
  }

  // Print Plan
  console.log(`--- Dry-run Execution Plan ---`);
  console.log(
    `1. Refined Synthetic Opportunities to update: ${plan.syntheticToUpdate.length} records ` +
      `(${plan.syntheticToUpdate.filter((s) => s.isDifferent).length} content changed)`,
  );
  console.log(
    `2. Major Coverage Opportunities to create: ${plan.coverageToCreate.length} records`,
  );
  console.log(
    `3. Major Coverage Opportunities to update: ${plan.coverageToUpdate.length} records`,
  );
  console.log(
    `4. Dev Fixture Opportunities unchanged: ${plan.devFixturesUnchanged} / 11 records (0 modified: ${plan.devFixturesModified === 0})`,
  );
  console.log(`5. Records to delete: ${plan.recordsToDelete} records`);

  console.log(`\nSample Refined Synthetic Updates (First 5):`);
  for (const s of plan.syntheticToUpdate
    .filter((s) => s.isDifferent)
    .slice(0, 5)) {
    console.log(`  [ID ${s.item_id}] ${s.source_url}`);
    console.log(`    OLD: "${s.currentTitle}" (${s.currentPublisher})`);
    console.log(`    NEW: "${s.newTitle}" (${s.newPublisher})`);
  }

  console.log(`\nMajor Coverage Opportunities (All 6):`);
  for (const c of coverageItems) {
    console.log(
      `  [${c.fixture_id}] ${c.opportunity_type} | Major: [${c.majors.join(', ')}] | "${c.title}" (${c.publisher})`,
    );
  }

  if (!isApply) {
    console.log(`\n[DRY-RUN COMPLETE] No database modifications made.`);
    return { plan, applied: false };
  }

  // APPLY CHANGES IN A SERIALIZABLE TRANSACTION
  console.log(`\n--- Applying Changes to Database within Transaction ---`);
  let updatedSyntheticCount = 0;
  let createdCoverageCount = 0;
  let updatedCoverageCount = 0;

  await prisma.$transaction(
    async (tx) => {
      // 1. Update refined synthetic opportunities
      for (const s of plan.syntheticToUpdate) {
        if (s.isDifferent) {
          await tx.opportunity.update({
            where: { item_id: s.item_id },
            data: {
              title: s.newItem.title,
              publisher: s.newItem.publisher,
              description: s.newItem.description,
              requirements: s.newItem.requirements,
            },
          });
          updatedSyntheticCount++;
        }
      }

      // 2. Create or Update 6 coverage opportunities
      for (const item of coverageItems) {
        const existing = await tx.opportunity.findFirst({
          where: { source_url: item.source_url },
        });

        if (existing) {
          await tx.opportunity.update({
            where: { item_id: existing.item_id },
            data: {
              opportunity_type: item.opportunity_type,
              title: item.title,
              publisher: item.publisher,
              description: item.description,
              requirements: item.requirements,
              location: item.location,
              work_format: item.work_format,
              deadline: item.deadline ? new Date(item.deadline) : null,
              deadline_source_date: item.deadline_source_date
                ? new Date(item.deadline_source_date)
                : null,
              deadline_source_timezone: item.deadline_source_timezone,
              status: item.status,
              is_verified: item.is_verified,
              reviewed_by: adminId,
              reviewed_at: existing.reviewed_at ?? new Date(),
            },
          });

          // Re-sync relations
          await tx.opportunityMajor.deleteMany({
            where: { item_id: existing.item_id },
          });
          for (const m of item.majors) {
            const catId = catMap.get(`Major:${m}`);
            assert.ok(catId, `Major category not found: ${m}`);
            await tx.opportunityMajor.create({
              data: { item_id: existing.item_id, major_id: catId },
            });
          }

          await tx.opportunitySkill.deleteMany({
            where: { item_id: existing.item_id },
          });
          for (const sk of item.skills) {
            const catId = catMap.get(`Skill:${sk}`);
            assert.ok(catId, `Skill category not found: ${sk}`);
            await tx.opportunitySkill.create({
              data: { item_id: existing.item_id, skill_id: catId },
            });
          }

          await tx.opportunityYear.deleteMany({
            where: { item_id: existing.item_id },
          });
          for (const y of item.academic_years) {
            await tx.opportunityYear.create({
              data: { item_id: existing.item_id, academic_year: y },
            });
          }
          updatedCoverageCount++;
        } else {
          const created = await tx.opportunity.create({
            data: {
              opportunity_type: item.opportunity_type,
              title: item.title,
              publisher: item.publisher,
              description: item.description,
              requirements: item.requirements,
              location: item.location,
              work_format: item.work_format,
              deadline: item.deadline ? new Date(item.deadline) : null,
              deadline_source_date: item.deadline_source_date
                ? new Date(item.deadline_source_date)
                : null,
              deadline_source_timezone: item.deadline_source_timezone,
              status: item.status,
              is_verified: item.is_verified,
              source_url: item.source_url,
              reviewed_by: adminId,
              reviewed_at: new Date(),
            },
          });

          for (const m of item.majors) {
            const catId = catMap.get(`Major:${m}`);
            assert.ok(catId, `Major category not found: ${m}`);
            await tx.opportunityMajor.create({
              data: { item_id: created.item_id, major_id: catId },
            });
          }

          for (const sk of item.skills) {
            const catId = catMap.get(`Skill:${sk}`);
            assert.ok(catId, `Skill category not found: ${sk}`);
            await tx.opportunitySkill.create({
              data: { item_id: created.item_id, skill_id: catId },
            });
          }

          for (const y of item.academic_years) {
            await tx.opportunityYear.create({
              data: { item_id: created.item_id, academic_year: y },
            });
          }
          createdCoverageCount++;
        }
      }
    },
    { isolationLevel: 'Serializable', timeout: 30000 },
  );

  console.log(
    `[APPLY COMPLETE] ${updatedSyntheticCount} refined synthetic opportunities updated, ${createdCoverageCount} coverage opportunities created, ${updatedCoverageCount} coverage updated.`,
  );

  // POST-SYNC VERIFICATION
  console.log(`\n--- Post-Sync Verification ---`);
  const totalOpps = await prisma.opportunity.count();
  const approvedOpps = await prisma.opportunity.count({
    where: { status: 'Approved' },
  });
  const pendingOpps = await prisma.opportunity.count({
    where: { status: 'Pending' },
  });
  const rejectedOpps = await prisma.opportunity.count({
    where: { status: 'Rejected' },
  });

  console.log(`Total Opportunities: ${totalOpps} (Expected: 117)`);
  console.log(`Approved: ${approvedOpps} (Expected: 114)`);
  console.log(`Pending: ${pendingOpps} (Expected: 2)`);
  console.log(`Rejected: ${rejectedOpps} (Expected: 1)`);

  assert.equal(totalOpps, 117, 'Total opportunities must be exactly 117');
  assert.equal(approvedOpps, 114, 'Approved opportunities must be exactly 114');
  assert.equal(pendingOpps, 2, 'Pending opportunities must be exactly 2');
  assert.equal(rejectedOpps, 1, 'Rejected opportunities must be exactly 1');

  // Major coverage check
  const activeMajors = await prisma.category.findMany({
    where: { type: 'Major', status: 'Active' },
    select: { category_id: true, name: true },
    orderBy: { name: 'asc' },
  });
  assert.equal(activeMajors.length, 117, 'Active majors must be 117');

  const coveredMajors = await prisma.category.findMany({
    where: {
      type: 'Major',
      status: 'Active',
      opportunity_majors: {
        some: {
          opportunity: {
            status: 'Approved',
          },
        },
      },
    },
    select: { category_id: true, name: true },
  });

  const coveredSet = new Set(coveredMajors.map((m) => m.category_id));
  const uncoveredMajors = activeMajors.filter(
    (m) => !coveredSet.has(m.category_id),
  );

  console.log(
    `Majors with Approved Opportunity: ${coveredMajors.length} (Expected: 107)`,
  );
  console.log(`Uncovered Majors: ${uncoveredMajors.length} (Expected: 10)`);
  console.log(
    `Uncovered Majors List:`,
    uncoveredMajors.map((m) => m.name),
  );

  assert.equal(coveredMajors.length, 107, 'Covered majors must be exactly 107');
  assert.equal(
    uncoveredMajors.length,
    10,
    'Uncovered majors must be exactly 10',
  );

  return {
    totalOpps,
    approvedOpps,
    pendingOpps,
    rejectedOpps,
    coveredMajorsCount: coveredMajors.length,
    uncoveredMajors: uncoveredMajors.map((m) => m.name),
    applied: true,
  };
}

if (process.argv[1] && process.argv[1].endsWith('sync-data-refinement.mjs')) {
  const applyFlag = process.argv.includes('--apply');
  syncDataRefinement({ apply: applyFlag })
    .then(async () => {
      await disconnectPrismaClient();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Sync failed:', err);
      await disconnectPrismaClient();
      process.exit(1);
    });
}
