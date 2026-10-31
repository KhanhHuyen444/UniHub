import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { request as httpRequest } from 'node:http';
import { createApp } from '../dist/app.js';
import { createAccessTokenService } from '../dist/modules/auth/access-token.js';

const now = new Date('2026-10-29T00:00:00Z');
const tokens = createAccessTokenService(
  {
    signingSecret: 'admin-categories-test-only-signing-secret-32-bytes',
    issuer: 'https://categories.test.invalid',
    audience: 'categories-test',
  },
  () => now,
);
const identity = {
  userId: 9,
  role: 'Admin',
  sessionId: 'd7f55cee-2d7c-4df9-aece-36b6eb446db5',
};
const createdAt = '2026-10-28T18:30:00.000Z';
const initial = [
  {
    category_id: 1,
    type: 'Major',
    name: 'A',
    status: 'Active',
    created_at: new Date(createdAt),
  },
  {
    category_id: 2,
    type: 'Major',
    name: 'B',
    status: 'Active',
    created_at: new Date(createdAt),
  },
  {
    category_id: 3,
    type: 'Skill',
    name: 'SQL',
    status: 'Closed',
    created_at: new Date(createdAt),
  },
];

async function fixture({
  logError,
  duplicate,
  transactionError,
  queryError,
} = {}) {
  let state = structuredClone(initial);
  let logs = [];
  let transactions = 0;
  let businessCalls = 0;
  let queue = Promise.resolve();
  const client = {
    category: {
      findMany: async ({ where, select, orderBy }) => {
        businessCalls++;
        if (queryError) throw queryError;
        assert.deepEqual(select, {
          category_id: true,
          type: true,
          name: true,
          status: true,
          created_at: true,
        });
        assert.deepEqual(orderBy, [{ name: 'asc' }, { category_id: 'asc' }]);
        return state.filter((row) => row.type === where.type);
      },
    },
    $transaction: async (callback, options) => {
      transactions++;
      if (transactionError) throw transactionError;
      assert.equal(options.isolationLevel, 'RepeatableRead');
      const previous = queue;
      let unlock;
      queue = new Promise((resolve) => {
        unlock = resolve;
      });
      await previous;
      const rows = structuredClone(state);
      const entries = structuredClone(logs);
      const tx = {
        $queryRaw: async (parts) => {
          assert.match(parts.join(''), /ORDER BY category_id FOR UPDATE/);
          businessCalls++;
          return structuredClone(rows);
        },
        category: {
          create: async ({ data }) => {
            if (duplicate) throw { code: 'P2002' };
            const row = {
              category_id: 10,
              created_at: new Date(createdAt),
              ...data,
            };
            rows.push(row);
            return row;
          },
          update: async ({ where, data }) => {
            if (duplicate) throw { code: 'P2002' };
            const row = rows.find(
              (row) => row.category_id === where.category_id,
            );
            Object.assign(row, data);
            return row;
          },
        },
        activityLog: {
          create: async ({ data }) => {
            if (logError) throw logError;
            entries.push(data);
            return { log_id: entries.length };
          },
        },
      };
      try {
        const result = await callback(tx);
        state = rows;
        logs = entries;
        return result;
      } finally {
        unlock();
      }
    },
  };
  const app = createApp({
    adminCategories: {
      getPrismaClient: () => client,
      auth: {
        verifyToken: tokens.verify,
        now: () => now,
        getPrismaClient: () => ({
          authSession: {
            findUnique: async () => ({
              user_id: 9,
              revoked_at: null,
              expires_at: new Date(now.getTime() + 60_000),
            }),
          },
        }),
      },
    },
  });
  return {
    app,
    token: await tokens.sign(identity),
    student: await tokens.sign({ ...identity, role: 'Student' }),
    snapshot: () => ({ state, logs, transactions, businessCalls }),
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
async function send(base, token, method, path = '', body) {
  return fetch(`${base}/api/admin/categories${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

test('Admin create/list/rename/close/reopen use compact shared audit and preserve IDs', async () => {
  const f = await fixture();
  await withServer(f.app, async (base) => {
    const created = await send(base, f.token, 'POST', '', {
      type: 'Skill',
      name: '  TypeScript  ',
      reason: 'New skill',
    });
    assert.equal(created.status, 201);
    assert.deepEqual(await created.json(), {
      category: {
        id: 10,
        type: 'Skill',
        name: 'TypeScript',
        status: 'Active',
        createdAt,
      },
    });
    const list = await send(base, f.token, 'GET', '?type=Skill');
    assert.equal(list.status, 200);
    assert.deepEqual(
      (await list.json()).items.map((row) => {
        assert.equal(row.createdAt, createdAt);
        return row.status;
      }),
      ['Closed', 'Active'],
    );
    for (const [path, body] of [
      ['/3', { name: 'SQL updated' }],
      ['/1/status', { status: 'Closed', reason: 'Close one' }],
      ['/1/status', { status: 'Active' }],
    ]) {
      const response = await send(base, f.token, 'PATCH', path, body);
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.changed, true);
      assert.equal(result.category.createdAt, createdAt);
    }
  });
  const { logs, state } = f.snapshot();
  assert.deepEqual(
    state.map((row) => row.category_id),
    [1, 2, 3, 10],
  );
  assert.deepEqual(
    logs.map((log) => log.action_type),
    ['CREATE_CATEGORY', 'RENAME_CATEGORY', 'CLOSE_CATEGORY', 'REOPEN_CATEGORY'],
  );
  assert.ok(
    logs.every((log) => log.admin_id === 9 && log.target_type === 'Category'),
  );
  assert.equal(logs[0].old_value, null);
  assert.equal(
    logs[0].new_value,
    '{"type":"Skill","name":"TypeScript","status":"Active"}',
  );
  assert.equal(logs[0].reason, 'New skill');
  assert.equal(logs[1].old_value, '{"name":"SQL"}');
  assert.equal(logs[1].new_value, '{"name":"SQL updated"}');
  assert.equal(logs[2].old_value, '{"status":"Active"}');
  assert.equal(logs[2].new_value, '{"status":"Closed"}');
});

test('Guest/Student denied on every Admin operation before category access', async () => {
  const f = await fixture();
  await withServer(f.app, async (base) => {
    for (const [token, expected] of [
      [undefined, 401],
      ['invalid', 401],
      [f.student, 403],
    ]) {
      for (const [method, path, body] of [
        ['GET', '?type=Major'],
        ['POST', '', { type: 'Major', name: 'X' }],
        ['PATCH', '/1', { name: 'X' }],
        ['PATCH', '/1/status', { status: 'Closed' }],
      ]) {
        const response = await send(base, token, method, path, body);
        assert.equal(response.status, expected);
        assert.equal(
          (await response.json()).error.code,
          expected === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
        );
      }
    }
  });
  assert.equal(f.snapshot().businessCalls, 0);
  assert.equal(f.snapshot().transactions, 0);
});

test('strict query/path/body validation rejects invalid requests before mutation', async () => {
  const f = await fixture();
  const cases = [
    ['GET', '', undefined, 'INVALID_QUERY'],
    ['GET', '?type=major', undefined, 'INVALID_QUERY'],
    ['GET', '?type=Skill&type=Skill', undefined, 'INVALID_QUERY'],
    ['GET', '?type=Major&status=Active', undefined, 'INVALID_QUERY'],
    ['POST', '?type=Major', { type: 'Major', name: 'X' }, 'INVALID_QUERY'],
    ['POST', '', [], 'INVALID_REQUEST'],
    [
      'POST',
      '',
      {
        type: 'Major',
        name: 'X',
        status: 'Active',
      },
      'INVALID_REQUEST',
    ],
    ['POST', '', { type: 'major', name: 'X' }, 'VALIDATION_ERROR'],
    ['POST', '', { type: 'Skill' }, 'VALIDATION_ERROR'],
    ['POST', '', { type: 'Skill', name: '  ' }, 'VALIDATION_ERROR'],
    ['POST', '', { type: 'Skill', name: 'x'.repeat(101) }, 'VALIDATION_ERROR'],
    ['POST', '', { type: 'Skill', name: 'X', reason: 1 }, 'VALIDATION_ERROR'],
    [
      'POST',
      '',
      { type: 'Skill', name: 'X', reason: 'x'.repeat(501) },
      'VALIDATION_ERROR',
    ],
    ['PATCH', '/0', { name: 'X' }, 'INVALID_ID'],
    ['PATCH', '/2147483648/status', { status: 'Active' }, 'INVALID_ID'],
    ['PATCH', '/1', { type: 'Skill', name: 'X' }, 'INVALID_REQUEST'],
    ['PATCH', '/1/status', { status: 'closed' }, 'VALIDATION_ERROR'],
    ['PATCH', '/1/status', {}, 'VALIDATION_ERROR'],
  ];
  await withServer(f.app, async (base) => {
    for (const [method, path, body, code] of cases) {
      const response = await send(base, f.token, method, path, body);
      assert.equal(response.status, 400, `${method} ${path}`);
      assert.equal((await response.json()).error.code, code);
    }
    for (const body of [
      '{"type":"Major","name":"A","name":"B"}',
      '{"type":"Major","name":"A","na\\u006de":"B"}',
    ]) {
      for (const encoding of ['utf8', 'utf16le']) {
        const response = await fetch(`${base}/api/admin/categories`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${f.token}`,
            'Content-Type':
              encoding === 'utf8'
                ? 'application/json'
                : 'application/json; charset=utf-16le',
          },
          body: Buffer.from(body, encoding),
        });
        assert.equal(response.status, 400);
        assert.equal((await response.json()).error.code, 'INVALID_REQUEST');
      }
    }
    const malformed = await fetch(`${base}/api/admin/categories`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${f.token}`,
        'Content-Type': 'application/json',
      },
      body: '{',
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error.code, 'INVALID_JSON');
    const result = await new Promise((resolve, reject) => {
      const request = httpRequest(
        `${base}/api/admin/categories?type=Major`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${f.token}`,
            'Content-Type': 'text/plain',
            'Content-Length': 1,
          },
        },
        (response) => {
          let body = '';
          response.on('data', (chunk) => {
            body += chunk;
          });
          response.on('end', () =>
            resolve({ status: response.statusCode, body }),
          );
          response.on('error', reject);
        },
      );
      request.on('error', reject);
      request.end('x');
    });
    assert.equal(result.status, 400);
    assert.equal(JSON.parse(result.body).error.code, 'INVALID_REQUEST');
  });
  assert.equal(f.snapshot().transactions, 0);
});

