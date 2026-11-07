/**
 * seed-guidance-demo.mjs
 * Script nạp an toàn dữ liệu Guidance Articles vào MySQL unihub_demo.
 * Tuân thủ Chương 3 UC-03 / FR-03.1 / BR-03.1–03.3 và docs/guidance-api-contract.md.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  getPrismaClient,
  disconnectPrismaClient,
} from '../../../backend/dist/lib/prisma.js';

const TARGET_DB_EXPECTED = 'unihub_demo';
const FIXTURE_PATH = resolve('data/guidance/demo/guidance-fixture.json');

/**
 * Kiểm tra nghiêm ngặt kết nối và database đích.
 * Chặn hoàn toàn unihub_dev hoặc bất kỳ database nào khác.
 */
export async function assertTargetDatabase(prisma) {
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.includes('unihub_dev')) {
    throw new Error(
      `DATABASE SAFETY GUARD: DATABASE_URL chứa "unihub_dev". Script chỉ được phép thao tác trên "${TARGET_DB_EXPECTED}".`,
    );
  }

  const queryResult = await prisma.$queryRawUnsafe('SELECT DATABASE() as db');
  const actualDb = queryResult[0]?.db;

  if (actualDb !== TARGET_DB_EXPECTED) {
    throw new Error(
      `DATABASE SAFETY GUARD: Runtime connection database là "${actualDb}". Yêu cầu bắt buộc phải là "${TARGET_DB_EXPECTED}".`,
    );
  }

  return actualDb;
}

/**
 * Nạp dữ liệu Guidance Articles mẫu.
 * @param {object} options
 * @param {boolean} [options.apply=false] - false: Dry-run; true: Ghi dữ liệu vào database.
 * @param {object} [options.prismaClient=null] - Prisma client tái sử dụng trong test.
 */
export async function seedGuidanceDemo({
  apply = false,
  prismaClient = null,
} = {}) {
  const prisma = prismaClient ?? getPrismaClient();

  const actualDb = await assertTargetDatabase(prisma);

  // Đọc fixture
  const fixtureItems = JSON.parse(await readFile(FIXTURE_PATH, 'utf8'));
  assert.equal(
    fixtureItems.length,
    146,
    'Fixture must contain exactly 146 articles',
  );

  // Lấy toàn bộ Category Active từ database để ánh xạ id
  const categories = await prisma.category.findMany({
    where: { status: 'Active' },
    select: { category_id: true, type: true, name: true },
  });
  const catMap = new Map(
    categories.map((c) => [`${c.type}:${c.name}`, c.category_id]),
  );

  // Kiểm tra tính hợp lệ của toàn bộ Major và Skill trong fixture
  for (const item of fixtureItems) {
    for (const m of item.majors) {
      if (!catMap.has(`Major:${m}`)) {
        throw new Error(
          `Major category không tồn tại trong DB: "${m}" (${item.fixture_key})`,
        );
      }
    }
    for (const s of item.skills) {
      if (!catMap.has(`Skill:${s}`)) {
        throw new Error(
          `Skill category không tồn tại trong DB: "${s}" (${item.fixture_key})`,
        );
      }
    }
  }

  // Tra cứu các bài viết Guidance hiện có trong DB
  const existingArticles = await prisma.opportunity.findMany({
    where: {
      opportunity_type: 'Bài viết định hướng',
      publisher: 'UniHub Ban Cố vấn Học tập & Hướng nghiệp',
    },
    select: {
      item_id: true,
      title: true,
      publisher: true,
      status: true,
    },
  });

  const existingByTitle = new Map(existingArticles.map((a) => [a.title, a]));

  let toCreateCount = 0;
  let toReuseCount = 0;

  const plan = fixtureItems.map((item) => {
    const existing = existingByTitle.get(item.title);
    if (existing) {
      toReuseCount++;
      return { action: 'REUSE', item, existingId: existing.item_id };
    } else {
      toCreateCount++;
      return { action: 'CREATE', item };
    }
  });

  console.log(
    `[Guidance Seed] Database: "${actualDb}" | Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`,
  );
  console.log(
    `[Guidance Seed] Plan: ${toCreateCount} to create, ${toReuseCount} already exist and will be reused.`,
  );

  if (!apply) {
    return {
      mode: 'DRY-RUN',
      targetDb: actualDb,
      fixtureCount: fixtureItems.length,
      toCreateCount,
      toReuseCount,
      appliedCount: 0,
    };
  }

  // Thực hiện ghi dữ liệu trong transaction
  let appliedCount = 0;
  await prisma.$transaction(
    async (tx) => {
      for (const step of plan) {
        if (step.action === 'CREATE') {
          const { item } = step;

          const created = await tx.opportunity.create({
            data: {
              opportunity_type: item.opportunity_type,
              title: item.title,
              publisher: item.publisher,
              description: item.description,
              requirements: item.requirements,
              status: item.status,
              is_verified: false,
              reviewed_by: null,
              reviewed_at: null,
              source_url: null,
              location: null,
              work_format: null,
              deadline: null,
              deadline_source_date: null,
              deadline_source_timezone: null,
            },
          });

          // Tạo liên kết opportunity_majors
          for (const majorName of item.majors) {
            const majorId = catMap.get(`Major:${majorName}`);
            await tx.opportunityMajor.create({
              data: {
                item_id: created.item_id,
                major_id: majorId,
              },
            });
          }

          // Tạo liên kết opportunity_skills
          for (const skillName of item.skills) {
            const skillId = catMap.get(`Skill:${skillName}`);
            await tx.opportunitySkill.create({
              data: {
                item_id: created.item_id,
                skill_id: skillId,
              },
            });
          }

          // Tạo liên kết opportunity_years
          for (const year of item.academic_years) {
            await tx.opportunityYear.create({
              data: {
                item_id: created.item_id,
                academic_year: year,
              },
            });
          }

          appliedCount++;
        }
      }
    },
    { timeout: 120000, maxWait: 20000 },
  );

  console.log(
    `[Guidance Seed] Successfully applied ${appliedCount} new articles into "${actualDb}".`,
  );

  return {
    mode: 'APPLY',
    targetDb: actualDb,
    fixtureCount: fixtureItems.length,
    toCreateCount,
    toReuseCount,
    appliedCount,
  };
}

