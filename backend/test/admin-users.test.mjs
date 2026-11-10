import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { request as httpRequest } from 'node:http';
import { createApp } from '../dist/app.js';
import { createAccessTokenService } from '../dist/modules/auth/access-token.js';

const now = new Date('2026-10-29T00:00:00Z');
const tokens = createAccessTokenService(
  {
    signingSecret: 'admin-users-test-only-signing-secret-32-bytes',
    issuer: 'https://users.test.invalid',
    audience: 'users-test',
  },
  () => now,
);

const adminIdentity = {
  userId: 1,
  role: 'Admin',
  sessionId: 'd7f55cee-2d7c-4df9-aece-36b6eb446db1',
};

const studentIdentity = {
  userId: 2,
  role: 'Student',
  sessionId: 'd7f55cee-2d7c-4df9-aece-36b6eb446db2',
};

const initialUsers = [
  {
    user_id: 1,
    full_name: 'Admin User',
    email: 'admin@unihub.invalid',
    google_sub: 'sub-admin',
    avatar_url: 'https://avatar.invalid/1.jpg',
    academic_year: null,
    role: 'Admin',
    major_id: null,
    major: null,
  },
  {
    user_id: 2,
    full_name: 'Bình Nguyễn',
    email: 'binh@unihub.invalid',
    google_sub: 'sub-student-2',
    avatar_url: 'https://avatar.invalid/2.jpg',
    academic_year: 3,
    role: 'Student',
    major_id: 10,
    major: { category_id: 10, name: 'Công nghệ thông tin' },
  },
  {
    user_id: 3,
    full_name: 'An Trần',
    email: 'an@unihub.invalid',
    google_sub: 'sub-student-3',
    avatar_url: 'https://avatar.invalid/3.jpg',
    academic_year: 1,
    role: 'Student',
    major_id: 20,
    major: { category_id: 20, name: 'Khoa học dữ liệu' },
  },
  {
    user_id: 4,
    full_name: 'An Nguyễn',
    email: 'an.nguyen@unihub.invalid',
    google_sub: 'sub-student-4',
    avatar_url: null,
    academic_year: null,
    role: 'Student',
    major_id: null,
    major: null,
  },
];