test('no-op, missing target and final Active never write logs', async () => {
  const f = await fixture();
  await withServer(f.app, async (base) => {
    for (const [path, body] of [
      ['/1', { name: ' A ' }],
      ['/3/status', { status: 'Closed' }],
    ]) {
      const response = await send(base, f.token, 'PATCH', path, body);
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.changed, false);
      assert.equal(result.category.createdAt, createdAt);
    }
    const missing = await send(base, f.token, 'PATCH', '/99', { name: 'X' });
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, 'NOT_FOUND');
    const responses = await Promise.all(
      [1, 2].map((id) =>
        send(base, f.token, 'PATCH', `/${id}/status`, { status: 'Closed' }),
      ),
    );
    assert.deepEqual(
      responses.map((response) => response.status).sort(),
      [200, 409],
    );
    assert.equal(
      (await responses.find((r) => r.status === 409).json()).error.code,
      'LAST_ACTIVE_CATEGORY',
    );
  });
  assert.equal(
    f
      .snapshot()
      .state.filter((row) => row.type === 'Major' && row.status === 'Active')
      .length,
    1,
  );
  assert.equal(f.snapshot().logs.length, 1);
});

test('duplicate create/rename use DB UNIQUE and rollback without audit', async () => {
  const f = await fixture({ duplicate: true });
  await withServer(f.app, async (base) => {
    for (const [method, path, body] of [
      ['POST', '', { type: 'Major', name: 'a' }],
      ['PATCH', '/2', { name: 'a' }],
    ]) {
      const response = await send(base, f.token, method, path, body);
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error.code, 'DUPLICATE_CATEGORY');
    }
  });
  assert.deepEqual(f.snapshot().state, initial);
  assert.equal(f.snapshot().logs.length, 0);
});

