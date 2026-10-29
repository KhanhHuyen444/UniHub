import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createApp } from '../dist/app.js';
import { createPrismaClient } from '../dist/lib/prisma.js';
import {
  createAccessTokenService,
  InvalidJwtConfigurationError,
} from '../dist/modules/auth/access-token.js';

const now = new Date('2026-10-29T00:00:00Z');
const identity = {
  userId: 42,
  role: 'Student',
  sessionId: 'd7f55cee-2d7c-4df9-aece-36b6eb446db5',
};
const tokenConfig = {
  signingSecret: 'guidance-test-only-signing-secret-at-least-32-bytes',
  issuer: 'https://guidance.test.invalid',
  audience: 'guidance-test',
};
const tokens = createAccessTokenService(tokenConfig, () => now);
const major = { category_id: 4, name: 'Major' };
const category = { category_id: 31, name: 'Closed Skill', status: 'Closed' };
const article = (id, years = [2]) => ({
  item_id: id,
  opportunity_type: 'Bài viết định hướng',
  title: `Article ${id}`,
  created_at: now,
  years: years.map((academic_year) => ({ academic_year })),
  skills: [{ skill: category }],
  reviewed_by: 99,
});

function fixture(overrides = {}) {
  const calls = [];
  const method = (name, fallback) => async (args) => {
    calls.push({ name, args });
    return (overrides[name] ?? fallback)(args);
  };
  const client = {
    category: { findFirst: method('category', async () => major) },
    user: { findUnique: method('profile', async () => ({ major_id: 7 })) },
    opportunity: {
      findMany: method('list', async () => [
        article(2, [1, 3]),
        article(9, [3]),
        article(10, []),
      ]),
      findFirst: method('detail', async () => ({
        ...article(81, []),
        publisher: null,
        description: 'Plain text <b>not rendered as HTML</b>',
        requirements: null,
        majors: [{ major: { ...major, status: 'Closed' } }],
      })),
    },
  };
  const app = createApp({
    guidance: {
      getPrismaClient: () => client,
      auth: {
        now: () => now,
        verifyToken: overrides.verifyToken ?? tokens.verify,
        getPrismaClient: () => ({
          authSession: {
            findUnique: method('session', async () => ({
              user_id: 42,
              expires_at: new Date(now.getTime() + 60_000),
              revoked_at: null,
            })),
          },
        }),
      },
    },
  });
  return { app, calls };
}
async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
const bearer = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

test('Guest list: public filter, Active Major sort, year grouping, ID order and safe shape', async () => {
  const { app, calls } = fixture();
  await withServer(app, async (url) => {
    const response = await fetch(`${url}/api/guidance`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.selectedMajor, {
      id: 4,
      name: 'Major',
      type: 'Major',
    });
    assert.deepEqual(
      body.stages.map((s) => [s.academicYear, s.items.map((i) => i.id)]),
      [
        [1, [2]],
        [3, [2, 9]],
      ],
    );
    assert.deepEqual(body.stages[0].items[0], {
      id: 2,
      title: 'Article 2',
      requiredSkills: [{ id: 31, name: 'Closed Skill' }],
      createdAt: now.toISOString(),
    });
    assert.equal(JSON.stringify(body).includes('reviewed_by'), false);
  });
  assert.deepEqual(calls.find((c) => c.name === 'category').args, {
    where: { type: 'Major', status: 'Active' },
    select: { category_id: true, name: true },
    orderBy: [{ name: 'asc' }, { category_id: 'asc' }],
  });
  const query = calls.find((c) => c.name === 'list').args;
  assert.deepEqual(query.where, {
    opportunity_type: 'Bài viết định hướng',
    status: 'Approved',
    majors: { some: { major_id: 4 } },
    years: { some: { academic_year: { gte: 1, lte: 4 } } },
  });
  assert.deepEqual(query.orderBy, { item_id: 'asc' });
  assert.deepEqual(query.select.skills.orderBy, [
    { skill: { name: 'asc' } },
    { skill_id: 'asc' },
  ]);
  assert.equal(
    calls.some((c) => c.name === 'profile' || c.name === 'session'),
    false,
  );
});

