import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createApp } from '../dist/app.js';

const evaluatedAt = new Date('2026-10-30T08:00:00Z');
const headers = { Authorization: 'Bearer admin.test.token' };
const endpoints = ['accounts', 'opportunities', 'forum'];
function fixture({
  role = 'Admin',
  empty = false,
  fail,
  error,
  session = true,
} = {}) {
  const calls = [];
  const users = empty
    ? []
    : [{ role: 'Admin' }, { role: 'Student' }, { role: 'Student' }];
  const opportunities = empty
    ? []
    : [
        ...['Thực tập', 'Việc làm', 'Học bổng'].flatMap((type) =>
          ['Pending', 'Approved', 'Rejected'].map((status) => ({
            opportunity_type: type,
            status,
          })),
        ),
        { opportunity_type: 'Thực tập', status: 'Approved' },
        ...['Pending', 'Approved', 'Rejected'].map((status) => ({
          opportunity_type: 'Bài viết định hướng',
          status,
        })),
        { opportunity_type: 'Thực tập', status: 'Unexpected' },
      ];
  const posts = empty
    ? []
    : [
        { post_id: 1, is_deleted: false },
        { post_id: 2, is_deleted: true },
      ];
  const comments = empty
    ? []
    : [
        { post_id: 1, is_deleted: false },
        { post_id: 1, is_deleted: true },
        { post_id: 2, is_deleted: false },
      ];
  const record = (name, args) => {
    calls.push([name, args]);
    if (fail === name) throw error ?? new Error('private test detail');
  };
  const client = {
    authSession: {
      findUnique: async () =>
        session
          ? { user_id: 1, revoked_at: null, expires_at: new Date('2099-01-01') }
          : null,
    },
    user: {
      count: async (args) => {
        record('accounts', args);
        return users.length;
      },
    },
    opportunity: {
      groupBy: async (args) => {
        record('opportunities', args);
        const counts = new Map();
        for (const row of opportunities)
          if (
            args.where.opportunity_type.in.includes(row.opportunity_type) &&
            args.where.status.in.includes(row.status)
          )
            counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
        return [...counts].map(([status, count]) => ({
          status,
          _count: { _all: count },
        }));
      },
    },
    forumPost: {
      count: async (args) => {
        record('posts', args);
        return posts.filter((r) => r.is_deleted === args.where.is_deleted)
          .length;
      },
    },
    comment: {
      count: async (args) => {
        record('comments', args);
        return comments.filter(
          (r) =>
            r.is_deleted === args.where.is_deleted &&
            posts.some(
              (p) =>
                p.post_id === r.post_id &&
                p.is_deleted === args.where.post.is_deleted,
            ),
        ).length;
      },
    },
  };
  return {
    calls,
    opportunities,
    app: createApp({
      dashboard: {
        getPrismaClient: () => client,
        verifyToken: async () => ({
          userId: 1,
          role,
          sessionId: 'test-session',
          issuedAt: 1,
          expiresAt: 9999999999,
        }),
        now: () => evaluatedAt,
        getEvaluatedAt: () => evaluatedAt,
      },
    }),
  };
}
async function withServer(f, callback) {
  const server = f.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await callback(
      `http://127.0.0.1:${server.address().port}/api/admin/dashboard`,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('all three metrics require valid shared session and Admin role before metric queries', async () => {
  for (const config of [
    { headers: {}, status: 401 },
    { role: 'Student', headers, status: 403 },
    { session: false, headers, status: 401 },
  ]) {
    const f = fixture(config);
    await withServer(f, async (url) => {
      for (const endpoint of endpoints) {
        const response = await fetch(`${url}/${endpoint}`, {
          headers: config.headers,
        });
        assert.equal(response.status, config.status);
        assert.equal(
          (await response.json()).error.code,
          config.status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED',
        );
      }
    });
    assert.deepEqual(f.calls, []);
  }
});

test('exact responses count all accounts, allowed opportunity types/statuses, and visible forum rows', async () => {
  const f = fixture();
  const expected = [
    { totalAccounts: 3, evaluatedAt: '2026-10-30T08:00:00Z' },
    {
      byStatus: { Pending: 3, Approved: 4, Rejected: 3 },
      evaluatedAt: '2026-10-30T08:00:00Z',
    },
    { posts: 1, comments: 1, evaluatedAt: '2026-10-30T08:00:00Z' },
  ];
  await withServer(f, async (url) => {
    for (const [index, endpoint] of endpoints.entries()) {
      const response = await fetch(`${url}/${endpoint}`, { headers });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), expected[index]);
    }
  });
  assert.deepEqual(f.calls, [
    ['accounts', undefined],
    [
      'opportunities',
      {
        by: ['status'],
        where: {
          opportunity_type: { in: ['Thực tập', 'Việc làm', 'Học bổng'] },
          status: { in: ['Pending', 'Approved', 'Rejected'] },
        },
        _count: { _all: true },
      },
    ],
    ['posts', { where: { is_deleted: false } }],
    ['comments', { where: { is_deleted: false, post: { is_deleted: false } } }],
  ]);
});

