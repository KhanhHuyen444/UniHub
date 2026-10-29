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
    '/api/categories?type=skill',
    '/api/categories?type=',
    '/api/categories?type=Other',
    '/api/categories?type=Skill&type=Skill',
    '/api/categories?type=Skill&status=Active',
    '/api/categories?type=Skill&status=Closed',
    '/api/categories?type=Skill&page=1',
    '/api/categories?type=Skill&q=TypeScript',
    '/api/categories?type=Skill&extra=',
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
  'MySQL integration: Major/Skill Active, type isolation, collation và danh sách rỗng',
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

    const skillFixtureWithMysql = await skillFixture({
      findMany: (args) => integrationClient.category.findMany(args),
    });
    await withServer(skillFixtureWithMysql.app, async (url) => {
      const response = await fetch(
        `${url}/api/categories?type=Skill`,
        bearer(skillFixtureWithMysql.token),
      );
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { items: [] });
    });

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
    const alphaSkill = await integrationClient.category.create({
      data: { type: 'Skill', name: `UniHub Alpha ${suffix}`, status: 'Active' },
    });
    insertedCategoryIds.push(alphaSkill.category_id);
    const closedSkill = await integrationClient.category.create({
      data: {
        type: 'Skill',
        name: `UniHub Closed ${suffix}`,
        status: 'Closed',
      },
    });
    insertedCategoryIds.push(closedSkill.category_id);
    await withServer(skillFixtureWithMysql.app, async (url) => {
      const response = await fetch(
        `${url}/api/categories?type=Skill`,
        bearer(skillFixtureWithMysql.token),
      );
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        items: [
          { id: alphaSkill.category_id, name: alphaSkill.name, type: 'Skill' },
          {
            id: skill.category_id,
            name: `UniHub Skill ${suffix}`,
            type: 'Skill',
          },
        ],
      });
    });

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

const skillNow = new Date('2026-10-29T00:00:00Z');
const skillIdentity = {
  userId: 42,
  role: 'Student',
  sessionId: 'd7f55cee-2d7c-4df9-aece-36b6eb446db5',
};
const skillJwtConfig = {
  signingSecret: 'categories-test-only-secret-at-least-32-bytes',
  issuer: 'https://categories.test.invalid',
  audience: 'categories-test',
};

async function skillFixture({
  findMany = async () => [],
  session = {
    session_id: skillIdentity.sessionId,
    user_id: skillIdentity.userId,
    expires_at: new Date(skillNow.getTime() + 60_000),
    revoked_at: null,
  },
  sessionError,
  verifyNow = skillNow,
} = {}) {
  const { createAccessTokenService } = await import(
    '../dist/modules/auth/access-token.js'
  );
  const signer = createAccessTokenService(skillJwtConfig, () => skillNow);
  const verifier = createAccessTokenService(skillJwtConfig, () => verifyNow);
  let categoryCalls = 0;
  let sessionCalls = 0;
  const app = createApp({
    categories: {
      getPrismaClient: () => ({
        category: {
          findMany: async (args) => {
            categoryCalls += 1;
            return findMany(args);
          },
        },
      }),
      auth: {
        verifyToken: verifier.verify,
        now: () => skillNow,
        getPrismaClient: () => ({
          authSession: {
            findUnique: async () => {
              sessionCalls += 1;
              if (sessionError) throw sessionError;
              return session;
            },
          },
        }),
      },
    },
  });
  return {
    app,
    token: await signer.sign(skillIdentity),
    adminToken: await signer.sign({ ...skillIdentity, role: 'Admin' }),
    calls: () => ({ categoryCalls, sessionCalls }),
  };
}

function bearer(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

test('Student JWT hợp lệ: Skill Active, select/sort đúng và không lộ field thừa', async () => {
  let query;
  const fixture = await skillFixture({
    findMany: async (args) => {
      query = args;
      return [
        {
          category_id: 31,
          name: 'TypeScript',
          type: 'Skill',
          status: 'Active',
          created_at: skillNow,
        },
      ];
    },
  });
  await withServer(fixture.app, async (url) => {
    const response = await fetch(
      `${url}/api/categories?type=Skill`,
      bearer(fixture.token),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      items: [{ id: 31, name: 'TypeScript', type: 'Skill' }],
    });
  });
  assert.deepEqual(query, {
    where: { type: 'Skill', status: 'Active' },
    select: { category_id: true, name: true, type: true },
    orderBy: [{ name: 'asc' }, { category_id: 'asc' }],
  });
  assert.deepEqual(fixture.calls(), { categoryCalls: 1, sessionCalls: 1 });
});

test('Student nhận 200 items=[] khi không có Skill Active', async () => {
  const fixture = await skillFixture();
  await withServer(fixture.app, async (url) => {
    const response = await fetch(
      `${url}/api/categories?type=Skill`,
      bearer(fixture.token),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { items: [] });
  });
});