async function fixture({
  logError,
  queryError,
  transactionError,
  customUsers,
} = {}) {
  let state = structuredClone(customUsers ?? initialUsers);
  let logs = [];
  let transactions = 0;
  // This fixture serializes in JavaScript; it does not verify MySQL locking.
  let queue = Promise.resolve();

  const client = {
    user: {
      count: async ({ where } = {}) => {
        if (queryError) throw queryError;
        return filterUsers(state, where).length;
      },
      findMany: async ({ where, select, orderBy, skip = 0, take } = {}) => {
        if (queryError) throw queryError;
        let matched = filterUsers(state, where);

        // Sorting: full_name ASC, user_id ASC
        matched.sort((a, b) => {
          const comp = a.full_name.localeCompare(b.full_name);
          if (comp !== 0) return comp;
          return a.user_id - b.user_id;
        });

        if (skip) matched = matched.slice(skip);
        if (take !== undefined) matched = matched.slice(0, take);

        return matched.map((row) => ({
          user_id: row.user_id,
          full_name: row.full_name,
          email: row.email,
          academic_year: row.academic_year,
          role: row.role,
          major: row.major,
        }));
      },
    },
    $transaction: async (callback, options) => {
      transactions++;
      if (transactionError) throw transactionError;
      assert.equal(options?.isolationLevel, 'RepeatableRead');

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
          assert.match(parts.join(''), /FOR UPDATE/);
          return structuredClone(rows);
        },
        user: {
          count: async ({ where } = {}) => {
            return filterUsers(rows, where).length;
          },
          findUnique: async ({ where }) => {
            const row = rows.find((u) => u.user_id === where.user_id);
            if (!row) return null;
            return {
              user_id: row.user_id,
              role: row.role,
            };
          },
          update: async ({ where, data }) => {
            const row = rows.find((u) => u.user_id === where.user_id);
            if (!row) throw new Error('User not found in tx');
            Object.assign(row, data);
            return {
              user_id: row.user_id,
              role: row.role,
            };
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
    adminUsers: {
      getPrismaClient: () => client,
      auth: {
        verifyToken: tokens.verify,
        now: () => now,
        getPrismaClient: () => ({
          authSession: {
            findUnique: async ({ where }) => {
              const sessionMap = {
                [adminIdentity.sessionId]: adminIdentity.userId,
                [studentIdentity.sessionId]: studentIdentity.userId,
                'd7f55cee-2d7c-4df9-aece-36b6eb446db9': 99,
              };
              const userId = sessionMap[where.session_id];
              if (!userId) return null;
              const u = state.find((x) => x.user_id === userId);
              return {
                session_id: where.session_id,
                user_id: userId,
                revoked_at: null,
                expires_at: new Date(now.getTime() + 60_000),
                user: {
                  role: u?.role ?? 'Student',
                },
              };
            },
          },
        }),
      },
    },
  });

  return {
    app,
    adminToken: await tokens.sign(adminIdentity),
    studentToken: await tokens.sign(studentIdentity),
    signToken: (id) => tokens.sign(id),
    getState: () => state,
    getLogs: () => logs,
    getTransactions: () => transactions,
  };
}

function filterUsers(users, where) {
  if (!where) return [...users];
  let res = [...users];
  if (where.role) {
    res = res.filter((u) => u.role === where.role);
  }
  if (where.OR) {
    const qName = where.OR[0]?.full_name?.contains?.toLowerCase() ?? '';
    const qEmail = where.OR[1]?.email?.contains?.toLowerCase() ?? '';
    res = res.filter(
      (u) =>
        u.full_name.toLowerCase().includes(qName) ||
        u.email.toLowerCase().includes(qEmail),
    );
  }
  return res;
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

async function send(base, token, method, path = '', body, customHeaders = {}) {
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...customHeaders,
  };

  return fetch(`${base}/api/admin/users${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

// ---------------------- TESTS ----------------------

test('GET /api/admin/users access control: Guest 401, Student 403, Admin 200', async () => {
  const f = await fixture();
  await withServer(f.app, async (base) => {
    // Guest
    const resGuest = await send(base, null, 'GET');
    assert.equal(resGuest.status, 401);
    const jsonGuest = await resGuest.json();
    assert.equal(jsonGuest.error.code, 'UNAUTHORIZED');

    // Student
    const resStudent = await send(base, f.studentToken, 'GET');
    assert.equal(resStudent.status, 403);
    const jsonStudent = await resStudent.json();
    assert.equal(jsonStudent.error.code, 'FORBIDDEN');

    // Admin
    const resAdmin = await send(base, f.adminToken, 'GET');
    assert.equal(resAdmin.status, 200);
    const jsonAdmin = await resAdmin.json();
    assert.equal(jsonAdmin.meta.total, 4);
    assert.equal(jsonAdmin.items.length, 4);
  });
});

test('GET /api/admin/users response schema: no sensitive fields leaked', async () => {
  const f = await fixture();
  await withServer(f.app, async (base) => {
    const res = await send(base, f.adminToken, 'GET');
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.meta.page, 1);
    assert.equal(data.meta.pageSize, 20);
    assert.equal(data.meta.total, 4);
    assert.equal(data.meta.totalPages, 1);

    for (const item of data.items) {
      assert.ok('id' in item);
      assert.ok('fullName' in item);
      assert.ok('email' in item);
      assert.ok('major' in item);
      assert.ok('academicYear' in item);
      assert.ok('role' in item);

      // Verify no sensitive fields
      assert.equal('google_sub' in item, false);
      assert.equal('avatar_url' in item, false);
      assert.equal('password' in item, false);
      assert.equal('auth_sessions' in item, false);
    }

    // Verify ordering: full_name ASC, user_id ASC
    // Names: Admin User (id: 1), An Nguyễn (id: 4), An Trần (id: 3), Bình Nguyễn (id: 2)
    assert.equal(data.items[0].fullName, 'Admin User');
    assert.equal(data.items[1].fullName, 'An Nguyễn');
    assert.equal(data.items[2].fullName, 'An Trần');
    assert.equal(data.items[3].fullName, 'Bình Nguyễn');
  });
});

test('GET /api/admin/users query validation and boundary constraints', async () => {
  const f = await fixture();
  await withServer(f.app, async (base) => {
    // Unknown param -> 400
    const res1 = await send(base, f.adminToken, 'GET', '?unknown=param');
    assert.equal(res1.status, 400);
    assert.equal((await res1.json()).error.code, 'INVALID_QUERY');

    // Duplicate param -> 400
    const res2 = await send(base, f.adminToken, 'GET', '?page=1&page=2');
    assert.equal(res2.status, 400);
    assert.equal((await res2.json()).error.code, 'INVALID_QUERY');

    // Invalid page -> 400
    const res3 = await send(base, f.adminToken, 'GET', '?page=0');
    assert.equal(res3.status, 400);
    assert.equal((await res3.json()).error.code, 'INVALID_QUERY');

    const res4 = await send(base, f.adminToken, 'GET', '?page=-5');
    assert.equal(res4.status, 400);
    assert.equal((await res4.json()).error.code, 'INVALID_QUERY');

    const res5 = await send(base, f.adminToken, 'GET', '?page=abc');
    assert.equal(res5.status, 400);
    assert.equal((await res5.json()).error.code, 'INVALID_QUERY');

    // Invalid pageSize -> 400
    const res6 = await send(base, f.adminToken, 'GET', '?pageSize=0');
    assert.equal(res6.status, 400);
    assert.equal((await res6.json()).error.code, 'INVALID_QUERY');

    const res7 = await send(base, f.adminToken, 'GET', '?pageSize=101');
    assert.equal(res7.status, 400);
    assert.equal((await res7.json()).error.code, 'INVALID_QUERY');

    // q > 100 characters -> 400
    const longQ = 'a'.repeat(101);
    const res8 = await send(base, f.adminToken, 'GET', `?q=${longQ}`);
    assert.equal(res8.status, 400);
    assert.equal((await res8.json()).error.code, 'INVALID_QUERY');

    // GET with body -> 400
    const res9 = await new Promise((resolve, reject) => {
      const req = httpRequest(
        `${base}/api/admin/users`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${f.adminToken}`,
            'Content-Type': 'text/plain',
            'Content-Length': 1,
          },
        },
        (response) => {
          let data = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => (data += chunk));
          response.on('end', () =>
            resolve({ status: response.statusCode, body: JSON.parse(data) }),
          );
        },
      );
      req.on('error', reject);
      req.end('x');
    });
    assert.equal(res9.status, 400);
    assert.equal(res9.body.error.code, 'INVALID_REQUEST');
  });
});

