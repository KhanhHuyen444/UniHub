/**
 * guidance-api-integration.test.mjs
 * Kiểm thử toàn diện các kịch bản API theo docs/guidance-api-contract.md và Chương 3 UC-03.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPrismaClient,
  disconnectPrismaClient,
} from '../../../backend/dist/lib/prisma.js';

const API_BASE = 'http://127.0.0.1:3002/api';

describe('Guidance API Integration Tests (Live)', () => {
  let prisma;
  let defaultMajor;
  let emptyMajor;
  let coreMajor;
  let clusterMajor;
  let testArticleId;

  before(async () => {
    prisma = getPrismaClient();

    // 1. Default major (first active major by name asc, category_id asc)
    defaultMajor = await prisma.category.findFirst({
      where: { type: 'Major', status: 'Active' },
      orderBy: [{ name: 'asc' }, { category_id: 'asc' }],
    });

    // 2. Empty state major (e.g. Hải dương học)
    emptyMajor = await prisma.category.findFirst({
      where: { name: 'Hải dương học' },
    });

    // 3. Core major (e.g. Công nghệ thông tin)
    coreMajor = await prisma.category.findFirst({
      where: { name: 'Công nghệ thông tin' },
    });

    // 4. Cluster major (e.g. Kỹ thuật máy tính)
    clusterMajor = await prisma.category.findFirst({
      where: { name: 'Kỹ thuật máy tính' },
    });

    // 5. Test article
    const testArticle = await prisma.opportunity.findFirst({
      where: {
        opportunity_type: 'Bài viết định hướng',
        status: 'Approved',
      },
    });
    testArticleId = testArticle?.item_id;
  });

  after(async () => {
    await disconnectPrismaClient();
  });

  test('Guest truy cập GET /api/guidance không cần token và trả đúng Major mặc định đầu tiên', async () => {
    const res = await fetch(`${API_BASE}/guidance`);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.ok(data.selectedMajor);
    assert.equal(data.selectedMajor.id, defaultMajor.category_id);
    assert.equal(data.selectedMajor.name, defaultMajor.name);
    assert.equal(data.selectedMajor.type, 'Major');
    assert.ok(Array.isArray(data.stages));
  });

  test('GET /api/guidance?majorId=<coreMajor> trả đầy đủ 4 stages theo thứ tự năm 1-4', async () => {
    const res = await fetch(
      `${API_BASE}/guidance?majorId=${coreMajor.category_id}`,
    );
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.selectedMajor.id, coreMajor.category_id);
    assert.equal(data.selectedMajor.name, 'Công nghệ thông tin');

    assert.equal(data.stages.length, 4, 'Core major must have 4 stages');
    const academicYears = data.stages.map((s) => s.academicYear);
    assert.deepEqual(
      academicYears,
      [1, 2, 3, 4],
      'Stages must be ordered 1 to 4',
    );

    for (const stage of data.stages) {
      assert.ok(stage.items.length >= 1);
      for (const item of stage.items) {
        assert.ok(item.id);
        assert.ok(item.title);
        assert.ok(Array.isArray(item.requiredSkills));
        assert.ok(item.createdAt);
      }
    }
  });

  test('GET /api/guidance?majorId=<clusterMajor> trả đúng 2 stages nền tảng', async () => {
    const res = await fetch(
      `${API_BASE}/guidance?majorId=${clusterMajor.category_id}`,
    );
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.selectedMajor.id, clusterMajor.category_id);
    assert.equal(data.stages.length, 2, 'Cluster major must have 2 stages');
    const academicYears = data.stages.map((s) => s.academicYear);
    assert.deepEqual(academicYears, [1, 2]);
  });

  test('GET /api/guidance?majorId=<emptyMajor> trả stages: [] với HTTP 200 chuẩn UC-03', async () => {
    const res = await fetch(
      `${API_BASE}/guidance?majorId=${emptyMajor.category_id}`,
    );
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.selectedMajor.id, emptyMajor.category_id);
    assert.equal(data.selectedMajor.name, 'Hải dương học');
    assert.deepEqual(
      data.stages,
      [],
      'Empty major must return empty stages array',
    );
  });

  test('Query param lạ hoặc lặp trả 400 INVALID_QUERY', async () => {
    const res1 = await fetch(`${API_BASE}/guidance?invalidParam=123`);
    assert.equal(res1.status, 400);
    const err1 = await res1.json();
    assert.equal(err1.error.code, 'INVALID_QUERY');

    const res2 = await fetch(`${API_BASE}/guidance?majorId=1&majorId=2`);
    assert.equal(res2.status, 400);
    const err2 = await res2.json();
    assert.equal(err2.error.code, 'INVALID_QUERY');
  });

  test('majorId không tồn tại trả 400 INVALID_FILTER', async () => {
    const res = await fetch(`${API_BASE}/guidance?majorId=999999`);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error.code, 'INVALID_FILTER');
  });

  test('GET /api/guidance/:id trả đầy đủ chi tiết bài viết, không rò rỉ thông tin reviewer', async () => {
    const res = await fetch(`${API_BASE}/guidance/${testArticleId}`);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.ok(data.item);
    assert.equal(data.item.id, testArticleId);
    assert.ok(data.item.title);
    assert.equal(
      data.item.publisher,
      'UniHub Ban Cố vấn Học tập & Hướng nghiệp',
    );
    assert.ok(data.item.descriptionText);
    assert.ok(data.item.requirementsText);
    assert.ok(Array.isArray(data.item.majors));
    assert.ok(Array.isArray(data.item.skills));
    assert.ok(Array.isArray(data.item.academicYears));
    assert.ok(data.item.createdAt);

    // Không rò rỉ reviewed_by, reviewer identity hoặc audit fields
    assert.equal('reviewed_by' in data.item, false);
    assert.equal('reviewer' in data.item, false);
    assert.equal('is_verified' in data.item, false);
  });

  test('GET /api/guidance/:id với id không tồn tại trả 404 NOT_FOUND', async () => {
    const res = await fetch(`${API_BASE}/guidance/999999`);
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.equal(data.error.code, 'NOT_FOUND');
  });

  test('Guidance Articles không rò rỉ vào danh sách tuyển dụng Opportunity Hub', async () => {
    const res = await fetch(`${API_BASE}/opportunities`);
    assert.equal(res.status, 200);
    const data = await res.json();

    const leakedItems = (data.items || []).filter(
      (item) => item.opportunityType === 'Bài viết định hướng',
    );
    assert.equal(
      leakedItems.length,
      0,
      'Guidance articles must never appear in opportunities list',
    );
  });
});
