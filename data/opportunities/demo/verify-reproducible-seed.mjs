import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createPrismaClient } from '../../../backend/dist/lib/prisma.js';
import {
  importCategories,
  importOpportunities,
} from '../../../backend/dist/scripts/opportunities-import.js';
import { seedDevOpportunities } from './seed-dev-opportunities.mjs';
import { seedMajorCoverageOpportunities } from './seed-major-coverage.mjs';

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      env[trimmed.slice(0, eqIdx).trim()] = val;
    }
  }
  return env;
}

export async function verifyReproducibleSeed(
  targetDbName = 'unihub_demo_disposable',
) {
  console.log(
    `=== UniHub Reproducible Seed Verification on "${targetDbName}" ===`,
  );

  const demoAppEnv = parseEnv('backend/.env.demo');
  const demoMigEnv = parseEnv('backend/.env.demo.migration');

  assert.ok(
    demoAppEnv.DATABASE_URL,
    'DATABASE_URL is required in backend/.env.demo',
  );
  assert.ok(
    demoMigEnv.MIGRATION_DATABASE_URL,
    'MIGRATION_DATABASE_URL is required in backend/.env.demo.migration',
  );

  // Build target URLs
  const appUrl = new URL(demoAppEnv.DATABASE_URL);
  appUrl.pathname = `/${targetDbName}`;
  const targetAppUrl = appUrl.toString();

  const migUrl = new URL(demoMigEnv.MIGRATION_DATABASE_URL);
  migUrl.pathname = `/${targetDbName}`;
  const targetMigUrl = migUrl.toString();

  // Test connection to target DB
  const testClient = createPrismaClient(targetAppUrl);
  try {
    const dbRes = await testClient.$queryRawUnsafe('SELECT DATABASE() as db');
    console.log(
      `[PASS] Connected to target disposable database: "${dbRes[0]?.db}"`,
    );
  } catch (err) {
    console.error(`[FAIL] Cannot connect to "${targetDbName}": ${err.message}`);
    await testClient.$disconnect();
    throw new Error(
      `Disposable database "${targetDbName}" does not exist or user lacks access. ` +
        `Please create it and grant permissions:\n` +
        `CREATE DATABASE ${targetDbName};\n` +
        `GRANT ALL PRIVILEGES ON ${targetDbName}.* TO '${migUrl.username}'@'localhost';\n` +
        `GRANT ALL PRIVILEGES ON ${targetDbName}.* TO '${appUrl.username}'@'localhost';\n` +
        `FLUSH PRIVILEGES;`,
    );
  }

  // Step 1: Deploy Prisma Migrations
  console.log('\n--- Step 1: Deploying Prisma Migrations ---');
  const prismaBin = path.resolve('node_modules/prisma/build/index.js');
  const backendDir = path.resolve('backend');

  const migrateOutput = execFileSync(
    process.execPath,
    [prismaBin, 'migrate', 'deploy', '--config', 'prisma.config.ts'],
    {
      cwd: backendDir,
      env: {
        ...process.env,
        MIGRATION_DATABASE_URL: targetMigUrl,
      },
      encoding: 'utf8',
    },
  );
  console.log(migrateOutput.trim());

  // Step 2: Seed Catalog (445 Active Categories)
  console.log(
    '\n--- Step 2: Seeding Catalog (117 Major + 328 Skill Active) ---',
  );
  const catalogPath = path.resolve('data/opportunities/demo/catalog.json');
  const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  const catResult = await importCategories(testClient, catalogData, {
    dryRun: false,
    strict: true,
  });
  console.log(
    `Catalog Import Result: created=${catResult.created}, reused=${catResult.reused}, writes=${catResult.writes}`,
  );
  const totalCategories = await testClient.category.count();
  console.log(`Total categories in DB: ${totalCategories}`);
  assert.equal(
    totalCategories,
    445,
    'Must have exactly 445 categories in database',
  );

  // Step 3: Import 100 Synthetic Opportunities Batch
  console.log('\n--- Step 3: Importing 100 Synthetic Opportunities Batch ---');
  const batchPath = path.resolve('data/opportunities/demo/batch-proposal.json');
  const batchData = JSON.parse(fs.readFileSync(batchPath, 'utf8'));

  const oppResult = await importOpportunities(testClient, batchData, {
    dryRun: false,
    batchPath,
  });
  console.log(
    `Batch Import Result: created=${oppResult.created}, writes=${oppResult.writes}`,
  );
  assert.equal(
    oppResult.created,
    100,
    'Batch must create exactly 100 opportunities',
  );

  // Step 4: Seed 11 Dev Fixture Opportunities
  console.log('\n--- Step 4: Seeding 11 Dev Fixture Opportunities ---');
  const seedResult = await seedDevOpportunities(testClient);
  console.log(
    `Dev Fixture Seed Result: created=${seedResult.createdCount}, updated=${seedResult.updatedCount}`,
  );
  assert.equal(
    seedResult.createdCount,
    11,
    'Dev fixture seed must create exactly 11 opportunities',
  );

  // Step 4b: Seed 6 Major Coverage Opportunities
  console.log('\n--- Step 4b: Seeding 6 Major Coverage Opportunities ---');
  const covResult = await seedMajorCoverageOpportunities(testClient);
  console.log(
    `Major Coverage Seed Result: created=${covResult.createdCount}, updated=${covResult.updatedCount}`,
  );
  assert.equal(
    covResult.createdCount,
    6,
    'Major coverage seed must create exactly 6 opportunities',
  );

  // Step 5: Verify Status Breakdown and Relations
  console.log('\n--- Step 5: Verifying Statuses, Breakdown, and Relations ---');
  const totalOpps = await testClient.opportunity.count();
  console.log(`Total Opportunities: ${totalOpps}`);
  assert.equal(totalOpps, 117, 'Total opportunities must be exactly 117');

  const approvedCount = await testClient.opportunity.count({
    where: { status: 'Approved' },
  });
  const pendingCount = await testClient.opportunity.count({
    where: { status: 'Pending' },
  });
  const rejectedCount = await testClient.opportunity.count({
    where: { status: 'Rejected' },
  });

  console.log(
    `Status breakdown: Approved=${approvedCount}, Pending=${pendingCount}, Rejected=${rejectedCount}`,
  );
  assert.equal(approvedCount, 114, 'Approved count must be exactly 114');
  assert.equal(
    pendingCount,
    2,
    'Pending count must be exactly 2 (TEST-ADMIN-01 & TEST-ADMIN-02)',
  );
  assert.equal(
    rejectedCount,
    1,
    'Rejected count must be exactly 1 (TEST-ADMIN-03)',
  );

  // Verify Major Coverage (107 covered, 10 uncovered)
  const coveredMajors = await testClient.category.findMany({
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
  console.log(`Covered Active Majors: ${coveredMajors.length} (Expected: 107)`);
  assert.equal(coveredMajors.length, 107, 'Covered majors must be exactly 107');

  // Step 6: Idempotency Re-run
  console.log('\n--- Step 6: Verifying Idempotency (Re-running Seeds) ---');
  const rerunCat = await importCategories(testClient, catalogData, {
    dryRun: false,
    strict: true,
  });
  console.log(
    `Re-run Catalog: created=${rerunCat.created}, reused=${rerunCat.reused}, writes=${rerunCat.writes}`,
  );
  assert.equal(
    rerunCat.created,
    0,
    'Re-run catalog must create 0 new categories',
  );

  const rerunOpp = await importOpportunities(testClient, batchData, {
    dryRun: false,
    batchPath,
  });
  console.log(
    `Re-run Batch 100: created=${rerunOpp.created}, writes=${rerunOpp.writes}`,
  );
  assert.equal(
    rerunOpp.created,
    0,
    'Re-run batch must create 0 opportunities (no duplicates)',
  );

  const rerunDev = await seedDevOpportunities(testClient);
  console.log(
    `Re-run Dev Fixtures: created=${rerunDev.createdCount}, updated=${rerunDev.updatedCount}`,
  );
  assert.equal(
    rerunDev.createdCount,
    0,
    'Re-run dev fixtures must create 0 new opportunities',
  );
  assert.equal(
    rerunDev.updatedCount,
    11,
    'Re-run dev fixtures must update/sync 11 existing opportunities',
  );

  const rerunCov = await seedMajorCoverageOpportunities(testClient);
  console.log(
    `Re-run Major Coverage: created=${rerunCov.createdCount}, updated=${rerunCov.updatedCount}`,
  );
  assert.equal(
    rerunCov.createdCount,
    0,
    'Re-run major coverage must create 0 new opportunities',
  );
  assert.equal(
    rerunCov.updatedCount,
    6,
    'Re-run major coverage must update/sync 6 existing opportunities',
  );

  const finalTotal = await testClient.opportunity.count();
  console.log(`Final Total Opportunities after re-run: ${finalTotal}`);
  assert.equal(
    finalTotal,
    117,
    'Final count must remain exactly 117 with zero duplicates',
  );

  await testClient.$disconnect();
  console.log(
    '\n[SUCCESS] Full reproducible seed verification PASSED on disposable database!',
  );
  return true;
}

if (
  process.argv[1] &&
  process.argv[1].endsWith('verify-reproducible-seed.mjs')
) {
  const dbName = process.argv[2] || 'unihub_demo_disposable';
  verifyReproducibleSeed(dbName)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
