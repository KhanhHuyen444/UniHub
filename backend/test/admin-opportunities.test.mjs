import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { once } from 'node:events';
import { createApp } from '../dist/app.js';

const fixedNow = new Date('2026-10-29T12:00:00.000Z');
const adminToken = 'admin.token.signature';
const studentToken = 'student.token.signature';
const adminIdentity = {
  userId: 1,
  role: 'Admin',
  sessionId: 'admin-session',
  issuedAt: 1_798_000_000,
  expiresAt: 1_798_000_900,
};
const studentIdentity = {
  userId: 2,
  role: 'Student',
  sessionId: 'student-session',
  issuedAt: 1_798_000_000,
  expiresAt: 1_798_000_900,
};

const initialRows = [
  {
    item_id: 10,
    opportunity_type: 'Thực tập',
    title: 'Cơ hội thứ hai',
    description: 'Mô tả.',
    requirements: 'Yêu cầu.',
    publisher: 'Đơn vị A',
    location: 'Hà Nội',
    work_format: 'Hybrid',
    deadline: new Date('2026-11-05T17:00:00.000Z'),
    deadline_source_date: new Date('2026-11-05T00:00:00.000Z'),
    deadline_source_timezone: null,
    status: 'Pending',
    is_verified: true,
    source_url: 'https://example.invalid/a',
    reviewed_by: null,
    reviewed_at: null,
    created_at: new Date('2026-10-02T00:00:00.000Z'),
    majors: [],
    skills: [],
    years: [],
  },
  {
    item_id: 11,
    opportunity_type: 'Việc làm',
    title: 'Cơ hội thứ nhất',
    description: 'Mô tả.',
    requirements: 'Yêu cầu.',
    publisher: 'Đơn vị B',
    location: null,
    work_format: 'Online',
    deadline: null,
    deadline_source_date: null,
    deadline_source_timezone: null,
    status: 'Pending',
    is_verified: false,
    source_url: 'https://example.invalid/b',
    reviewed_by: null,
    reviewed_at: null,
    created_at: new Date('2026-10-01T00:00:00.000Z'),
    majors: [{ major: { category_id: 9, name: 'Ngành Closed' } }],
    skills: [{ skill: { category_id: 18, name: 'Kỹ năng Closed' } }],
    years: [],
  },
  {
    item_id: 12,
    opportunity_type: 'Học bổng',
    title: 'Đã duyệt',
    description: 'Mô tả.',
    requirements: 'Yêu cầu.',
    publisher: 'Đơn vị C',
    location: null,
    work_format: 'Online',
    deadline: null,
    deadline_source_date: null,
    deadline_source_timezone: null,
    status: 'Approved',
    is_verified: false,
    source_url: 'https://example.invalid/c',
    reviewed_by: 1,
    reviewed_at: new Date('2026-10-03T00:00:00.000Z'),
    created_at: new Date('2026-10-03T00:00:00.000Z'),
    majors: [],
    skills: [],
    years: [],
  },
];

let state;
let auditFailure = false;
let databaseUnavailable = false;
let transactionTail;
let server;
let baseUrl;

function clone(value) {
  return structuredClone(value);
}

