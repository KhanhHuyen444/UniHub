import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { once } from 'node:events';
import { createApp } from '../dist/app.js';
import { createPrismaClient } from '../dist/lib/prisma.js';

async function withServer(testApp, callback) {
  const server = testApp.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function appWithFindMany(findMany) {
  return createApp({
    categories: {
      getPrismaClient: () => ({ category: { findMany } }),
    },
  });
}

test('GET /api/categories?type=Major trả đúng shape và truy vấn Major Active đã sắp xếp', async () => {
  let query;
  const testApp = appWithFindMany(async (args) => {
    query = args;
    return [
      {
        category_id: 12,
        name: 'Kỹ thuật phần mềm',
        type: 'Major',
        status: 'Active',
        created_at: new Date(),
      },
    ];
  });

  await withServer(testApp, async (url) => {
    const response = await fetch(`${url}/api/categories?type=Major`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      items: [{ id: 12, name: 'Kỹ thuật phần mềm', type: 'Major' }],
    });
  });

  assert.deepEqual(query, {
    where: { type: 'Major', status: 'Active' },
    select: { category_id: true, name: true, type: true },
    orderBy: [{ name: 'asc' }, { category_id: 'asc' }],
  });
});

test('GET /api/categories trả items rỗng khi không có Major Active', async () => {
  await withServer(
    appWithFindMany(async () => []),
    async (url) => {
      const response = await fetch(`${url}/api/categories?type=Major`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { items: [] });
    },
  );
});

test('query thiếu, sai, lặp hoặc không hỗ trợ bị từ chối trước khi gọi database', async () => {
  let databaseCalls = 0;
  const testApp = appWithFindMany(async () => {
    databaseCalls += 1;
    return [];
  });
  const invalidPaths = [
    '/api/categories',
    '/api/categories?type=major',
    '/api/categories?type=Skill',
    '/api/categories?type=Major&type=Major',
    '/api/categories?type=Major&type=Skill',
    '/api/categories?type=Major&status=Active',
    '/api/categories?type=Major&page=1',
    '/api/categories?TYPE=Major',
  ];

  await withServer(testApp, async (url) => {
    for (const path of invalidPaths) {
      const response = await fetch(`${url}${path}`);
      assert.equal(response.status, 400, path);
      assert.deepEqual(await response.json(), {
        error: {
          code: 'INVALID_QUERY',
          message: 'Tham số truy vấn không hợp lệ.',
        },
      });
    }
  });

  assert.equal(databaseCalls, 0);
});

test('lỗi kết nối database trả lỗi chung, không lộ chi tiết nội bộ', async () => {
  const secretMarker =
    'mysql://private-user:private-password@db.invalid/schema';
  const testApp = appWithFindMany(async () => {
    throw Object.assign(new Error(secretMarker), { code: 'P1001' });
  });

  await withServer(testApp, async (url) => {
    const response = await fetch(`${url}/api/categories?type=Major`);
    assert.equal(response.status, 503);
    const body = await response.text();
    assert.deepEqual(JSON.parse(body), {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database hiện không sẵn sàng.',
      },
    });
    assert.equal(body.includes(secretMarker), false);
  });
});

test('lỗi ngoài dự kiến trả 500 chung, không lộ thông tin nội bộ', async (context) => {
  context.mock.method(console, 'error', () => {});
  const secretMarker = 'internal database implementation detail';
  const testApp = appWithFindMany(async () => {
    throw new Error(secretMarker);
  });

  await withServer(testApp, async (url) => {
    const response = await fetch(`${url}/api/categories?type=Major`);
    assert.equal(response.status, 500);
    const body = await response.text();
    assert.deepEqual(JSON.parse(body), {
      error: { code: 'INTERNAL_ERROR', message: 'Máy chủ gặp lỗi nội bộ.' },
    });
    assert.equal(body.includes(secretMarker), false);
  });
});

const testDatabaseUrl = process.env.TEST_CATEGORIES_DATABASE_URL;
let integrationClient;
let integrationServer;
let integrationBaseUrl;
let insertedCategoryIds = [];

test(
  'MySQL integration: lọc Major Active, giữ thứ tự collation và trả rỗng an toàn',
  {
    skip: !testDatabaseUrl,
  },
  async () => {
    const url = new URL(testDatabaseUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    assert.ok(
      url.protocol === 'mysql:' &&
        ['127.0.0.1', 'localhost', '::1'].includes(url.hostname) &&
        databaseName.startsWith('unihub_categories_test'),
      'TEST_CATEGORIES_DATABASE_URL chỉ được trỏ tới MySQL loopback unihub_categories_test* riêng.',
    );

    integrationClient = createPrismaClient(testDatabaseUrl);
    await integrationClient.$connect();
    const existingCategories = await integrationClient.category.count();
    assert.equal(
      existingCategories,
      0,
      'Database categories test phải không có category có sẵn; không tự xóa dữ liệu.',
    );

    const integrationApp = createApp({
      categories: { getPrismaClient: () => integrationClient },
    });
    integrationServer = integrationApp.listen(0, '127.0.0.1');
    await once(integrationServer, 'listening');
    integrationBaseUrl = `http://127.0.0.1:${integrationServer.address().port}`;

    const emptyResponse = await fetch(
      `${integrationBaseUrl}/api/categories?type=Major`,
    );
    assert.equal(emptyResponse.status, 200);
    assert.deepEqual(await emptyResponse.json(), { items: [] });

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const zulu = await integrationClient.category.create({
      data: { type: 'Major', name: `UniHub Zulu ${suffix}`, status: 'Active' },
      select: { category_id: true },
    });
    insertedCategoryIds.push(zulu.category_id);
    const alpha = await integrationClient.category.create({
      data: { type: 'Major', name: `UniHub Alpha ${suffix}`, status: 'Active' },
      select: { category_id: true },
    });
    insertedCategoryIds.push(alpha.category_id);
    const closed = await integrationClient.category.create({
      data: {
        type: 'Major',
        name: `UniHub Closed ${suffix}`,
        status: 'Closed',
      },
      select: { category_id: true },
    });
    insertedCategoryIds.push(closed.category_id);
    const skill = await integrationClient.category.create({
      data: { type: 'Skill', name: `UniHub Skill ${suffix}`, status: 'Active' },
      select: { category_id: true },
    });
    insertedCategoryIds.push(skill.category_id);

    const response = await fetch(
      `${integrationBaseUrl}/api/categories?type=Major`,
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.items, [
      { id: alpha.category_id, name: `UniHub Alpha ${suffix}`, type: 'Major' },
      { id: zulu.category_id, name: `UniHub Zulu ${suffix}`, type: 'Major' },
    ]);
  },
);

after(async () => {
  if (integrationServer) {
    await new Promise((resolve, reject) =>
      integrationServer.close((error) => (error ? reject(error) : resolve())),
    );
  }

  if (integrationClient) {
    if (insertedCategoryIds.length > 0) {
      await integrationClient.category.deleteMany({
        where: { category_id: { in: insertedCategoryIds } },
      });
    }
    await integrationClient.$disconnect();
  }
});
