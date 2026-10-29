import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { test } from 'node:test';
import { createApp } from '../dist/app.js';
import {
  createAccessTokenService,
  InvalidJwtConfigurationError,
} from '../dist/modules/auth/access-token.js';

const now = new Date('2026-11-05T17:00:00Z');
const config = {
  signingSecret: 'recommendations-only-test-signing-secret-32-bytes',
  issuer: 'https://recommendations.test.invalid',
  audience: 'recommendations-test',
};
const signer = createAccessTokenService(config, () => now);
const identity = {
  userId: 42,
  role: 'Student',
  sessionId: 'd7f55cee-2d7c-4df9-aece-36b6eb446db5',
};
const complete = { major_id: 4, academic_year: 2, skills: [{ skill_id: 31 }] };
const article = (id, overrides = {}) => ({
  item_id: id,
  opportunity_type: 'Thực tập',
  status: 'Approved',
  title: `Opportunity ${id}`,
  publisher: 'Publisher',
  work_format: 'Online',
  location: 'Must be hidden',
  is_verified: false,
  deadline: null,
  deadline_source_date: null,
  deadline_source_timezone: null,
  majors: [{ major_id: 4 }],
  skills: [{ skill_id: 31 }],
  years: [{ academic_year: 2 }],
  ...overrides,
});
async function fixture({
  profile = complete,
  rows = [article(1)],
  errorSource,
  unavailable = false,
  session,
  verifyToken,
  evaluatedAt = now,
} = {}) {
  const calls = [];
  const fail = (source) => {
    calls.push(source);
    if (errorSource === source)
      throw Object.assign(
        new Error('private-database-config'),
        unavailable ? { code: 'P1001' } : {},
      );
  };
  const transaction = {
    user: {
      findUnique: async (args) => {
        fail('profile');
        calls.push(args);
        return profile;
      },
    },
    opportunity: {
      findMany: async (args) => {
        fail('candidates');
        calls.push(args);
        return rows;
      },
    },
  };
  const app = createApp({
    recommendations: {
      getPrismaClient: () => ({
        $transaction: async (callback, options) => {
          fail('transaction');
          assert.equal(options.isolationLevel, 'RepeatableRead');
          return callback(transaction);
        },
      }),
      getEvaluatedAt: () => {
        calls.push('clock');
        return evaluatedAt;
      },
      auth: {
        now: () => now,
        verifyToken: verifyToken ?? signer.verify,
        getPrismaClient: () => ({
          authSession: {
            findUnique: async () => {
              fail('session');
              return session === undefined
                ? {
                    user_id: 42,
                    revoked_at: null,
                    expires_at: new Date(now.getTime() + 60_000),
                  }
                : session;
            },
          },
        }),
      },
    },
  });
  return {
    app,
    calls,
    token: await signer.sign(identity),
    adminToken: await signer.sign({ ...identity, role: 'Admin' }),
  };
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
async function list(f, callback) {
  await withServer(f.app, async (base) =>
    callback(await fetch(`${base}/api/recommendations`, bearer(f.token))),
  );
}

test('valid Student: own DB profile, shared list serializer, single evaluatedAt and no private fields', async () => {
  const f = await fixture();
  await list(f, async (response) => {
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      items: [
        {
          id: 1,
          type: 'Thực tập',
          title: 'Opportunity 1',
          publisher: 'Publisher',
          workFormat: 'Online',
          location: null,
          deadline: null,
          isVerified: false,
          matchScore: 1,
        },
      ],
      meta: { evaluatedAt: '2026-11-05T17:00:00Z' },
    });
  });
  const queries = f.calls.filter((value) => typeof value === 'object');
  assert.deepEqual(queries[0], {
    where: { user_id: 42 },
    select: {
      major_id: true,
      academic_year: true,
      skills: { select: { skill_id: true } },
    },
  });
  assert.equal(queries[1].where.status, 'Approved');
  assert.deepEqual(queries[1].where.opportunity_type.in, [
    'Thực tập',
    'Việc làm',
    'Học bổng',
  ]);
  assert.deepEqual(queries[1].where.OR, [
    { deadline: null },
    { deadline_source_date: { not: null }, deadline: { gt: now } },
    { deadline_source_timezone: { not: null }, deadline: { gte: now } },
  ]);
  assert.deepEqual(queries[1].select.majors, { select: { major_id: true } });
  assert.deepEqual(queries[1].select.skills, { select: { skill_id: true } });
  assert.equal(f.calls.filter((entry) => entry === 'clock').length, 1);
});