function makeDatabase() {
  const methodsFor = (current) => ({
    opportunity: {
      async count({ where }) {
        return current.rows.filter((row) => row.status === where.status).length;
      },
      async findMany({ where, orderBy, skip, take }) {
        const rows = current.rows
          .filter((row) => row.status === where.status)
          .sort(
            (left, right) =>
              left.created_at - right.created_at ||
              left.item_id - right.item_id,
          );
        assert.deepEqual(orderBy, [{ created_at: 'asc' }, { item_id: 'asc' }]);
        return clone(rows.slice(skip, skip + take));
      },
      async findUnique({ where, select }) {
        const row = current.rows.find((item) => item.item_id === where.item_id);
        if (!row) return null;
        if (select) {
          return Object.fromEntries(
            Object.keys(select).map((key) => [key, row[key]]),
          );
        }
        return clone(row);
      },
      async updateMany({ where, data }) {
        const row = current.rows.find(
          (item) =>
            item.item_id === where.item_id && item.status === where.status,
        );
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    activityLog: {
      async create({ data }) {
        if (auditFailure) throw new Error('isolated audit insert failure');
        current.logs.push(clone(data));
        return {};
      },
    },
  });

  return {
    authSession: {
      async findUnique({ where }) {
        const sessions = {
          'admin-session': { session_id: 'admin-session', user_id: 1 },
          'student-session': { session_id: 'student-session', user_id: 2 },
        };
        const session = sessions[where.session_id];
        return session
          ? {
              ...session,
              expires_at: new Date('2026-10-30T00:00:00.000Z'),
              revoked_at: null,
            }
          : null;
      },
    },
    get opportunity() {
      return methodsFor(state).opportunity;
    },
    async $transaction(callback) {
      let release;
      const previous = transactionTail;
      transactionTail = new Promise((resolve) => (release = resolve));
      await previous;
      const staged = clone(state);
      try {
        const result = await callback(methodsFor(staged));
        state = staged;
        return result;
      } finally {
        release();
      }
    },
  };
}

const client = makeDatabase();
const app = createApp({
  adminOpportunities: {
    getPrismaClient: () => {
      if (databaseUnavailable)
        throw Object.assign(new Error('private db detail'), { code: 'P1001' });
      return client;
    },
    verifyToken: async (token) => {
      if (token === adminToken) return adminIdentity;
      if (token === studentToken) return studentIdentity;
      throw new Error('bad token');
    },
    now: () => fixedNow,
    getEvaluatedAt: () => fixedNow,
  },
});

async function request(path, options = {}, token = adminToken) {
  const headers = new Headers(options.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (options.body !== undefined)
    headers.set('content-type', 'application/json');
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  state = { rows: clone(initialRows), logs: [] };
  auditFailure = false;
  databaseUnavailable = false;
  transactionTail = Promise.resolve();
});

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test('requires Admin and returns only Pending items in stable order', async () => {
  const guest = await request('/api/admin/opportunities', {}, null);
  assert.equal(guest.status, 401);
  assert.equal((await guest.json()).error.code, 'UNAUTHORIZED');

  const student = await request('/api/admin/opportunities', {}, studentToken);
  assert.equal(student.status, 403);
  assert.equal((await student.json()).error.code, 'FORBIDDEN');

  const response = await request('/api/admin/opportunities?page=1&pageSize=1');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    items: [
      {
        id: 11,
        type: 'Việc làm',
        title: 'Cơ hội thứ nhất',
        publisher: 'Đơn vị B',
        descriptionText: 'Mô tả.',
        requirementsText: 'Yêu cầu.',
        workFormat: 'Online',
        location: null,
        deadline: null,
        isVerified: false,
        sourceUrl: 'https://example.invalid/b',
        majors: [{ id: 9, name: 'Ngành Closed' }],
        skills: [{ id: 18, name: 'Kỹ năng Closed' }],
        eligibleAcademicYears: [],
        createdAt: '2026-10-01T00:00:00Z',
        status: 'Pending',
        reviewedAt: null,
      },
    ],
    meta: { page: 1, pageSize: 1, total: 2, totalPages: 2 },
  });
});

test('validates list query, ID, detail query and missing records', async () => {
  for (const query of ['?status=Pending', '?page=2&page=3', '?page=1000001']) {
    const response = await request(`/api/admin/opportunities${query}`);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_QUERY');
  }

  const invalidId = await request('/api/admin/opportunities/0');
  assert.equal(invalidId.status, 400);
  assert.equal((await invalidId.json()).error.code, 'INVALID_ID');

  const queryDetail = await request('/api/admin/opportunities/10?x=1');
  assert.equal(queryDetail.status, 400);
  assert.equal((await queryDetail.json()).error.code, 'INVALID_QUERY');

  const missing = await request('/api/admin/opportunities/999');
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, 'NOT_FOUND');

  const beyondRange = await request(
    '/api/admin/opportunities?page=999&pageSize=2',
  );
  assert.equal(beyondRange.status, 200);
  assert.deepEqual(await beyondRange.json(), {
    items: [],
    meta: { page: 999, pageSize: 2, total: 2, totalPages: 1 },
  });
});

test('detail returns reviewed items but omits reviewer identity', async () => {
  const response = await request('/api/admin/opportunities/12');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.item.status, 'Approved');
  assert.equal(body.item.reviewedAt, '2026-10-03T00:00:00Z');
  assert.equal('reviewedBy' in body.item, false);
  assert.equal('reviewed_by' in body.item, false);
});