/**
 * Xác minh tính toàn vẹn của dữ liệu Guidance đã nạp.
 */
export async function verifyGuidanceDemo({ prismaClient = null } = {}) {
  const prisma = prismaClient ?? getPrismaClient();
  await assertTargetDatabase(prisma);

  const fixtureItems = JSON.parse(await readFile(FIXTURE_PATH, 'utf8'));
  const fixtureTitles = new Set(fixtureItems.map((i) => i.title));

  const dbArticles = await prisma.opportunity.findMany({
    where: {
      opportunity_type: 'Bài viết định hướng',
      publisher: 'UniHub Ban Cố vấn Học tập & Hướng nghiệp',
    },
    include: {
      majors: { include: { major: true } },
      skills: { include: { skill: true } },
      years: true,
    },
  });

  const matchingArticles = dbArticles.filter((a) => fixtureTitles.has(a.title));
  assert.equal(
    matchingArticles.length,
    146,
    `Database must contain exactly 146 seeded fixture articles, found: ${matchingArticles.length}`,
  );

  // Kiểm tra phân bổ major
  const coveredMajorIds = new Set();
  const coveredMajorNames = new Set();
  for (const a of matchingArticles) {
    assert.equal(a.status, 'Approved', 'Guidance article must be Approved');
    assert.equal(
      a.is_verified,
      false,
      'Guidance article is_verified must be false',
    );
    assert.equal(
      a.reviewed_by,
      null,
      'Guidance article reviewed_by must be null',
    );
    assert.ok(a.years.length > 0, 'Guidance article must have years linked');
    for (const m of a.majors) {
      coveredMajorIds.add(m.major_id);
      coveredMajorNames.add(m.major.name);
    }
  }

  assert.equal(
    coveredMajorNames.size,
    100,
    `Expected exactly 100 majors covered with guidance, got: ${coveredMajorNames.size}`,
  );

  // Kiểm tra 17 empty majors không có bài viết
  const allActiveMajors = await prisma.category.findMany({
    where: { type: 'Major', status: 'Active' },
    select: { category_id: true, name: true },
  });

  const emptyMajors = allActiveMajors.filter(
    (m) => !coveredMajorNames.has(m.name),
  );
  assert.equal(
    emptyMajors.length,
    17,
    `Expected exactly 17 empty state majors, got: ${emptyMajors.length}`,
  );

  // Xác nhận bài định hướng không rò rỉ vào danh mục tuyển dụng
  const leakedRecruitment = await prisma.opportunity.count({
    where: {
      opportunity_type: { in: ['Thực tập', 'Việc làm', 'Học bổng'] },
      publisher: 'UniHub Ban Cố vấn Học tập & Hướng nghiệp',
    },
  });
  assert.equal(
    leakedRecruitment,
    0,
    'Guidance articles must not leak into recruitment opportunities',
  );

  return {
    verified: true,
    seededArticlesCount: matchingArticles.length,
    coveredMajorsCount: coveredMajorNames.size,
    emptyMajorsCount: emptyMajors.length,
    emptyMajorNames: emptyMajors.map((m) => m.name),
  };
}

// Chạy trực tiếp qua CLI
if (process.argv[1]?.endsWith('seed-guidance-demo.mjs')) {
  const isApply = process.argv.includes('--apply');
  const isVerifyOnly = process.argv.includes('--verify');

  try {
    if (isVerifyOnly) {
      console.log('Running scoped verification for UniHub Guidance Demo...');
      const verifyRes = await verifyGuidanceDemo();
      console.log('✅ Scoped verification PASSED:', verifyRes);
    } else {
      const result = await seedGuidanceDemo({ apply: isApply });
      console.log('Result:', result);

      if (isApply) {
        console.log('Running immediate verification...');
        const verifyRes = await verifyGuidanceDemo();
        console.log('✅ Scoped verification PASSED:', verifyRes);
      }
    }
  } catch (error) {
    console.error('❌ Error executing guidance demo seed:', error);
    process.exit(1);
  } finally {
    await disconnectPrismaClient();
  }
}
