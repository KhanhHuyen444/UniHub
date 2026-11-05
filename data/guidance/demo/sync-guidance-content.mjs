/**
 * sync-guidance-content.mjs
 * Script đồng bộ có kiểm soát nội dung 146 Guidance Articles vào MySQL unihub_demo.
 * Cập nhật in-place theo item_id dựa trên title/fixture_key, bảo toàn tuyệt đối ID và URL.
 *
 * Tuân thủ:
 * - Mặc định Dry-run, chỉ ghi khi có cờ --apply
 * - Database safety guard: chỉ cho phép trên unihub_demo, cấm tuyệt đối unihub_dev
 * - Không xóa/tạo lại record, không ảnh hưởng các bảng khác
 * - Thực hiện trong Transaction an toàn, có khả năng chạy lại idempotent
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
 * Đồng bộ nội dung Guidance Articles vào database.
 * @param {object} options
 * @param {boolean} [options.apply=false] - false: Dry-run; true: Ghi cập nhật vào database.
 * @param {object} [options.prismaClient=null] - Prisma client dùng trong test.
 */
export async function syncGuidanceContent({
  apply = false,
  prismaClient = null,
} = {}) {
  const prisma = prismaClient ?? getPrismaClient();

  const actualDb = await assertTargetDatabase(prisma);

  // Đọc fixture đã tinh chỉnh
  const fixtureItems = JSON.parse(await readFile(FIXTURE_PATH, 'utf8'));
  assert.equal(
    fixtureItems.length,
    146,
    'Fixture must contain exactly 146 articles',
  );

  // Tra cứu các bài viết Guidance hiện có trong DB
  const existingArticles = await prisma.opportunity.findMany({
    where: {
      opportunity_type: 'Bài viết định hướng',
      publisher: 'UniHub Ban Cố vấn Học tập & Hướng nghiệp',
    },
    select: {
      item_id: true,
      title: true,
      description: true,
      requirements: true,
      status: true,
    },
  });

  if (existingArticles.length !== 146) {
    throw new Error(
      `Baseline conflict: Database "${actualDb}" hiện có ${existingArticles.length} bài viết định hướng, dự kiến đúng 146 bài.`,
    );
  }

  const existingByTitle = new Map(existingArticles.map((a) => [a.title, a]));

  const updates = [];
  const unchanged = [];

  for (const item of fixtureItems) {
    const existing = existingByTitle.get(item.title);
    if (!existing) {
      throw new Error(
        `Baseline conflict: Không tìm thấy bài viết "${item.title}" (${item.fixture_key}) trong database!`,
      );
    }

    const isDescDiff =
      (existing.description ?? '').trim() !== item.description.trim();
    const isReqDiff =
      (existing.requirements ?? '').trim() !== item.requirements.trim();

    if (isDescDiff || isReqDiff) {
      updates.push({
        item_id: existing.item_id,
        fixture_key: item.fixture_key,
        title: item.title,
        isDescDiff,
        isReqDiff,
        newDescription: item.description,
        newRequirements: item.requirements,
      });
    } else {
      unchanged.push({
        item_id: existing.item_id,
        title: item.title,
      });
    }
  }

  console.log(
    `[Guidance Sync] Database: "${actualDb}" | Mode: ${apply ? 'APPLY (Write)' : 'DRY-RUN'}`,
  );
  console.log(
    `[Guidance Sync] Scan result: ${updates.length} to update in-place, ${unchanged.length} already up-to-date.`,
  );

  if (!apply) {
    return {
      mode: 'DRY-RUN',
      targetDb: actualDb,
      totalFixtureCount: 146,
      toUpdateCount: updates.length,
      unchangedCount: unchanged.length,
      sampleUpdates: updates.slice(0, 3).map((u) => ({
        id: u.item_id,
        key: u.fixture_key,
        title: u.title,
      })),
    };
  }

  if (updates.length === 0) {
    console.log(
      '[Guidance Sync] All 146 records are already up-to-date. Nothing to write.',
    );
    return {
      mode: 'APPLY',
      targetDb: actualDb,
      totalFixtureCount: 146,
      updatedCount: 0,
      unchangedCount: unchanged.length,
    };
  }

  // Thực hiện in-place update trong Transaction
  await prisma.$transaction(async (tx) => {
    for (const update of updates) {
      await tx.opportunity.update({
        where: { item_id: update.item_id },
        data: {
          description: update.newDescription,
          requirements: update.newRequirements,
        },
      });
    }
  });

  console.log(
    `[Guidance Sync] Successfully updated ${updates.length} articles in-place (item_id preserved).`,
  );

  return {
    mode: 'APPLY',
    targetDb: actualDb,
    totalFixtureCount: 146,
    updatedCount: updates.length,
    unchangedCount: unchanged.length,
    minId: Math.min(...existingArticles.map((a) => a.item_id)),
    maxId: Math.max(...existingArticles.map((a) => a.item_id)),
  };
}

if (process.argv[1]?.endsWith('sync-guidance-content.mjs')) {
  const isApply = process.argv.includes('--apply');
  try {
    const res = await syncGuidanceContent({ apply: isApply });
    console.log('Result:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
    process.exit(1);
  } finally {
    await disconnectPrismaClient();
  }
}