test('approve writes only the review fields and exact activity payload', async () => {
  const response = await request('/api/admin/opportunities/10/approve', {
    method: 'POST',
    body: JSON.stringify({ verified: false }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    item: {
      id: 10,
      status: 'Approved',
      isVerified: false,
      reviewedAt: '2026-10-29T12:00:00Z',
    },
  });
  const row = state.rows.find((item) => item.item_id === 10);
  assert.equal(row.status, 'Approved');
  assert.equal(row.is_verified, false);
  assert.equal(row.reviewed_by, 1);
  assert.equal(row.title, 'Cơ hội thứ hai');
  assert.deepEqual(state.logs, [
    {
      admin_id: 1,
      action_type: 'APPROVE_OPPORTUNITY',
      target_type: 'Opportunity',
      target_id: 10,
      old_value: '{"status":"Pending","is_verified":true}',
      new_value: '{"status":"Approved","is_verified":false}',
      reason: null,
    },
  ]);

  const repeated = await request('/api/admin/opportunities/10/reject', {
    method: 'POST',
    body: JSON.stringify({ reason: 'Lặp lại' }),
  });
  assert.equal(repeated.status, 409);
  assert.equal((await repeated.json()).error.code, 'OPPORTUNITY_NOT_PENDING');
  assert.equal(state.logs.length, 1);
});

test('reject trims and audits reason; invalid payloads have stable field errors', async () => {
  const response = await request('/api/admin/opportunities/10/reject', {
    method: 'POST',
    body: JSON.stringify({ reason: '  Nội dung không đạt  ' }),
  });
  assert.equal(response.status, 200);
  assert.equal(state.logs[0].reason, 'Nội dung không đạt');
  assert.equal(state.rows[0].is_verified, false);

  const blank = await request('/api/admin/opportunities/10/reject', {
    method: 'POST',
    body: JSON.stringify({ reason: '   ' }),
  });
  assert.equal(blank.status, 400);
  assert.deepEqual((await blank.json()).error.fieldErrors, [
    {
      source: 'body',
      field: 'reason',
      code: 'REQUIRED',
      message: 'Vui lòng nhập lý do từ chối.',
    },
  ]);

  const extra = await request('/api/admin/opportunities/10/approve', {
    method: 'POST',
    body: JSON.stringify({ verified: true, reason: 'extra' }),
  });
  assert.equal(extra.status, 400);
  assert.equal((await extra.json()).error.code, 'INVALID_REQUEST');

  const invalidBoolean = await request('/api/admin/opportunities/10/approve', {
    method: 'POST',
    body: JSON.stringify({ verified: 'true' }),
  });
  assert.equal(invalidBoolean.status, 400);
  assert.equal(
    (await invalidBoolean.json()).error.fieldErrors[0].field,
    'verified',
  );

  const tooLong = await request('/api/admin/opportunities/10/reject', {
    method: 'POST',
    body: JSON.stringify({ reason: 'ế'.repeat(501) }),
  });
  assert.equal(tooLong.status, 400);
  assert.equal((await tooLong.json()).error.fieldErrors[0].code, 'TOO_LONG');
});

test('approval rejects unusable source, content, or required location without fetching', async () => {
  for (const override of [
    { source_url: 'javascript:alert(1)' },
    { source_url: null },
    { description: null },
    { requirements: '   ' },
    { location: null },
  ]) {
    state = { rows: clone(initialRows), logs: [] };
    Object.assign(state.rows[0], override);
    const response = await request('/api/admin/opportunities/10/approve', {
      method: 'POST',
      body: JSON.stringify({ verified: true }),
    });
    assert.equal(response.status, 422);
    assert.equal(
      (await response.json()).error.code,
      'OPPORTUNITY_NOT_REVIEWABLE',
    );
    assert.equal(state.rows[0].status, 'Pending');
    assert.deepEqual(state.logs, []);
  }
});

test('audit failure rolls back the opportunity mutation', async () => {
  auditFailure = true;
  const response = await request('/api/admin/opportunities/10/approve', {
    method: 'POST',
    body: JSON.stringify({ verified: true }),
  });
  assert.equal(response.status, 500);
  assert.equal(state.rows[0].status, 'Pending');
  assert.equal(state.rows[0].reviewed_by, null);
  assert.deepEqual(state.logs, []);
});

test('database unavailability returns generic 503 without leaking details', async () => {
  databaseUnavailable = true;
  const response = await request('/api/admin/opportunities');
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error.code, 'SERVICE_UNAVAILABLE');
  assert.equal(JSON.stringify(body).includes('private db detail'), false);
});

test('concurrent approve/reject has one winner and one audit row', async () => {
  const [approve, reject] = await Promise.all([
    request('/api/admin/opportunities/10/approve', {
      method: 'POST',
      body: JSON.stringify({ verified: true }),
    }),
    request('/api/admin/opportunities/10/reject', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Không phù hợp' }),
    }),
  ]);
  assert.deepEqual([approve.status, reject.status].sort(), [200, 409]);
  assert.equal(state.logs.length, 1);
});