test('Guest/malformed/tampered/expired JWT and Admin are denied before profile/candidates', async () => {
  const f = await fixture();
  const expired = createAccessTokenService(
    config,
    () => new Date(now.getTime() - 900_000),
  );
  const [header, payload, signature] = f.token.split('.');
  const tampered = `${header}.${payload}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
  await withServer(f.app, async (base) => {
    for (const [token, status] of [
      [undefined, 401],
      ['invalid', 401],
      [tampered, 401],
      [await expired.sign(identity), 401],
      [f.adminToken, 403],
    ]) {
      const response = await fetch(
        `${base}/api/recommendations`,
        token ? bearer(token) : {},
      );
      assert.equal(response.status, status);
      assert.equal(
        (await response.json()).error.code,
        status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
      );
    }
  });
  assert.equal(f.calls.includes('transaction'), false);
});

test('missing/revoked/expired/other-user sessions are unauthorized', async () => {
  for (const session of [
    null,
    {
      user_id: 42,
      revoked_at: now,
      expires_at: new Date(now.getTime() + 60000),
    },
    { user_id: 42, revoked_at: null, expires_at: now },
    {
      user_id: 43,
      revoked_at: null,
      expires_at: new Date(now.getTime() + 60000),
    },
  ]) {
    const f = await fixture({ session });
    await list(f, async (response) => {
      assert.equal(response.status, 401);
    });
    assert.equal(f.calls.includes('profile'), false);
  }
});

test('all query parameters and actual GET bodies return INVALID_QUERY before auth/DB', async () => {
  const f = await fixture();
  await withServer(f.app, async (base) => {
    for (const query of [
      '?userId=999',
      '?majorId=4',
      '?page=1',
      '?score=1&score=0',
      '?role=Student',
    ]) {
      const response = await fetch(
        `${base}/api/recommendations${query}`,
        bearer(f.token),
      );
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, 'INVALID_QUERY');
    }
    for (const chunked of [false, true]) {
      for (const contentType of ['application/json', 'text/plain']) {
        const result = await new Promise((resolve, reject) => {
          const request = httpRequest(
            `${base}/api/recommendations`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${f.token}`,
                'Content-Type': contentType,
                ...(chunked
                  ? { 'Transfer-Encoding': 'chunked' }
                  : { 'Content-Length': 2 }),
              },
            },
            (response) => {
              let text = '';
              response.on('data', (chunk) => {
                text += chunk;
              });
              response.on('end', () =>
                resolve({ status: response.statusCode, text }),
              );
              response.on('error', reject);
            },
          );
          request.on('error', reject);
          request.end('{}');
        });
        assert.equal(result.status, 400);
        assert.equal(JSON.parse(result.text).error.code, 'INVALID_QUERY');
      }
    }
  });
  assert.deepEqual(f.calls, []);
});

test('incomplete profile differs from empty recommendations and prevents candidate reads', async () => {
  for (const profile of [
    null,
    { ...complete, major_id: null },
    ...[null, 0, 5, 1.5].map((academic_year) => ({
      ...complete,
      academic_year,
    })),
    { ...complete, skills: [] },
  ]) {
    const f = await fixture({ profile });
    await list(f, async (response) => {
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error.code, 'PROFILE_INCOMPLETE');
    });
    assert.equal(f.calls.includes('candidates'), false);
  }
  for (const rows of [[], [article(1, { majors: [], years: [] })]]) {
    const f = await fixture({ rows });
    await list(f, async (response) => {
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        items: [],
        meta: { evaluatedAt: '2026-11-05T17:00:00Z' },
      });
    });
  }
});

test('40/30/30 formula, empty year, no required skills, and threshold exactly 0.5', async () => {
  const f = await fixture({
    rows: [
      article(1),
      article(2, { majors: [] }), // 0 + .3 + .3
      article(3, { years: [] }), // .4 + 0 + .3
      article(4, { skills: [] }), // .4 + .3 + .3
      article(5, { years: [], skills: [{ skill_id: 31 }, { skill_id: 32 }] }), // .55
      article(6, {
        years: [],
        skills: [{ skill_id: 31 }, { skill_id: 32 }, { skill_id: 33 }],
      }), // .5
      article(7, { majors: [], skills: [{ skill_id: 99 }] }), // .3
      article(8, { years: [], skills: [{ skill_id: 99 }] }), // .4
    ],
  });
  await list(f, async (response) => {
    assert.equal(response.status, 200);
    assert.deepEqual(
      (await response.json()).items.map(({ id, matchScore }) => [
        id,
        matchScore,
      ]),
      [
        [1, 1],
        [4, 1],
        [3, 0.7],
        [2, 0.6],
        [5, 0.55],
        [6, 0.5],
      ],
    );
  });
});