test('GET /api/admin/users search q and pagination out of range', async () => {
  const f = await fixture();
  await withServer(f.app, async (base) => {
    // Search by name
    const res1 = await send(base, f.adminToken, 'GET', '?q=Bình');
    assert.equal(res1.status, 200);
    const data1 = await res1.json();
    assert.equal(data1.items.length, 1);
    assert.equal(data1.items[0].fullName, 'Bình Nguyễn');
    assert.equal(data1.meta.total, 1);

    // Search by email
    const res2 = await send(base, f.adminToken, 'GET', '?q=admin@unihub');
    assert.equal(res2.status, 200);
    const data2 = await res2.json();
    assert.equal(data2.items.length, 1);
    assert.equal(data2.items[0].email, 'admin@unihub.invalid');

    // Page out of range: returns empty items, meta accurate
    const res3 = await send(base, f.adminToken, 'GET', '?page=99&pageSize=10');
    assert.equal(res3.status, 200);
    const data3 = await res3.json();
    assert.deepEqual(data3.items, []);
    assert.equal(data3.meta.page, 99);
    assert.equal(data3.meta.pageSize, 10);
    assert.equal(data3.meta.total, 4);
    assert.equal(data3.meta.totalPages, 1);
  });
});

test('PATCH /api/admin/users/:id/role access control: Guest 401, Student 403', async () => {
  const f = await fixture();
  await withServer(f.app, async (base) => {
    // Guest
    const resGuest = await send(base, null, 'PATCH', '/2/role', {
      role: 'Admin',
    });
    assert.equal(resGuest.status, 401);
    assert.equal((await resGuest.json()).error.code, 'UNAUTHORIZED');

    // Student
    const resStudent = await send(base, f.studentToken, 'PATCH', '/2/role', {
      role: 'Admin',
    });
    assert.equal(resStudent.status, 403);
    assert.equal((await resStudent.json()).error.code, 'FORBIDDEN');
  });
});