test('audit errors and oversized serialized payload rollback each mutation', async (context) => {
  context.mock.method(console, 'error', () => {});
  for (const logError of [new Error('private-log-error'), undefined]) {
    const f = await fixture({ logError });
    await withServer(f.app, async (base) => {
      const cases = logError
        ? [
            ['POST', '', { type: 'Major', name: 'X' }],
            ['PATCH', '/1', { name: 'X' }],
            ['PATCH', '/1/status', { status: 'Closed' }],
            ['PATCH', '/3/status', { status: 'Active' }],
          ]
        : [
            ['POST', '', { type: 'Major', name: '\u0001'.repeat(100) }],
            ['PATCH', '/1', { name: 'X', reason: 'password=secret-value' }],
          ];
      for (const [method, path, body] of cases) {
        const response = await send(base, f.token, method, path, body);
        assert.equal(response.status, logError ? 500 : 400);
        const text = await response.text();
        assert.equal(text.includes('private-log-error'), false);
      }
    });
    assert.deepEqual(f.snapshot().state, initial);
    assert.equal(f.snapshot().logs.length, 0);
  }
});

test('Unicode codepoint limits accept 100 supplementary characters and 500-character reason', async () => {
  const f = await fixture();
  await withServer(f.app, async (base) => {
    const response = await send(base, f.token, 'POST', '', {
      type: 'Skill',
      name: '😀'.repeat(100),
      reason: '😀'.repeat(500),
    });
    assert.equal(response.status, 201);
  });
  assert.equal(Array.from(f.snapshot().logs[0].reason).length, 500);
});

test('database errors stay safe and deadlock retries are bounded', async (context) => {
  context.mock.method(console, 'error', () => {});
  for (const [transactionError, status, count] of [
    [{ code: 'P1001' }, 503, 1],
    [{ code: 'P2034' }, 503, 3],
    [new Error('private'), 500, 1],
  ]) {
    const f = await fixture({ transactionError });
    await withServer(f.app, async (base) => {
      const response = await send(base, f.token, 'PATCH', '/1', { name: 'X' });
      assert.equal(response.status, status);
      assert.equal((await response.text()).includes('private'), false);
    });
    assert.equal(f.snapshot().transactions, count);
  }
  const f = await fixture({ queryError: { code: 'P1001' } });
  await withServer(f.app, async (base) => {
    assert.equal((await send(base, f.token, 'GET', '?type=Major')).status, 503);
  });
});