test('list invalid query and detail invalid path/query fail before DB/auth', async () => {
  const { app, calls } = fixture();
  const cases = [
    ['?majorId=', 'INVALID_QUERY'],
    ['?majorId=0', 'INVALID_QUERY'],
    ['?majorId=-1', 'INVALID_QUERY'],
    ['?majorId=1.5', 'INVALID_QUERY'],
    ['?majorId=2147483648', 'INVALID_QUERY'],
    ['?majorId=1&majorId=1', 'INVALID_QUERY'],
    ['?page=1', 'INVALID_QUERY'],
    ['?majorId=1e2', 'INVALID_QUERY'],
    ['?majorId=%201', 'INVALID_QUERY'],
    ['/0', 'INVALID_ID'],
    ['/-1', 'INVALID_ID'],
    ['/1.5', 'INVALID_ID'],
    ['/abc', 'INVALID_ID'],
    ['/2147483648', 'INVALID_ID'],
    ['/1?majorId=4', 'INVALID_QUERY'],
  ];
  await withServer(app, async (url) => {
    for (const [path, code] of cases) {
      const r = await fetch(`${url}/api/guidance${path}`);
      assert.equal(r.status, 400, path);
      assert.equal((await r.json()).error.code, code, path);
    }
  });
  assert.equal(calls.length, 0);
});

test('explicit Active Major takes priority over Student profile', async () => {
  const token = await tokens.sign(identity);
  const { app, calls } = fixture();
  await withServer(app, async (url) => {
    const r = await fetch(`${url}/api/guidance?majorId=4`, bearer(token));
    assert.equal(r.status, 200);
  });
  assert.equal(
    calls.some((c) => c.name === 'profile'),
    false,
  );
  assert.deepEqual(calls.find((c) => c.name === 'category').args.where, {
    category_id: 4,
    type: 'Major',
    status: 'Active',
  });
});

test('explicit nonexistent/Closed/Skill category rejected with INVALID_FILTER', async () => {
  const { app, calls } = fixture({ category: async () => null });
  await withServer(app, async (url) => {
    const r = await fetch(`${url}/api/guidance?majorId=99`);
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error.code, 'INVALID_FILTER');
  });
  assert.equal(
    calls.some((c) => c.name === 'list'),
    false,
  );
});

test('Student valid session: only profile major_id selected and Active Major preferred', async () => {
  const { app, calls } = fixture({
    category: async (args) => ({
      ...major,
      category_id: args.where.category_id ?? 4,
    }),
  });
  await withServer(app, async (url) => {
    const r = await fetch(
      `${url}/api/guidance`,
      bearer(await tokens.sign(identity)),
    );
    assert.equal(r.status, 200);
    assert.equal((await r.json()).selectedMajor.id, 7);
  });
  assert.deepEqual(calls.find((c) => c.name === 'profile').args, {
    where: { user_id: 42 },
    select: { major_id: true },
  });
});

test('Student missing user, null/Closed Major falls back to first Active Major', async () => {
  for (const profile of [null, { major_id: null }, { major_id: 7 }]) {
    const { app, calls } = fixture({
      profile: async () => profile,
      category: async (args) => (args.where.category_id ? null : major),
    });
    await withServer(app, async (url) => {
      const r = await fetch(
        `${url}/api/guidance`,
        bearer(await tokens.sign(identity)),
      );
      assert.equal(r.status, 200);
      assert.equal((await r.json()).selectedMajor.id, 4);
    });
    assert.ok(calls.some((c) => c.name === 'category' && c.args.orderBy));
  }
});

test('Admin uses public fallback without profile lookup', async () => {
  const { app, calls } = fixture();
  await withServer(app, async (url) => {
    const r = await fetch(
      `${url}/api/guidance`,
      bearer(await tokens.sign({ ...identity, role: 'Admin' })),
    );
    assert.equal(r.status, 200);
  });
  assert.equal(
    calls.some((c) => c.name === 'profile'),
    false,
  );
});