test('Skill: Guest, malformed, chữ ký sai và JWT hết hạn trả 401 trước truy vấn Category', async () => {
  for (const expired of [false, true]) {
    const fixture = await skillFixture({
      verifyNow: expired ? new Date(skillNow.getTime() + 900_000) : skillNow,
    });
    const [header, payload, signature] = fixture.token.split('.');
    const tampered = `${header}.${payload}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
    const candidates = expired
      ? [fixture.token]
      : [undefined, 'invalid', tampered];
    await withServer(fixture.app, async (url) => {
      for (const token of candidates) {
        const response = await fetch(
          `${url}/api/categories?type=Skill`,
          token ? bearer(token) : {},
        );
        assert.equal(response.status, 401);
        assert.equal((await response.json()).error.code, 'UNAUTHORIZED');
      }
    });
    assert.equal(fixture.calls().categoryCalls, 0);
  }
});

test('Skill: session thiếu, thu hồi, hết hạn hoặc sai chủ trả 401', async () => {
  for (const session of [
    null,
    {
      user_id: 42,
      revoked_at: skillNow,
      expires_at: new Date(skillNow.getTime() + 60_000),
    },
    { user_id: 42, revoked_at: null, expires_at: skillNow },
    {
      user_id: 43,
      revoked_at: null,
      expires_at: new Date(skillNow.getTime() + 60_000),
    },
  ]) {
    const fixture = await skillFixture({ session });
    await withServer(fixture.app, async (url) => {
      const response = await fetch(
        `${url}/api/categories?type=Skill`,
        bearer(fixture.token),
      );
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error.code, 'UNAUTHORIZED');
    });
    assert.equal(fixture.calls().categoryCalls, 0);
  }
});

test('Skill: Admin trả 403 và không truy vấn Category', async () => {
  const fixture = await skillFixture();
  await withServer(fixture.app, async (url) => {
    const response = await fetch(
      `${url}/api/categories?type=Skill`,
      bearer(fixture.adminToken),
    );
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, 'FORBIDDEN');
  });
  assert.equal(fixture.calls().categoryCalls, 0);
});

test('Skill query sai trả 400 trước auth và database kể cả có JWT Student', async () => {
  const fixture = await skillFixture();
  await withServer(fixture.app, async (url) => {
    for (const query of [
      'type=Skill&type=Major',
      'type=Skill&type=Skill',
      'type=Skill&status=Active',
      'type=Skill&page=1',
      'type=skill',
      'type=Skill&unknown=1',
    ]) {
      const response = await fetch(
        `${url}/api/categories?${query}`,
        bearer(fixture.token),
      );
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, 'INVALID_QUERY');
    }
  });
  assert.deepEqual(fixture.calls(), { categoryCalls: 0, sessionCalls: 0 });
});

test('Skill: lỗi Category/session DB trả 503; lỗi bất ngờ trả 500, không lộ chi tiết', async (context) => {
  context.mock.method(console, 'error', () => {});
  const marker = 'private-database-detail';
  for (const source of ['category', 'session']) {
    for (const unavailable of [true, false]) {
      const error = Object.assign(
        new Error(marker),
        unavailable ? { code: 'P1001' } : {},
      );
      const fixture = await skillFixture(
        source === 'session'
          ? { sessionError: error }
          : {
              findMany: async () => {
                throw error;
              },
            },
      );
      await withServer(fixture.app, async (url) => {
        const response = await fetch(
          `${url}/api/categories?type=Skill`,
          bearer(fixture.token),
        );
        assert.equal(response.status, unavailable ? 503 : 500);
        const body = await response.text();
        assert.equal(
          JSON.parse(body).error.code,
          unavailable ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_ERROR',
        );
        assert.equal(body.includes(marker), false);
      });
    }
  }
});

test('Major vẫn public với Guest/Student/Admin/token sai và không gọi auth session', async () => {
  const fixture = await skillFixture({
    sessionError: new Error('Auth must not run for Major'),
    findMany: async (args) => {
      assert.deepEqual(args.where, { type: 'Major', status: 'Active' });
      return [{ category_id: 12, name: 'Major', type: 'Major' }];
    },
  });
  await withServer(fixture.app, async (url) => {
    for (const token of [
      undefined,
      fixture.token,
      fixture.adminToken,
      'invalid',
    ]) {
      const response = await fetch(
        `${url}/api/categories?type=Major`,
        token ? bearer(token) : {},
      );
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        items: [{ id: 12, name: 'Major', type: 'Major' }],
      });
    }
  });
  assert.deepEqual(fixture.calls(), { categoryCalls: 4, sessionCalls: 0 });
});