test('PATCH /api/admin/users/:id/role validation: ID, query, body, and extra fields', async () => {
  const f = await fixture();
  await withServer(f.app, async (base) => {
    // Invalid ID
    const res1 = await send(base, f.adminToken, 'PATCH', '/abc/role', {
      role: 'Admin',
    });
    assert.equal(res1.status, 400);
    assert.equal((await res1.json()).error.code, 'INVALID_ID');

    const res2 = await send(base, f.adminToken, 'PATCH', '/0/role', {
      role: 'Admin',
    });
    assert.equal(res2.status, 400);
    assert.equal((await res2.json()).error.code, 'INVALID_ID');

    // Query parameters forbidden
    const res3 = await send(base, f.adminToken, 'PATCH', '/2/role?foo=bar', {
      role: 'Admin',
    });
    assert.equal(res3.status, 400);
    assert.equal((await res3.json()).error.code, 'INVALID_QUERY');

    // Invalid role
    const res4 = await send(base, f.adminToken, 'PATCH', '/2/role', {
      role: 'SuperAdmin',
    });
    assert.equal(res4.status, 400);
    assert.equal((await res4.json()).error.code, 'VALIDATION_ERROR');

    // Extra fields forbidden
    const res5 = await send(base, f.adminToken, 'PATCH', '/2/role', {
      role: 'Admin',
      reason: 'test',
    });
    assert.equal(res5.status, 400);
    assert.equal((await res5.json()).error.code, 'VALIDATION_ERROR');

    // Non-object body (array) -> VALIDATION_ERROR
    const res6 = await send(base, f.adminToken, 'PATCH', '/2/role', []);
    assert.equal(res6.status, 400);
    assert.equal((await res6.json()).error.code, 'VALIDATION_ERROR');

    // Empty object (missing role) -> VALIDATION_ERROR
    const res7 = await send(base, f.adminToken, 'PATCH', '/2/role', {});
    assert.equal(res7.status, 400);
    assert.equal((await res7.json()).error.code, 'VALIDATION_ERROR');

    // Duplicate keys in JSON -> INVALID_REQUEST
    const resDup = await new Promise((resolve, reject) => {
      const rawJson = '{"role":"Student","role":"Admin"}';
      const req = httpRequest(
        `${base}/api/admin/users/2/role`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${f.adminToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(rawJson),
          },
        },
        (response) => {
          let data = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => (data += chunk));
          response.on('end', () =>
            resolve({ status: response.statusCode, body: JSON.parse(data) }),
          );
        },
      );
      req.on('error', reject);
      req.end(rawJson);
    });
    assert.equal(resDup.status, 400);
    assert.equal(resDup.body.error.code, 'INVALID_REQUEST');

    // Malformed JSON body -> INVALID_JSON
    const resMalformed = await new Promise((resolve, reject) => {
      const raw = '{role: malformed}';
      const req = httpRequest(
        `${base}/api/admin/users/2/role`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${f.adminToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(raw),
          },
        },
        (response) => {
          let data = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => (data += chunk));
          response.on('end', () =>
            resolve({ status: response.statusCode, body: JSON.parse(data) }),
          );
        },
      );
      req.on('error', reject);
      req.end(raw);
    });
    assert.equal(resMalformed.status, 400);
    assert.equal(resMalformed.body.error.code, 'INVALID_JSON');

    // Empty body with application/json Content-Type -> VALIDATION_ERROR
    const resEmptyJson = await new Promise((resolve, reject) => {
      const req = httpRequest(
        `${base}/api/admin/users/2/role`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${f.adminToken}`,
            'Content-Type': 'application/json',
            'Content-Length': 0,
          },
        },
        (response) => {
          let data = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => (data += chunk));
          response.on('end', () =>
            resolve({ status: response.statusCode, body: JSON.parse(data) }),
          );
        },
      );
      req.on('error', reject);
      req.end();
    });
    assert.equal(resEmptyJson.status, 400);
    assert.equal(resEmptyJson.body.error.code, 'VALIDATION_ERROR');

    // Non-JSON Content-Type -> VALIDATION_ERROR
    const resText = await new Promise((resolve, reject) => {
      const raw = 'role=Admin';
      const req = httpRequest(
        `${base}/api/admin/users/2/role`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${f.adminToken}`,
            'Content-Type': 'text/plain',
            'Content-Length': Buffer.byteLength(raw),
          },
        },
        (response) => {
          let data = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => (data += chunk));
          response.on('end', () =>
            resolve({ status: response.statusCode, body: JSON.parse(data) }),
          );
        },
      );
      req.on('error', reject);
      req.end(raw);
    });
    assert.equal(resText.status, 400);
    assert.equal(resText.body.error.code, 'VALIDATION_ERROR');
  });
});