test('malformed/invalid/expired optional tokens and revoked sessions behave as Guest', async () => {
  const expiredSigner = createAccessTokenService(
    tokenConfig,
    () => new Date(now.getTime() - 900_000),
  );
  for (const token of [
    'invalid',
    'a.b.c',
    await expiredSigner.sign(identity),
  ]) {
    const { app, calls } = fixture();
    await withServer(app, async (url) => {
      const r = await fetch(`${url}/api/guidance`, bearer(token));
      assert.equal(r.status, 200);
    });
    assert.equal(
      calls.some((c) => c.name === 'profile'),
      false,
    );
  }
  const { app, calls } = fixture({
    session: async () => ({
      user_id: 42,
      expires_at: new Date(now.getTime() + 60_000),
      revoked_at: now,
    }),
  });
  await withServer(app, async (url) => {
    const r = await fetch(
      `${url}/api/guidance`,
      bearer(await tokens.sign(identity)),
    );
    assert.equal(r.status, 200);
  });
  assert.equal(
    calls.some((c) => c.name === 'profile'),
    false,
  );
});

test('no Active Major exact empty result; no articles keeps selectedMajor', async () => {
  for (const noMajor of [true, false]) {
    const { app, calls } = fixture({
      category: async () => (noMajor ? null : major),
      list: async () => [],
    });
    await withServer(app, async (url) => {
      const r = await fetch(`${url}/api/guidance`);
      assert.equal(r.status, 200);
      assert.deepEqual(await r.json(), {
        selectedMajor: noMajor ? null : { id: 4, name: 'Major', type: 'Major' },
        stages: [],
      });
    });
    if (noMajor)
      assert.equal(
        calls.some((c) => c.name === 'list'),
        false,
      );
  }
});

test('public detail: Closed relations, no-year array, nullable plain text, no internal fields', async () => {
  const { app, calls } = fixture();
  await withServer(app, async (url) => {
    const r = await fetch(`${url}/api/guidance/81`);
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), {
      item: {
        id: 81,
        title: 'Article 81',
        publisher: null,
        descriptionText: 'Plain text <b>not rendered as HTML</b>',
        requirementsText: null,
        majors: [{ id: 4, name: 'Major', status: 'Closed' }],
        skills: [{ id: 31, name: 'Closed Skill', status: 'Closed' }],
        academicYears: [],
        createdAt: now.toISOString(),
      },
    });
  });
  const query = calls.find((c) => c.name === 'detail').args;
  assert.deepEqual(query.where, {
    opportunity_type: 'Bài viết định hướng',
    status: 'Approved',
    item_id: 81,
  });
  assert.deepEqual(query.select.majors.where, { major: { type: 'Major' } });
  assert.deepEqual(query.select.skills.where, { skill: { type: 'Skill' } });
});

test('missing, nonpublic or wrong-type detail returns identical 404', async () => {
  const { app } = fixture({ detail: async () => null });
  await withServer(app, async (url) => {
    const r = await fetch(`${url}/api/guidance/99`);
    assert.equal(r.status, 404);
    assert.deepEqual(await r.json(), {
      error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài nguyên.' },
    });
  });
});

test('category/list/detail/profile/session DB and unexpected errors never become fallback/empty', async (context) => {
  context.mock.method(console, 'error', () => {});
  for (const source of ['category', 'list', 'detail', 'profile', 'session']) {
    for (const unavailable of [true, false]) {
      const marker = 'private-driver-detail';
      const { app } = fixture({
        [source]: async () => {
          throw Object.assign(
            new Error(marker),
            unavailable ? { code: 'P1001' } : {},
          );
        },
      });
      await withServer(app, async (url) => {
        const r = await fetch(
          `${url}/api/guidance${source === 'detail' ? '/81' : ''}`,
          bearer(await tokens.sign(identity)),
        );
        assert.equal(r.status, unavailable ? 503 : 500, source);
        const body = await r.text();
        assert.equal(
          JSON.parse(body).error.code,
          unavailable ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_ERROR',
        );
        assert.equal(body.includes(marker), false);
      });
    }
  }
});

test('invalid Auth configuration propagates 503 instead of Guest fallback', async () => {
  const { app, calls } = fixture({
    verifyToken: async () => {
      throw new InvalidJwtConfigurationError();
    },
  });
  await withServer(app, async (url) => {
    for (const path of ['', '/81']) {
      const r = await fetch(`${url}/api/guidance${path}`, bearer('a.b.c'));
      assert.equal(r.status, 503);
      assert.equal((await r.json()).error.code, 'SERVICE_UNAVAILABLE');
    }
  });
  assert.equal(calls.length, 0);
});