test('Closed Major and Skills count by ID in numerator/denominator; names and status do not affect score', async () => {
  for (const status of ['Active', 'Closed']) {
    const f = await fixture({
      profile: {
        major_id: 4,
        academic_year: 2,
        skills: [{ skill_id: 31, status }],
      },
      rows: [
        article(1, {
          majors: [{ major_id: 4, status }],
          skills: [
            { skill_id: 31, status: 'Closed' },
            { skill_id: 32, status: 'Active' },
          ],
        }),
      ],
    });
    await list(f, async (response) => {
      assert.equal((await response.json()).items[0].matchScore, 0.85);
    });
  }
});

test('raw threshold and raw score sorting precede 4-decimal response rounding', async () => {
  const required = (count) =>
    Array.from({ length: count }, (_, index) => ({ skill_id: index + 1 }));
  const f = await fixture({
    profile: { ...complete, skills: required(10000) },
    rows: [
      article(1, {
        years: [],
        skills: required(30000),
        deadline: new Date(now.getTime() + 1000),
        deadline_source_timezone: 'UTC',
      }),
      article(99, { years: [], skills: required(29999) }),
      article(2, { years: [], skills: required(30001) }),
    ],
  });
  await list(f, async (response) => {
    assert.equal(response.status, 200);
    assert.deepEqual(
      (await response.json()).items.map(({ id, matchScore }) => [
        id,
        matchScore,
      ]),
      [
        [99, 0.5],
        [1, 0.5],
      ],
    );
  });
});

test('candidate visibility, date-only cutoff, datetime equality, NULL and legacy unknown', async () => {
  const f = await fixture({
    rows: [
      article(1, { opportunity_type: 'Việc làm' }),
      article(2, { opportunity_type: 'Học bổng' }),
      article(3, { status: 'Pending' }),
      article(4, { status: 'Rejected' }),
      article(5, { status: 'approved' }),
      article(6, { opportunity_type: 'Bài viết định hướng' }),
      article(7, { opportunity_type: 'thực tập' }),
      article(8, { opportunity_type: 'Viec lam' }),
      article(9, {
        deadline: now,
        deadline_source_date: new Date('2026-11-05T00:00:00Z'),
      }),
      article(10, {
        deadline: now,
        deadline_source_timezone: 'Asia/Ho_Chi_Minh',
      }),
      article(11, {
        deadline: new Date(now.getTime() - 1),
        deadline_source_timezone: 'UTC',
      }),
      article(12, { deadline: new Date(now.getTime() + 1000) }), // unknown, future is not enough
      article(13, {
        deadline: new Date(now.getTime() + 1),
        deadline_source_date: new Date('2026-11-05T00:00:00Z'),
      }),
    ],
  });
  await list(f, async (response) => {
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(
      body.items.map(({ id }) => id),
      [10, 13, 1, 2],
    );
    assert.deepEqual(body.items[0].deadline, {
      precision: 'datetime',
      date: '2026-11-06',
      sourceTimeZone: 'Asia/Ho_Chi_Minh',
      instant: '2026-11-05T17:00:00Z',
      state: 'open',
    });
    assert.equal(body.items[1].deadline.precision, 'date');
    assert.equal(body.items[1].deadline.date, '2026-11-05');
  });
});

test('tied raw scores sort known deadlines ASC, NULL last, then ID, independently of query order', async () => {
  const known = {
    deadline: new Date(now.getTime() + 1000),
    deadline_source_timezone: 'UTC',
  };
  const f = await fixture({
    rows: [
      article(8),
      article(4, known),
      article(7),
      article(2, known),
      article(3, { ...known, deadline: new Date(now.getTime() + 2000) }),
    ],
  });
  await list(f, async (response) => {
    assert.deepEqual(
      (await response.json()).items.map(({ id }) => id),
      [2, 4, 3, 7, 8],
    );
  });
});

test('session/profile/candidates/transaction failures use safe 503/500, never empty results', async (context) => {
  context.mock.method(console, 'error', () => {});
  for (const errorSource of [
    'session',
    'transaction',
    'profile',
    'candidates',
  ]) {
    for (const unavailable of [true, false]) {
      const f = await fixture({ errorSource, unavailable });
      await list(f, async (response) => {
        assert.equal(response.status, unavailable ? 503 : 500);
        const text = await response.text();
        assert.equal(text.includes('private-database-config'), false);
        assert.equal(
          JSON.parse(text).error.code,
          unavailable ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_ERROR',
        );
      });
    }
  }
  const f = await fixture({
    verifyToken: async () => {
      throw new InvalidJwtConfigurationError();
    },
  });
  await list(f, async (response) => {
    assert.equal(response.status, 503);
  });
});