test('empty data preserves every zero field; missing grouped statuses are zero', async () => {
  const f = fixture({ empty: true });
  await withServer(f, async (url) => {
    const bodies = await Promise.all(
      endpoints.map(async (endpoint) =>
        (await fetch(`${url}/${endpoint}`, { headers })).json(),
      ),
    );
    assert.deepEqual(bodies, [
      { totalAccounts: 0, evaluatedAt: '2026-10-30T08:00:00Z' },
      {
        byStatus: { Pending: 0, Approved: 0, Rejected: 0 },
        evaluatedAt: '2026-10-30T08:00:00Z',
      },
      { posts: 0, comments: 0, evaluatedAt: '2026-10-30T08:00:00Z' },
    ]);
    f.opportunities.push({ opportunity_type: 'Học bổng', status: 'Pending' });
    assert.deepEqual(
      (await (await fetch(url + '/opportunities', { headers })).json())
        .byStatus,
      { Pending: 1, Approved: 0, Rejected: 0 },
    );
  });
});

async function requestWithBody(url, chunked = false) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      url,
      {
        method: 'GET',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          ...(chunked
            ? { 'Transfer-Encoding': 'chunked' }
            : { 'Content-Length': '2' }),
        },
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () =>
          resolve({ status: response.statusCode, body: JSON.parse(body) }),
        );
      },
    );
    request.on('error', reject);
    request.end('{}');
  });
}

test('all endpoints reject queries and bodies before metric access', async () => {
  const f = fixture();
  await withServer(f, async (url) => {
    for (const endpoint of endpoints) {
      for (const query of ['?page=1', '?extra=', '?x=1&x=2']) {
        const response = await fetch(`${url}/${endpoint}${query}`, { headers });
        assert.equal(response.status, 400);
        assert.equal((await response.json()).error.code, 'INVALID_QUERY');
      }
      for (const chunked of [false, true]) {
        const response = await requestWithBody(`${url}/${endpoint}`, chunked);
        assert.equal(response.status, 400);
        assert.equal(response.body.error.code, 'INVALID_REQUEST');
      }
    }
  });
  assert.deepEqual(f.calls, []);
});

test('database/unexpected failures return private error envelopes and other metrics still succeed', async (context) => {
  context.mock.method(console, 'error', () => {});
  for (const fail of ['accounts', 'opportunities', 'posts', 'comments']) {
    for (const [code, status, publicCode] of [
      ['P1001', 503, 'SERVICE_UNAVAILABLE'],
      ['UNKNOWN', 500, 'INTERNAL_ERROR'],
    ]) {
      const f = fixture({
        fail,
        error: Object.assign(new Error('private test detail'), { code }),
      });
      await withServer(f, async (url) => {
        const failedEndpoint = ['posts', 'comments'].includes(fail)
          ? 'forum'
          : fail;
        for (const endpoint of endpoints) {
          const response = await fetch(`${url}/${endpoint}`, { headers });
          if (endpoint === failedEndpoint) {
            assert.equal(response.status, status);
            const body = await response.json();
            assert.deepEqual(body, {
              error: {
                code: publicCode,
                message:
                  status === 503
                    ? 'Database hiện không sẵn sàng.'
                    : 'Máy chủ gặp lỗi nội bộ.',
              },
            });
            assert.equal(
              JSON.stringify(body).includes('private test detail'),
              false,
            );
          } else assert.equal(response.status, 200);
        }
      });
    }
  }
});