const wrongGuidanceTypes = [
  'bài viết định hướng',
  'BÀI VIẾT ĐỊNH HƯỚNG',
  'Bài Viết Định Hướng',
  'Bai viet dinh huong',
  'Bài viết đinh hướng',
  'Bài viết định hướng ',
  'Bài viết định hướng'.normalize('NFD'),
  'Học bổng',
];

test('list/detail reject every non-exact opportunity_type even if MySQL equality admits it', async () => {
  const rows = [
    article(1),
    ...wrongGuidanceTypes.map((opportunity_type, index) => ({
      ...article(index + 2),
      opportunity_type,
    })),
  ];
  const { app } = fixture({
    list: async ({ select }) => {
      assert.equal(select.opportunity_type, true);
      return rows;
    },
    detail: async ({ where, select }) => {
      assert.equal(select.opportunity_type, true);
      return {
        ...rows.find((row) => row.item_id === where.item_id),
        publisher: null,
        description: null,
        requirements: null,
        majors: [],
      };
    },
  });
  await withServer(app, async (url) => {
    const response = await fetch(`${url}/api/guidance`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(
      body.stages.map((stage) => stage.items.map((item) => item.id)),
      [[1]],
    );
    assert.equal(JSON.stringify(body).includes('opportunity_type'), false);
    for (const row of rows) {
      const detail = await fetch(`${url}/api/guidance/${row.item_id}`);
      assert.equal(
        detail.status,
        row.item_id === 1 ? 200 : 404,
        row.opportunity_type,
      );
      const result = await detail.json();
      if (row.item_id === 1) assert.equal(result.item.id, 1);
      else assert.equal(result.error.code, 'NOT_FOUND');
    }
  });
});

const guidanceDatabaseUrl = process.env.TEST_GUIDANCE_DATABASE_URL;
test(
  'MySQL integration: exact guidance type for list/detail with collation variants',
  {
    skip:
      !guidanceDatabaseUrl && 'TEST_GUIDANCE_DATABASE_URL is not configured.',
  },
  async () => {
    const url = new URL(guidanceDatabaseUrl);
    assert.ok(
      url.protocol === 'mysql:' &&
        ['127.0.0.1', 'localhost'].includes(url.hostname) &&
        /^unihub_guidance_test[A-Za-z0-9_]*$/.test(
          decodeURIComponent(url.pathname.slice(1)),
        ),
      'Use only an isolated loopback unihub_guidance_test* database.',
    );
    const client = createPrismaClient(guidanceDatabaseUrl);
    const rollback = new Error('Rollback only this test transaction');
    try {
      await client.$transaction(
        async (tx) => {
          assert.equal(
            await tx.category.count(),
            0,
            'Refuse a populated test database.',
          );
          assert.equal(
            await tx.opportunity.count(),
            0,
            'Refuse a populated test database.',
          );
          const major = await tx.category.create({
            data: {
              type: 'Major',
              name: 'Guidance exact type integration',
              status: 'Active',
            },
          });
          const rows = [];
          for (const opportunity_type of [
            'Bài viết định hướng',
            ...wrongGuidanceTypes,
          ]) {
            rows.push(
              await tx.opportunity.create({
                data: {
                  opportunity_type,
                  title: 'Guidance exact type test',
                  publisher: 'Test only',
                  status: 'Approved',
                  majors: { create: { major_id: major.category_id } },
                  years: { create: { academic_year: 2 } },
                },
              }),
            );
          }
          const app = createApp({ guidance: { getPrismaClient: () => tx } });
          await withServer(app, async (baseUrl) => {
            const response = await fetch(
              `${baseUrl}/api/guidance?majorId=${major.category_id}`,
            );
            assert.equal(response.status, 200);
            const body = await response.json();
            assert.deepEqual(
              body.stages.map((stage) => stage.items.map((item) => item.id)),
              [[rows[0].item_id]],
            );
            for (const [index, row] of rows.entries()) {
              const detail = await fetch(
                `${baseUrl}/api/guidance/${row.item_id}`,
              );
              assert.equal(
                detail.status,
                index === 0 ? 200 : 404,
                row.opportunity_type,
              );
              const result = await detail.json();
              if (index === 0) assert.equal(result.item.id, row.item_id);
              else assert.equal(result.error.code, 'NOT_FOUND');
            }
          });
          throw rollback;
        },
        { timeout: 30000 },
      );
      assert.fail('Test transaction must roll back.');
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await client.$disconnect();
    }
  },
);
