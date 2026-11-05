/**
 * safety-and-api-scenarios.test.mjs
 * Kiểm thử tính an toàn của Seed Script, Transaction Rollback, Idempotency và Database Guards.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPrismaClient,
  disconnectPrismaClient,
} from '../../../backend/dist/lib/prisma.js';
import {
  assertTargetDatabase,
  seedGuidanceDemo,
  verifyGuidanceDemo,
} from './seed-guidance-demo.mjs';

describe('Seed Safety & Database Guard Scenarios', () => {
  let prisma;

  before(async () => {
    prisma = getPrismaClient();
  });

  after(async () => {
    await disconnectPrismaClient();
  });

  test('Database Safety Guard chặn DATABASE_URL chứa unihub_dev', async () => {
    const origUrl = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/unihub_dev';
      await assert.rejects(async () => {
        await assertTargetDatabase(prisma);
      }, /DATABASE SAFETY GUARD/);
    } finally {
      process.env.DATABASE_URL = origUrl;
    }
  });

  test('Database Safety Guard xác minh đúng runtime database unihub_demo', async () => {
    const actualDb = await assertTargetDatabase(prisma);
    assert.equal(actualDb, 'unihub_demo');
  });

  test('Dry-run không tạo bất kỳ thay đổi nào vào database', async () => {
    const countBefore = await prisma.opportunity.count({
      where: { opportunity_type: 'Bài viết định hướng' },
    });

    const result = await seedGuidanceDemo({
      apply: false,
      prismaClient: prisma,
    });

    assert.equal(result.mode, 'DRY-RUN');
    assert.equal(result.appliedCount, 0);

    const countAfter = await prisma.opportunity.count({
      where: { opportunity_type: 'Bài viết định hướng' },
    });

    assert.equal(
      countBefore,
      countAfter,
      'Dry-run must not change opportunity count',
    );
  });

  test('Transaction Rollback hoạt động chuẩn xác khi gặp lỗi trong quá trình tạo', async () => {
    const countBefore = await prisma.opportunity.count({
      where: { opportunity_type: 'Bài viết định hướng' },
    });

    // Mô phỏng transaction bị fail ở giữa chừng
    await assert.rejects(async () => {
      await prisma.$transaction(async (tx) => {
        await tx.opportunity.create({
          data: {
            opportunity_type: 'Bài viết định hướng',
            title: '__TEMPORARY_TEST_ROLLBACK_ITEM__',
            publisher: 'UniHub Ban Cố vấn Học tập & Hướng nghiệp',
            status: 'Approved',
          },
        });
        // Cố tình ném lỗi để kiểm tra rollback
        throw new Error('SIMULATED_TRANSACTION_FAILURE');
      });
    }, /SIMULATED_TRANSACTION_FAILURE/);

    const countAfter = await prisma.opportunity.count({
      where: { opportunity_type: 'Bài viết định hướng' },
    });

    assert.equal(
      countBefore,
      countAfter,
      'Count must remain identical after transaction rollback',
    );

    const phantom = await prisma.opportunity.findFirst({
      where: { title: '__TEMPORARY_TEST_ROLLBACK_ITEM__' },
    });
    assert.equal(phantom, null, 'Rollback item must not persist in database');
  });
});
