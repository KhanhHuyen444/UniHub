import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createApp } from '../dist/app.js';

const headers = { Authorization: 'Bearer test.access.token' };
const date = new Date('2026-10-28T00:00:00Z');
function fixture({
  role = 'Student',
  userId = 1,
  failure,
  empty = false,
} = {}) {
  const rows = empty
    ? []
    : [
        {
          notification_id: 1,
          user_id: 1,
          event_id: 5,
          type: 'Reminder',
          content: 'Reminder',
          is_read: false,
          created_at: date,
        },
        {
          notification_id: 2,
          user_id: 1,
          event_id: null,
          type: 'Violation',
          content: 'Reason',
          is_read: true,
          created_at: date,
        },
        {
          notification_id: 3,
          user_id: 1,
          event_id: 6,
          type: 'Reminder',
          content: 'Old reminder',
          is_read: false,
          created_at: new Date('2020-01-01T00:00:00Z'),
        },
        {
          notification_id: 4,
          user_id: 2,
          event_id: 7,
          type: 'Reminder',
          content: 'Private',
          is_read: false,
          created_at: date,
        },
      ];
  const calls = [];
  const matches = (row, where) =>
    Object.entries(where).every(([key, value]) => row[key] === value);
  const client = {
    authSession: {
      findUnique: async () => ({
        user_id: userId,
        expires_at: new Date('2099-01-01'),
        revoked_at: null,
      }),
    },
    notification: {
      findMany: async (args) => {
        calls.push(['findMany', args]);
        if (failure) throw failure;
        return rows
          .filter((r) => matches(r, args.where))
          .sort(
            (a, b) =>
              b.created_at - a.created_at ||
              b.notification_id - a.notification_id,
          )
          .slice(args.skip, args.skip + args.take);
      },
      count: async (args) => {
        calls.push(['count', args]);
        return rows.filter((r) => matches(r, args.where)).length;
      },
      updateMany: async (args) => {
        calls.push(['updateMany', args]);
        if (failure) throw failure;
        const found = rows.filter((r) => matches(r, args.where));
        found.forEach((r) => Object.assign(r, args.data));
        return { count: found.length };
      },
      findFirst: async (args) => {
        calls.push(['findFirst', args]);
        return rows.find((r) => matches(r, args.where)) ?? null;
      },
    },
    $transaction: async (callback, options) => {
      calls.push(['transaction', options]);
      return callback(client);
    },
  };
  return {
    rows,
    calls,
    app: createApp({
      notifications: {
        getPrismaClient: () => client,
        verifyToken: async () => ({
          userId,
          role,
          sessionId: 'session',
          issuedAt: 1,
          expiresAt: 9999999999,
        }),
      },
    }),
  };
}
async function withServer(f, callback) {
  const server = f.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await callback(
      `http://127.0.0.1:${server.address().port}/api/notifications`,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('list defaults, exact DTO, stable ties, global unread count and snapshot transaction', async () => {
  const f = fixture();
  await withServer(f, async (url) => {
    const response = await fetch(url, { headers });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.meta, {
      page: 1,
      pageSize: 20,
      total: 3,
      totalPages: 1,
    });
    assert.equal(body.unreadCount, 2);
    assert.deepEqual(
      body.items.map((r) => r.id),
      [2, 1, 3],
    );
    assert.deepEqual(body.items[0], {
      id: 2,
      type: 'Violation',
      content: 'Reason',
      isRead: true,
      createdAt: '2026-10-28T00:00:00Z',
      eventId: null,
    });
    assert.equal(
      body.items.some((r) => r.content === 'Private'),
      false,
    );
  });
  assert.deepEqual(f.calls[0], [
    'transaction',
    { isolationLevel: 'RepeatableRead' },
  ]);
  assert.deepEqual(f.calls[1][1].orderBy, [
    { created_at: 'desc' },
    { notification_id: 'desc' },
  ]);
  assert.deepEqual(f.calls[1][1].where, { user_id: 1 });
  assert.deepEqual(f.calls[3][1].where, { user_id: 1, is_read: false });
});

test('pagination retains global totals/unread outside page and supports out-of-range pages', async () => {
  const f = fixture();
  await withServer(f, async (url) => {
    for (const [query, ids, page, pageSize] of [
      ['?page=2&pageSize=1', [1], 2, 1],
      ['?page=4&pageSize=1', [], 4, 1],
      ['?page=1000000&pageSize=100', [], 1000000, 100],
    ]) {
      const response = await fetch(url + query, { headers });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(
        body.items.map((r) => r.id),
        ids,
      );
      assert.deepEqual(body.meta, {
        page,
        pageSize,
        total: 3,
        totalPages: Math.ceil(3 / pageSize),
      });
      assert.equal(body.unreadCount, 2);
    }
  });
  const empty = fixture({ empty: true });
  await withServer(empty, async (url) => {
    assert.deepEqual(await (await fetch(url, { headers })).json(), {
      items: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      unreadCount: 0,
    });
  });
});

test('pagination rejects unknown, duplicate, blank, noninteger and out-of-range query before data access', async () => {
  const f = fixture();
  await withServer(f, async (url) => {
    for (const query of [
      'userId=2',
      'filter=unread',
      'page=1&page=2',
      'pageSize=1&pageSize=2',
      'page=',
      'page=0',
      'page=-1',
      'page=1.5',
      'page=1e2',
      'page=1000001',
      'pageSize=0',
      'pageSize=101',
      'pageSize=abc',
      'pageSize=',
      'page=+1',
    ]) {
      const response = await fetch(`${url}?${query}`, { headers });
      assert.equal(response.status, 400, query);
      assert.equal((await response.json()).error.code, 'INVALID_QUERY');
    }
  });
  assert.equal(f.calls.length, 0);
});

test('both endpoints require login and Student role before notification access', async () => {
  for (const role of ['Student', 'Admin']) {
    const f = fixture({ role });
    await withServer(f, async (url) => {
      for (const options of [{}, { headers }]) {
        if (role === 'Student' && options.headers) continue;
        for (const [path, method] of [
          ['', 'GET'],
          ['/1/read', 'PATCH'],
        ]) {
          const response = await fetch(url + path, { ...options, method });
          assert.equal(response.status, options.headers ? 403 : 401);
        }
      }
    });
    assert.equal(f.calls.length, 0);
  }
});

test('mark read is idempotent, changes only owner flag, and updates global unread count', async () => {
  const f = fixture();
  await withServer(f, async (url) => {
    for (let i = 0; i < 2; i++) {
      const response = await fetch(url + '/1/read', {
        headers,
        method: 'PATCH',
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        notification: { id: 1, isRead: true },
      });
    }
    const body = await (await fetch(url, { headers })).json();
    assert.equal(body.unreadCount, 1);
    assert.equal(body.meta.total, 3);
  });
  assert.equal(f.rows[0].is_read, true);
  assert.equal(f.rows[3].is_read, false);
  assert.deepEqual(f.calls[0][1], {
    where: { notification_id: 1, user_id: 1, is_read: false },
    data: { is_read: true },
  });
});

test('missing and cross-owner notifications produce identical 404 and do not change rows', async () => {
  const f = fixture();
  await withServer(f, async (url) => {
    let previous;
    for (const id of [999, 4]) {
      const response = await fetch(`${url}/${id}/read`, {
        headers,
        method: 'PATCH',
      });
      assert.equal(response.status, 404);
      const body = await response.json();
      assert.equal(body.error.code, 'NOT_FOUND');
      if (previous) assert.deepEqual(body, previous);
      previous = body;
    }
  });
  assert.equal(
    f.rows.every((r) => r.notification_id === 2 || !r.is_read),
    true,
  );
});

test('read rejects invalid IDs, body and query before notification access', async () => {
  const f = fixture();
  await withServer(f, async (url) => {
    for (const id of ['0', '-1', '1.5', '2147483648', 'abc']) {
      const response = await fetch(`${url}/${id}/read`, {
        headers,
        method: 'PATCH',
      });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, 'INVALID_ID');
    }
    for (const [suffix, body, code] of [
      ['?userId=2', undefined, 'INVALID_QUERY'],
      ['', '{}', 'INVALID_REQUEST'],
      ['', 'null', 'INVALID_JSON'],
    ]) {
      const response = await fetch(url + '/1/read' + suffix, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body,
      });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, code);
    }
  });
  assert.equal(f.calls.length, 0);
});

test('database errors stay errors, preserve privacy and never return an empty success', async (context) => {
  context.mock.method(console, 'error', () => {});
  for (const [code, status, publicCode] of [
    ['P1001', 503, 'SERVICE_UNAVAILABLE'],
    ['UNKNOWN', 500, 'INTERNAL_ERROR'],
  ]) {
    const f = fixture({
      failure: Object.assign(new Error('private-test-detail'), { code }),
    });
    await withServer(f, async (url) => {
      for (const [suffix, method] of [
        ['', 'GET'],
        ['/1/read', 'PATCH'],
      ]) {
        const response = await fetch(url + suffix, { headers, method });
        assert.equal(response.status, status);
        const text = await response.text();
        assert.equal(JSON.parse(text).error.code, publicCode);
        assert.equal(text.includes('private-test-detail'), false);
      }
    });
  }
});
