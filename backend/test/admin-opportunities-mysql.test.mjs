import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { once } from 'node:events';
import { createApp } from '../dist/app.js';
import { createPrismaClient } from '../dist/lib/prisma.js';
import { createAccessTokenService } from '../dist/modules/auth/access-token.js';
import {
  ActivityLogTransactionRequiredError,
  writeActivityLog,
} from '../dist/modules/activity-logs/activity-log.writer.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const enabled = Boolean(databaseUrl);
const nonce = randomUUID();
const now = new Date();
const jwtConfiguration = {
  signingSecret: 'isolated-admin-opportunity-test-secret-32-bytes-minimum',
  issuer: 'unihub-admin-test',
  audience: 'unihub-admin-test-client',
};

let client;
let server;
let baseUrl;
let reviewer;
let student;
let adminSessionId;
let studentSessionId;
let adminToken;
let studentToken;
let pendingForApprove;
let pendingForReject;
let pendingForRace;
let pendingForRollback;
const opportunityIds = [];

function dbTest(name, callback) {
  test(name, { skip: !enabled }, callback);
}

async function createPending(title, overrides = {}) {
  const row = await client.opportunity.create({
    data: {
      opportunity_type: 'Thực tập',
      title: `${nonce} ${title}`,
      description: 'Mô tả có nội dung để Admin kiểm tra.',
      requirements: 'Yêu cầu có nội dung để Admin kiểm tra.',
      publisher: 'Đơn vị kiểm thử',
      location: 'Hà Nội',
      work_format: 'Hybrid',
      status: 'Pending',
      is_verified: false,
      source_url: 'https://example.invalid/review',
      ...overrides,
    },
  });
  opportunityIds.push(row.item_id);
  return row;
}

async function request(path, options = {}, token = adminToken) {
  const headers = new Headers(options.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (options.body !== undefined)
    headers.set('content-type', 'application/json');
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

before(async () => {
  if (!enabled) return;
  const url = new URL(databaseUrl);
  const schema = decodeURIComponent(url.pathname.slice(1));
  if (
    url.protocol !== 'mysql:' ||
    !['127.0.0.1', 'localhost', '::1'].includes(url.hostname) ||
    !schema.startsWith('unihub_admin_opportunities_test')
  ) {
    throw new Error(
      'TEST_DATABASE_URL must use a loopback-only, isolated unihub_admin_opportunities_test* database.',
    );
  }

  client = createPrismaClient(databaseUrl);
  await client.$connect();
  const jwt = createAccessTokenService(jwtConfiguration, () => new Date());
  reviewer = await client.user.create({
    data: {
      email: `${nonce}@example.invalid`,
      full_name: 'Isolated Admin opportunity test',
      role: 'Admin',
    },
  });
  student = await client.user.create({
    data: {
      email: `student-${nonce}@example.invalid`,
      full_name: 'Isolated Student opportunity test',
      role: 'Student',
    },
  });
  adminSessionId = randomUUID();
  studentSessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await client.authSession.createMany({
    data: [
      {
        session_id: adminSessionId,
        user_id: reviewer.user_id,
        refresh_token_hash: createHash('sha256')
          .update(`admin-${nonce}`)
          .digest('hex'),
        expires_at: expiresAt,
      },
      {
        session_id: studentSessionId,
        user_id: student.user_id,
        refresh_token_hash: createHash('sha256')
          .update(`student-${nonce}`)
          .digest('hex'),
        expires_at: expiresAt,
      },
    ],
  });
  adminToken = await jwt.sign({
    userId: reviewer.user_id,
    role: 'Admin',
    sessionId: adminSessionId,
  });
  studentToken = await jwt.sign({
    userId: student.user_id,
    role: 'Student',
    sessionId: studentSessionId,
  });

  pendingForApprove = await createPending('approve', {
    deadline: new Date('2026-11-05T17:00:00.000Z'),
    deadline_source_date: new Date('2026-11-05T00:00:00.000Z'),
  });
  pendingForReject = await createPending('reject');
  pendingForRace = await createPending('race');
  pendingForRollback = await createPending('rollback');

  const app = createApp({
    adminOpportunities: {
      getPrismaClient: () => client,
      verifyToken: jwt.verify,
      now: () => new Date(),
      getEvaluatedAt: () => now,
    },
    opportunities: { getPrismaClient: () => client, getEvaluatedAt: () => now },
  });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!client) return;
  if (server) {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
  if (opportunityIds.length) {
    await client.activityLog.deleteMany({
      where: { admin_id: reviewer.user_id, target_id: { in: opportunityIds } },
    });
    await client.opportunity.deleteMany({
      where: { item_id: { in: opportunityIds } },
    });
  }
  await client.authSession.deleteMany({
    where: { session_id: { in: [adminSessionId, studentSessionId] } },
  });
  await client.user.deleteMany({
    where: { user_id: { in: [reviewer.user_id, student.user_id] } },
  });
  await client.$disconnect();
});

dbTest(
  'MySQL auth, Pending queue, approve, audit and public visibility',
  async () => {
    const guest = await request('/api/admin/opportunities', {}, null);
    assert.equal(guest.status, 401);
    const studentResponse = await request(
      '/api/admin/opportunities',
      {},
      studentToken,
    );
    assert.equal(studentResponse.status, 403);

    const queue = await request('/api/admin/opportunities?pageSize=2');
    assert.equal(queue.status, 200);
    const queueBody = await queue.json();
    assert.equal(queueBody.meta.total, 4);
    assert.deepEqual(
      queueBody.items.map((item) => item.id),
      [pendingForApprove.item_id, pendingForReject.item_id],
    );
    assert.deepEqual(queueBody.items[0].deadline, {
      precision: 'date',
      date: '2026-11-05',
      sourceTimeZone: null,
      instant: '2026-11-05T17:00:00Z',
      state: now < new Date('2026-11-05T17:00:00.000Z') ? 'open' : 'expired',
    });

    const deniedDetail = await request(
      `/api/opportunities/${pendingForApprove.item_id}`,
      {},
      null,
    );
    assert.equal(deniedDetail.status, 404);

    await assert.rejects(
      writeActivityLog(client, {
        adminId: reviewer.user_id,
        actionType: 'APPROVE_OPPORTUNITY',
        targetType: 'Opportunity',
        targetId: pendingForApprove.item_id,
        oldValue: { status: 'Pending', is_verified: false },
        newValue: { status: 'Approved', is_verified: true },
      }),
      ActivityLogTransactionRequiredError,
    );
    assert.equal(
      await client.activityLog.count({
        where: { target_id: pendingForApprove.item_id },
      }),
      0,
    );

    const approved = await request(
      `/api/admin/opportunities/${pendingForApprove.item_id}/approve`,
      { method: 'POST', body: JSON.stringify({ verified: true }) },
    );
    assert.equal(approved.status, 200);
    const approval = await approved.json();
    assert.equal(approval.item.status, 'Approved');
    assert.equal(approval.item.isVerified, true);

    const logs = await client.activityLog.findMany({
      where: {
        target_id: pendingForApprove.item_id,
        action_type: 'APPROVE_OPPORTUNITY',
      },
    });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].old_value, '{"status":"Pending","is_verified":false}');
    assert.equal(logs[0].new_value, '{"status":"Approved","is_verified":true}');

    const publicDetail = await request(
      `/api/opportunities/${pendingForApprove.item_id}`,
      {},
      null,
    );
    assert.equal(publicDetail.status, 200);
    const publicBody = await publicDetail.json();
    assert.equal(publicBody.item.id, pendingForApprove.item_id);
    assert.equal('status' in publicBody.item, false);
    assert.equal('reviewedBy' in publicBody.item, false);
  },
);