test('PATCH /api/admin/users/:id/role: user not found -> 404', async () => {
  const f = await fixture();
  await withServer(f.app, async (base) => {
    const res = await send(base, f.adminToken, 'PATCH', '/999/role', {
      role: 'Admin',
    });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, 'NOT_FOUND');
  });
});

test('PATCH /api/admin/users/:id/role: self-demotion forbidden (BR-14.4)', async () => {
  const f = await fixture();
  await withServer(f.app, async (base) => {
    // Admin user 1 tries to demote themselves to Student
    const res = await send(base, f.adminToken, 'PATCH', '/1/role', {
      role: 'Student',
    });
    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.error.code, 'SELF_DEMOTION_FORBIDDEN');

    // Confirm state has not changed
    assert.equal(f.getState()[0].role, 'Admin');
    assert.equal(f.getLogs().length, 0);
  });
});

test('PATCH /api/admin/users/:id/role: no-op role change returns changed: false without log', async () => {
  const f = await fixture();
  await withServer(f.app, async (base) => {
    // Target user 2 is already Student
    const res = await send(base, f.adminToken, 'PATCH', '/2/role', {
      role: 'Student',
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.deepEqual(json, {
      changed: false,
      user: {
        id: 2,
        role: 'Student',
      },
    });

    // Zero activity logs written on no-op
    assert.equal(f.getLogs().length, 0);
  });
});

test('PATCH /api/admin/users/:id/role: successful role change writes activity log in transaction', async () => {
  const f = await fixture();
  await withServer(f.app, async (base) => {
    // Promote user 2 from Student to Admin
    const res = await send(base, f.adminToken, 'PATCH', '/2/role', {
      role: 'Admin',
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.deepEqual(json, {
      changed: true,
      user: {
        id: 2,
        role: 'Admin',
      },
    });

    // Verify user role in state
    const user2 = f.getState().find((u) => u.user_id === 2);
    assert.equal(user2.role, 'Admin');

    // Verify 1 transaction occurred
    assert.equal(f.getTransactions(), 1);

    // Verify activity log entry
    const logs = f.getLogs();
    assert.equal(logs.length, 1);
    assert.equal(logs[0].admin_id, 1);
    assert.equal(logs[0].target_id, 2);
    assert.equal(logs[0].action_type, 'CHANGE_ROLE');
    assert.equal(logs[0].target_type, 'User');
    assert.equal(logs[0].old_value, '{"role":"Student"}');
    assert.equal(logs[0].new_value, '{"role":"Admin"}');
  });
});

test('PATCH /api/admin/users/:id/role: rollback when activity log fails', async () => {
  const f = await fixture({
    logError: new Error('Simulated activity log failure'),
  });

  await withServer(f.app, async (base) => {
    const res = await send(base, f.adminToken, 'PATCH', '/2/role', {
      role: 'Admin',
    });
    assert.equal(res.status, 500);

    // Verify user role was NOT changed (transaction rolled back)
    const user2 = f.getState().find((u) => u.user_id === 2);
    assert.equal(user2.role, 'Student');
    assert.equal(f.getLogs().length, 0);
  });
});

test('PATCH /api/admin/users/:id/role: serialized transaction fixture avoids duplicate audit log', async () => {
  const f = await fixture();
  await withServer(f.app, async (base) => {
    // Both Admin requests try to promote user 2 (currently Student) to Admin concurrently
    const [resA, resB] = await Promise.all([
      send(base, f.adminToken, 'PATCH', '/2/role', { role: 'Admin' }),
      send(base, f.adminToken, 'PATCH', '/2/role', { role: 'Admin' }),
    ]);

    assert.equal(resA.status, 200);
    assert.equal(resB.status, 200);

    const jsonA = await resA.json();
    const jsonB = await resB.json();

    // Exactly one must be changed: true, the other changed: false (no-op)
    const results = [jsonA.changed, jsonB.changed];
    assert.ok(results.includes(true), 'At least one request changed role');
    assert.ok(results.includes(false), 'Concurrent request became safe no-op');

    // Exactly 1 activity log entry was written!
    assert.equal(f.getLogs().length, 1);
    assert.equal(f.getLogs()[0].action_type, 'CHANGE_ROLE');
    assert.equal(f.getLogs()[0].old_value, '{"role":"Student"}');
    assert.equal(f.getLogs()[0].new_value, '{"role":"Admin"}');

    // User 2 final role is Admin
    assert.equal(f.getState().find((u) => u.user_id === 2).role, 'Admin');
  });
});

test('PATCH role: stale Admin token reaches LAST_ADMIN_PROTECTED (409) without changing user or audit', async () => {
  const f = await fixture();
  // BR-14.5: user 2 was Admin at issuance, but is Student in the current DB.
  // Their unexpired token still authorizes the request; user 1 is the last Admin.
  const oldAdminToken = await f.signToken({
    ...studentIdentity,
    role: 'Admin',
  });
  await withServer(f.app, async (base) => {
    const response = await send(base, oldAdminToken, 'PATCH', '/1/role', {
      role: 'Student',
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'LAST_ADMIN_PROTECTED');
    assert.equal(f.getState().find((user) => user.user_id === 1).role, 'Admin');
    assert.equal(f.getLogs().length, 0);
  });
});

test('PATCH /api/admin/users/:id/role: two demotions preserve last Admin in serialized transaction fixture', async () => {
  // Khởi tạo hệ thống có chính xác 2 Admin: User 1 và User 2
  const twoAdmins = [
    {
      user_id: 1,
      full_name: 'Admin One',
      email: 'admin1@unihub.invalid',
      google_sub: 'sub-admin-1',
      avatar_url: null,
      academic_year: null,
      role: 'Admin',
      major_id: null,
      major: null,
    },
    {
      user_id: 2,
      full_name: 'Admin Two',
      email: 'admin2@unihub.invalid',
      google_sub: 'sub-admin-2',
      avatar_url: null,
      academic_year: null,
      role: 'Admin',
      major_id: null,
      major: null,
    },
  ];

  const f = await fixture({ customUsers: twoAdmins });
  const admin1Token = f.adminToken;
  const admin2Token = await f.signToken({
    userId: 2,
    role: 'Admin',
    sessionId: studentIdentity.sessionId,
  });

  await withServer(f.app, async (base) => {
    // 2 Admin đồng thời gửi request hạ quyền lẫn nhau:
    // - Admin 1 hạ quyền Admin 2
    // - Admin 2 hạ quyền Admin 1
    const [resA, resB] = await Promise.all([
      send(base, admin1Token, 'PATCH', '/2/role', { role: 'Student' }),
      send(base, admin2Token, 'PATCH', '/1/role', { role: 'Student' }),
    ]);

    const statuses = [resA.status, resB.status];
    // Đúng 1 request thành công (200 OK)
    assert.ok(
      statuses.includes(200),
      'Một request hạ quyền thành công (200 OK)',
    );
    assert.deepEqual(statuses.sort(), [200, 409]);

    // BẤT BIẾN HỆ THỐNG ĐƯỢC BẢO TOÀN TUYỆT ĐỐI:
    // Số lượng Admin còn lại trong DB luôn là ĐÚNG 1, KHÔNG BAO GIỜ VỀ 0!
    const remainingAdmins = f.getState().filter((u) => u.role === 'Admin');
    assert.equal(
      remainingAdmins.length,
      1,
      'Hệ thống được bảo vệ 100%, luôn còn đúng 1 Admin!',
    );

    // Chỉ có ĐÚNG 1 bản ghi ActivityLog được ghi
    assert.equal(f.getLogs().length, 1);
    assert.equal(f.getLogs()[0].action_type, 'CHANGE_ROLE');
    assert.equal(f.getLogs()[0].new_value, '{"role":"Student"}');
  });
});