dbTest(
  'MySQL rejection audit and conditional update allow one concurrent review',
  async () => {
    const reject = await request(
      `/api/admin/opportunities/${pendingForReject.item_id}/reject`,
      { method: 'POST', body: JSON.stringify({ reason: '  Không phù hợp  ' }) },
    );
    assert.equal(reject.status, 200);
    const rejectedLog = await client.activityLog.findFirst({
      where: {
        target_id: pendingForReject.item_id,
        action_type: 'REJECT_OPPORTUNITY',
      },
    });
    assert.equal(rejectedLog.reason, 'Không phù hợp');

    const [first, second] = await Promise.all([
      request(`/api/admin/opportunities/${pendingForRace.item_id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ verified: false }),
      }),
      request(`/api/admin/opportunities/${pendingForRace.item_id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cần kiểm tra lại' }),
      }),
    ]);
    assert.deepEqual([first.status, second.status].sort(), [200, 409]);
    const raceLogs = await client.activityLog.count({
      where: { target_id: pendingForRace.item_id },
    });
    assert.equal(raceLogs, 1);
  },
);

dbTest(
  'MySQL audit foreign-key failure rolls back the status and reviewer update',
  async () => {
    await assert.rejects(
      client.$transaction(async (transaction) => {
        await transaction.opportunity.update({
          where: { item_id: pendingForRollback.item_id },
          data: {
            status: 'Approved',
            is_verified: true,
            reviewed_by: reviewer.user_id,
            reviewed_at: now,
          },
        });
        await writeActivityLog(transaction, {
          adminId: 2_147_483_647,
          actionType: 'APPROVE_OPPORTUNITY',
          targetType: 'Opportunity',
          targetId: pendingForRollback.item_id,
          oldValue: { status: 'Pending', is_verified: false },
          newValue: { status: 'Approved', is_verified: true },
        });
      }),
    );
    const row = await client.opportunity.findUnique({
      where: { item_id: pendingForRollback.item_id },
      select: {
        status: true,
        is_verified: true,
        reviewed_by: true,
        reviewed_at: true,
      },
    });
    assert.deepEqual(row, {
      status: 'Pending',
      is_verified: false,
      reviewed_by: null,
      reviewed_at: null,
    });
    assert.equal(
      await client.activityLog.count({
        where: { target_id: pendingForRollback.item_id },
      }),
      0,
    );
  },
);
