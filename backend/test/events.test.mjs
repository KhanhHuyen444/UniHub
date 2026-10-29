import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { request } from 'node:http';
import {
  patchEvent,
  patchEventStatus,
  parseCreateEventInput,
  parsePatchEventInput,
  parseStrictUtcIsoDate,
} from '../dist/modules/events/events.service.js';
import { createApp } from '../dist/app.js';
import { createAccessTokenService } from '../dist/modules/auth/access-token.js';
import { createPrismaClient } from '../dist/lib/prisma.js';

const config = {
  signingSecret: 'test-only-secret-with-at-least-32-bytes',
  issuer: 'https://api.test.invalid',
  audience: 'unihub-test-api',
};

const fixedNow = new Date('2026-10-28T12:00:00.000Z');
const tokenService = createAccessTokenService(config, () => fixedNow);

const studentIdentity = {
  userId: 10,
  role: 'Student',
  sessionId: 'd7f55cee-2d7c-4df9-aece-36b6eb446db5',
};

const otherStudentIdentity = {
  userId: 20,
  role: 'Student',
  sessionId: 'd7f55cee-2d7c-4df9-aece-36b6eb446db6',
};

const adminIdentity = {
  userId: 99,
  role: 'Admin',
  sessionId: 'd7f55cee-2d7c-4df9-aece-36b6eb446db7',
};

const defaultSessions = [
  {
    session_id: studentIdentity.sessionId,
    user_id: studentIdentity.userId,
    expires_at: new Date('2026-11-05T00:00:00.000Z'),
    revoked_at: null,
  },
  {
    session_id: otherStudentIdentity.sessionId,
    user_id: otherStudentIdentity.userId,
    expires_at: new Date('2026-11-05T00:00:00.000Z'),
    revoked_at: null,
  },
  {
    session_id: adminIdentity.sessionId,
    user_id: adminIdentity.userId,
    expires_at: new Date('2026-11-05T00:00:00.000Z'),
    revoked_at: null,
  },
];

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function createMockPrisma({
  initialEvents = [],
  initialNotifications = [],
  initialSessions = defaultSessions,
} = {}) {
  let events = initialEvents.map((e) => ({ ...e }));
  let notifications = initialNotifications.map((n) => ({ ...n }));
  const sessions = initialSessions.map((s) => ({ ...s }));
  let nextEventId = 100;

  const mock = {
    authSession: {
      findUnique: async ({ where }) => {
        return sessions.find((s) => s.session_id === where.session_id) || null;
      },
    },
    event: {
      findMany: async ({ where, orderBy }) => {
        let result = events.filter((e) => {
          if (where.user_id !== undefined && e.user_id !== where.user_id) {
            return false;
          }
          if (where.due_date) {
            if (where.due_date.gte && e.due_date < where.due_date.gte) {
              return false;
            }
            if (where.due_date.lt && e.due_date >= where.due_date.lt) {
              return false;
            }
          }
          return true;
        });

        if (orderBy) {
          result.sort((a, b) => {
            const timeDiff = a.due_date.getTime() - b.due_date.getTime();
            if (timeDiff !== 0) return timeDiff;
            return a.event_id - b.event_id;
          });
        }
        return result.map((e) => ({ ...e }));
      },
      findFirst: async ({ where }) => {
        const found = events.find((e) => {
          if (where.event_id !== undefined && e.event_id !== where.event_id) {
            return false;
          }
          if (where.user_id !== undefined && e.user_id !== where.user_id) {
            return false;
          }
          return true;
        });
        return found ? { ...found } : null;
      },
      create: async ({ data }) => {
        const id = ++nextEventId;
        const now = new Date();
        const created = {
          event_id: id,
          user_id: data.user_id,
          title: data.title,
          due_date: new Date(data.due_date),
          remind_before: data.remind_before,
          notes: data.notes ?? null,
          status: data.status,
          reminded_at: data.reminded_at ? new Date(data.reminded_at) : null,
          created_at: now,
          updated_at: now,
        };
        events.push(created);
        return { ...created };
      },
      updateMany: async ({ where, data }) => {
        let matched = 0;
        events = events.map((e) => {
          if (where.event_id !== undefined && e.event_id !== where.event_id) {
            return e;
          }
          if (where.user_id !== undefined && e.user_id !== where.user_id) {
            return e;
          }
          if (where.status !== undefined) {
            if (
              typeof where.status === 'object' &&
              where.status.not !== undefined
            ) {
              if (e.status === where.status.not) return e;
            } else if (e.status !== where.status) {
              return e;
            }
          }
          matched++;
          return {
            ...e,
            ...data,
            updated_at: new Date(),
          };
        });
        return { count: matched };
      },
      update: async ({ where, data }) => {
        const idx = events.findIndex((e) => e.event_id === where.event_id);
        if (idx === -1) throw new Error('Not found');
        const now = new Date();
        const updated = {
          ...events[idx],
          ...data,
          updated_at: now,
        };
        events[idx] = updated;
        return { ...updated };
      },
      delete: async ({ where }) => {
        const idx = events.findIndex((e) => e.event_id === where.event_id);
        if (idx === -1) throw new Error('Not found');
        const [deleted] = events.splice(idx, 1);
        notifications = notifications.filter(
          (n) => n.event_id !== deleted.event_id,
        );
        return { ...deleted };
      },
    },
    notification: {
      findMany: async ({ where }) => {
        return notifications.filter((n) => {
          if (where.event_id !== undefined && n.event_id !== where.event_id) {
            return false;
          }
          if (where.user_id !== undefined && n.user_id !== where.user_id) {
            return false;
          }
          if (where.type !== undefined && n.type !== where.type) {
            return false;
          }
          return true;
        });
      },
      deleteMany: async ({ where }) => {
        const before = notifications.length;
        notifications = notifications.filter((n) => {
          if (where.event_id !== undefined && n.event_id !== where.event_id) {
            return true;
          }
          if (where.user_id !== undefined && n.user_id !== where.user_id) {
            return true;
          }
          if (where.type !== undefined && n.type !== where.type) {
            return true;
          }
          return false;
        });
        return { count: before - notifications.length };
      },
    },
    $transaction: async (callback) => {
      const eventsSnapshot = events.map((e) => ({ ...e }));
      const notificationsSnapshot = notifications.map((n) => ({ ...n }));
      try {
        return await callback(mock);
      } catch (error) {
        events = eventsSnapshot;
        notifications = notificationsSnapshot;
        throw error;
      }
    },
    _getEvents: () => events,
    _getNotifications: () => notifications,
  };

  return mock;
}

function testApp(
  mockPrisma,
  evaluatedAt = new Date('2026-10-28T12:00:00.000Z'),
) {
  return createApp({
    events: {
      getPrismaClient: () => mockPrisma,
      getEvaluatedAt: () => evaluatedAt,
      verifyToken: (t) => tokenService.verify(t),
      now: () => fixedNow,
    },
  });
}

test('Quyền truy cập: Guest bị từ chối 401 trên mọi endpoint sự kiện', async () => {
  const prisma = createMockPrisma();
  const app = testApp(prisma);

  await withServer(app, async (baseUrl) => {
    const endpoints = [
      {
        method: 'GET',
        path: '/api/events?from=2026-10-25T17:00:00Z&to=2026-11-01T17:00:00Z',
      },
      {
        method: 'POST',
        path: '/api/events',
        body: { title: 'Test', dueDate: '2026-11-05T17:00:00Z' },
      },
      { method: 'GET', path: '/api/events/1' },
      { method: 'PATCH', path: '/api/events/1', body: { title: 'Test' } },
      {
        method: 'PATCH',
        path: '/api/events/1/status',
        body: { status: 'Completed' },
      },
      { method: 'DELETE', path: '/api/events/1' },
    ];

    for (const ep of endpoints) {
      const response = await fetch(`${baseUrl}${ep.path}`, {
        method: ep.method,
        headers: ep.body ? { 'Content-Type': 'application/json' } : undefined,
        body: ep.body ? JSON.stringify(ep.body) : undefined,
      });
      assert.equal(
        response.status,
        401,
        `${ep.method} ${ep.path} phải trả 401`,
      );
      const body = await response.json();
      assert.equal(body.error.code, 'UNAUTHORIZED');
    }
  });
});

test('Quyền truy cập: Admin bị từ chối 403 trên mọi endpoint sự kiện', async () => {
  const prisma = createMockPrisma();
  const app = testApp(prisma);
  const adminToken = await tokenService.sign(adminIdentity);

  await withServer(app, async (baseUrl) => {
    const endpoints = [
      {
        method: 'GET',
        path: '/api/events?from=2026-10-25T17:00:00Z&to=2026-11-01T17:00:00Z',
      },
      {
        method: 'POST',
        path: '/api/events',
        body: { title: 'Test', dueDate: '2026-11-05T17:00:00Z' },
      },
      { method: 'GET', path: '/api/events/1' },
      { method: 'PATCH', path: '/api/events/1', body: { title: 'Test' } },
      {
        method: 'PATCH',
        path: '/api/events/1/status',
        body: { status: 'Completed' },
      },
      { method: 'DELETE', path: '/api/events/1' },
    ];

    for (const ep of endpoints) {
      const response = await fetch(`${baseUrl}${ep.path}`, {
        method: ep.method,
        headers: {
          Authorization: `Bearer ${adminToken}`,
          ...(ep.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: ep.body ? JSON.stringify(ep.body) : undefined,
      });
      assert.equal(
        response.status,
        403,
        `${ep.method} ${ep.path} phải trả 403`,
      );
      const body = await response.json();
      assert.equal(body.error.code, 'FORBIDDEN');
    }
  });
});

test('GET /api/events: kiểm tra validation tham số truy vấn khoảng lịch và ngày không tồn tại', async () => {
  const prisma = createMockPrisma();
  const app = testApp(prisma);
  const studentToken = await tokenService.sign(studentIdentity);

  await withServer(app, async (baseUrl) => {
    const invalidQueries = [
      '', // Thiếu cả hai
      '?from=2026-10-25T17:00:00Z', // Thiếu to
      '?to=2026-11-01T17:00:00Z', // Thiếu from
      '?from=2026-10-25T17:00:00Z&to=2026-11-01T17:00:00Z&page=1', // Query lạ
      '?from=2026-10-25T17:00:00Z&from=2026-10-26T17:00:00Z&to=2026-11-01T17:00:00Z', // Lặp from
      '?from=2026-10-25T00:00:00Z&to=2026-11-01T17:00:00Z', // from không phải 00:00 VN (là 07:00 VN)
      '?from=2026-10-25T17:00:00Z&to=2026-11-01T00:00:00Z', // to không phải 00:00 VN
      '?from=2026-10-25T17:00:00+07:00&to=2026-11-01T17:00:00Z', // Thiếu Z
      '?from=2026-11-01T17:00:00Z&to=2026-10-25T17:00:00Z', // Range ngược (from > to)
      '?from=2026-10-25T17:00:00Z&to=2026-10-25T17:00:00Z', // Range bằng nhau (from == to)
      // 43 ngày: từ 2026-10-25T17:00:00Z (26/10 VN) đến 2026-12-07T17:00:00Z (08/12 VN) -> 43 ngày
      '?from=2026-10-25T17:00:00Z&to=2026-12-07T17:00:00Z',
      // Strict date validation: ngày không tồn tại (2026-02-30)
      '?from=2026-02-30T17:00:00Z&to=2026-03-10T17:00:00Z',
      '?from=2026-02-25T17:00:00Z&to=2026-02-30T17:00:00Z',
      '?from=2026-04-31T17:00:00Z&to=2026-05-10T17:00:00Z',
    ];

    for (const q of invalidQueries) {
      const response = await fetch(`${baseUrl}/api/events${q}`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.equal(response.status, 400, `Query ${q} phải trả 400`);
      const body = await response.json();
      assert.equal(body.error.code, 'INVALID_QUERY');
    }
  });
});

test('GET /api/events: truy vấn thành công với range 42 ngày, sắp xếp dueDate ASC, id ASC và cách ly người dùng', async () => {
  const initialEvents = [
    {
      event_id: 1,
      user_id: 10,
      title: 'Hạn nộp báo cáo B',
      due_date: new Date('2026-11-05T17:00:00.000Z'),
      remind_before: 24,
      notes: null,
      status: 'Upcoming',
      reminded_at: null,
      created_at: new Date('2026-10-28T00:00:00.000Z'),
      updated_at: new Date('2026-10-28T00:00:00.000Z'),
    },
    {
      event_id: 2,
      user_id: 10,
      title: 'Hạn nộp báo cáo A',
      due_date: new Date('2026-11-01T17:00:00.000Z'),
      remind_before: 12,
      notes: 'Ghi chú A',
      status: 'Upcoming',
      reminded_at: null,
      created_at: new Date('2026-10-28T00:00:00.000Z'),
      updated_at: new Date('2026-10-28T00:00:00.000Z'),
    },
    {
      event_id: 3,
      user_id: 10,
      title: 'Hạn nộp báo cáo C',
      due_date: new Date('2026-11-05T17:00:00.000Z'),
      remind_before: 24,
      notes: null,
      status: 'Upcoming',
      reminded_at: null,
      created_at: new Date('2026-10-28T00:00:00.000Z'),
      updated_at: new Date('2026-10-28T00:00:00.000Z'),
    },
    {
      event_id: 4,
      user_id: 20, // Sự kiện của user khác
      title: 'Sự kiện người khác',
      due_date: new Date('2026-11-02T17:00:00.000Z'),
      remind_before: 24,
      notes: null,
      status: 'Upcoming',
      reminded_at: null,
      created_at: new Date('2026-10-28T00:00:00.000Z'),
      updated_at: new Date('2026-10-28T00:00:00.000Z'),
    },
  ];

  const prisma = createMockPrisma({ initialEvents });
  const app = testApp(prisma);
  const studentToken = await tokenService.sign(studentIdentity);

  await withServer(app, async (baseUrl) => {
    // 42 ngày chuẩn: 26/10 đến 06/12/2026
    const from = '2026-10-25T17:00:00Z';
    const to = '2026-12-06T17:00:00Z';
    const response = await fetch(
      `${baseUrl}/api/events?from=${from}&to=${to}`,
      {
        headers: { Authorization: `Bearer ${studentToken}` },
      },
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(Array.isArray(body.items));
    assert.equal(body.items.length, 3); // Không chứa event của user 20

    // Kiểm tra sort: dueDate ASC, id ASC -> 2 trước, rồi 1, rồi 3
    assert.equal(body.items[0].id, 2);
    assert.equal(body.items[1].id, 1);
    assert.equal(body.items[2].id, 3);

    // Kiểm tra chính xác 9 fields của DTO và không lộ user_id
    const item = body.items[0];
    const expectedKeys = [
      'id',
      'title',
      'dueDate',
      'remindBefore',
      'notes',
      'status',
      'remindedAt',
      'createdAt',
      'updatedAt',
    ];
    assert.deepEqual(Object.keys(item).sort(), expectedKeys.sort());
    assert.equal(item.dueDate, '2026-11-01T17:00:00Z');
    assert.equal(item.remindBefore, 12);
    assert.equal(item.notes, 'Ghi chú A');
  });
});

test('GET và DELETE từ chối mọi body (JSON {}, text/plain, v.v.)', async () => {
  const initialEvents = [
    {
      event_id: 1,
      user_id: 10,
      title: 'Hạn kiểm tra',
      due_date: new Date('2026-11-05T17:00:00.000Z'),
      remind_before: 24,
      notes: null,
      status: 'Upcoming',
      reminded_at: null,
      created_at: new Date('2026-10-28T00:00:00.000Z'),
      updated_at: new Date('2026-10-28T00:00:00.000Z'),
    },
  ];

  const prisma = createMockPrisma({ initialEvents });
  const app = testApp(prisma);
  const studentToken = await tokenService.sign(studentIdentity);

  await withServer(app, async (baseUrl) => {
    const from = '2026-10-25T17:00:00Z';
    const to = '2026-11-15T17:00:00Z';

    for (const [method, path] of [
      ['GET', '/api/events?from=' + from + '&to=' + to],
      ['GET', '/api/events/1'],
      ['DELETE', '/api/events/1'],
    ]) {
      for (const [contentType, body] of [
        ['application/json', '{}'],
        ['application/json', '{"title":"Nonempty"}'],
        ['text/plain', 'text body'],
        ['text/plain', '{}'],
        [undefined, 'untyped body'],
      ]) {
        for (const chunked of [false, true]) {
          const result = await new Promise((resolve, reject) => {
            const req = request(
              baseUrl + path,
              {
                method,
                headers: {
                  Authorization: 'Bearer ' + studentToken,
                  ...(contentType ? { 'Content-Type': contentType } : {}),
                  ...(chunked
                    ? { 'Transfer-Encoding': 'chunked' }
                    : { 'Content-Length': Buffer.byteLength(body) }),
                },
              },
              (res) => {
                let text = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                  text += chunk;
                });
                res.on('error', reject);
                res.on('end', () =>
                  resolve({ status: res.statusCode, body: text }),
                );
              },
            );
            req.on('error', reject);
            req.end(body);
          });
          assert.equal(
            result.status,
            400,
            method + ' ' + path + ', chunked=' + chunked,
          );
          assert.equal(JSON.parse(result.body).error.code, 'INVALID_REQUEST');
        }
      }
    }
    assert.equal(prisma._getEvents().length, 1);
  });
});

test('POST /api/events: tạo sự kiện thành công và xác thực dữ liệu', async () => {
  const prisma = createMockPrisma();
  const evaluatedAt = new Date('2026-10-28T12:00:00.000Z');
  const app = testApp(prisma, evaluatedAt);
  const studentToken = await tokenService.sign(studentIdentity);

  await withServer(app, async (baseUrl) => {
    // 1. Tạo thành công với đầy đủ trường hợp lệ
    const validPayload = {
      title: '  Ôn thi cuối kỳ  ',
      dueDate: '2026-11-05T17:00:00Z',
      remindBefore: 48,
      notes: 'Ôn tập chương 1-5',
    };
    const res1 = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validPayload),
    });
    assert.equal(res1.status, 201);
    const body1 = await res1.json();
    assert.equal(body1.event.title, 'Ôn thi cuối kỳ'); // Đã trim
    assert.equal(body1.event.dueDate, '2026-11-05T17:00:00Z');
    assert.equal(body1.event.remindBefore, 48);
    assert.equal(body1.event.notes, 'Ôn tập chương 1-5');
    assert.equal(body1.event.status, 'Upcoming');
    assert.equal(body1.event.remindedAt, null);

    // 2. Tạo thành công với giá trị mặc định (remindBefore=24, notes=null)
    const minimalPayload = {
      title: 'Làm bài tập lớn',
      dueDate: '2026-11-10T00:00:00Z',
    };
    const res2 = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(minimalPayload),
    });
    assert.equal(res2.status, 201);
    const body2 = await res2.json();
    assert.equal(body2.event.remindBefore, 24);
    assert.equal(body2.event.notes, null);

    // 3. Lỗi 400 INVALID_REQUEST khi chứa field lạ hoặc field cấm
    const badFields = [
      { ...minimalPayload, status: 'Upcoming' },
      { ...minimalPayload, owner: 10 },
      { ...minimalPayload, remindedAt: null },
      { ...minimalPayload, id: 5 },
      { ...minimalPayload, extraField: 'bad' },
    ];
    for (const payload of badFields) {
      const res = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      assert.equal(res.status, 400);
      assert.equal((await res.json()).error.code, 'INVALID_REQUEST');
    }

    // 4. Lỗi 400 VALIDATION_ERROR: dueDate quá khứ
    const pastPayload = {
      title: 'Sự kiện quá khứ',
      dueDate: '2026-10-27T00:00:00Z',
    };
    const resPast = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pastPayload),
    });
    assert.equal(resPast.status, 400);
    assert.equal((await resPast.json()).error.code, 'VALIDATION_ERROR');

    // 5. Lỗi 400 VALIDATION_ERROR: title rỗng hoặc quá 255 ký tự
    const emptyTitlePayload = { title: '   ', dueDate: '2026-11-10T00:00:00Z' };
    const longTitlePayload = {
      title: 'a'.repeat(256),
      dueDate: '2026-11-10T00:00:00Z',
    };
    for (const payload of [emptyTitlePayload, longTitlePayload]) {
      const res = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      assert.equal(res.status, 400);
      assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
    }
  });
});

test('POST và PATCH kiểm tra nghiêm ngặt ngày lịch không tồn tại và giới hạn remindBefore', async () => {
  const initialEvents = [
    {
      event_id: 1,
      user_id: 10,
      title: 'Sự kiện 1',
      due_date: new Date('2026-11-05T17:00:00.000Z'),
      remind_before: 24,
      notes: null,
      status: 'Upcoming',
      reminded_at: null,
      created_at: new Date('2026-10-28T00:00:00.000Z'),
      updated_at: new Date('2026-10-28T00:00:00.000Z'),
    },
  ];

  const prisma = createMockPrisma({ initialEvents });
  const app = testApp(prisma);
  const studentToken = await tokenService.sign(studentIdentity);

  await withServer(app, async (baseUrl) => {
    // 1. POST: ngày lịch không tồn tại (2026-02-30)
    const resPostBadDate = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Hạn sai ngày',
        dueDate: '2026-02-30T17:00:00Z',
      }),
    });
    assert.equal(resPostBadDate.status, 400);
    assert.equal((await resPostBadDate.json()).error.code, 'VALIDATION_ERROR');

    // 2. POST: remindBefore vượt 2147483647 hoặc số thực
    for (const badRemind of [2147483648, 12.5, -1]) {
      const res = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Hạn',
          dueDate: '2026-11-10T17:00:00Z',
          remindBefore: badRemind,
        }),
      });
      assert.equal(res.status, 400, `remindBefore ${badRemind} phải trả 400`);
      assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
    }

    // 3. PATCH: ngày lịch không tồn tại (2026-04-31)
    const resPatchBadDate = await fetch(`${baseUrl}/api/events/1`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dueDate: '2026-04-31T17:00:00Z',
      }),
    });
    assert.equal(resPatchBadDate.status, 400);
    assert.equal((await resPatchBadDate.json()).error.code, 'VALIDATION_ERROR');

    // 4. PATCH: remindBefore vượt 2147483647 hoặc số thực
    for (const badRemind of [2147483648, 24.5, -5]) {
      const res = await fetch(`${baseUrl}/api/events/1`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ remindBefore: badRemind }),
      });
      assert.equal(res.status, 400);
      assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
    }
  });
});

test('GET /api/events/:id: lấy chi tiết, kiểm tra ID và cách ly người dùng', async () => {
  const initialEvents = [
    {
      event_id: 5,
      user_id: 10,
      title: 'Hạn nộp báo cáo',
      due_date: new Date('2026-11-05T17:00:00.000Z'),
      remind_before: 24,
      notes: null,
      status: 'Upcoming',
      reminded_at: null,
      created_at: new Date('2026-10-28T00:00:00.000Z'),
      updated_at: new Date('2026-10-28T00:00:00.000Z'),
    },
    {
      event_id: 6,
      user_id: 20, // Người khác
      title: 'Sự kiện người khác',
      due_date: new Date('2026-11-05T17:00:00.000Z'),
      remind_before: 24,
      notes: null,
      status: 'Upcoming',
      reminded_at: null,
      created_at: new Date('2026-10-28T00:00:00.000Z'),
      updated_at: new Date('2026-10-28T00:00:00.000Z'),
    },
  ];

  const prisma = createMockPrisma({ initialEvents });
  const app = testApp(prisma);
  const studentToken = await tokenService.sign(studentIdentity);

  await withServer(app, async (baseUrl) => {
    // 1. Thành công với event sở hữu
    const resSuccess = await fetch(`${baseUrl}/api/events/5`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(resSuccess.status, 200);
    const bodySuccess = await resSuccess.json();
    assert.equal(bodySuccess.event.id, 5);
    assert.equal(bodySuccess.event.title, 'Hạn nộp báo cáo');

    // 2. ID không hợp lệ -> 400 INVALID_ID
    for (const badId of ['abc', '-1', '0', '1.5', '9999999999999999']) {
      const res = await fetch(`${baseUrl}/api/events/${badId}`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.equal(res.status, 400, `ID ${badId} phải trả 400`);
      assert.equal((await res.json()).error.code, 'INVALID_ID');
    }

    // 3. Event không tồn tại -> 404 NOT_FOUND
    const resNotFound = await fetch(`${baseUrl}/api/events/999`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(resNotFound.status, 404);
    assert.equal((await resNotFound.json()).error.code, 'NOT_FOUND');

    // 4. Event của người khác cùng trả 404 NOT_FOUND (không tiết lộ sự tồn tại)
    const resCross = await fetch(`${baseUrl}/api/events/6`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(resCross.status, 404);
    assert.equal((await resCross.json()).error.code, 'NOT_FOUND');
  });
});

test('No-op reminder updates: PATCH cùng giá trị giữ nguyên Reminder và reminded_at', async () => {
  const initialEvents = [
    {
      event_id: 5,
      user_id: 10,
      title: 'Hạn kiểm tra',
      due_date: new Date('2026-11-05T17:00:00.000Z'),
      remind_before: 24,
      notes: null,
      status: 'Upcoming',
      reminded_at: new Date('2026-11-04T17:00:00.000Z'),
      created_at: new Date('2026-10-28T00:00:00.000Z'),
      updated_at: new Date('2026-10-28T00:00:00.000Z'),
    },
  ];

  const initialNotifications = [
    {
      notification_id: 1,
      event_id: 5,
      type: 'Reminder',
      user_id: 10,
      content: 'Nhắc 5',
      is_read: false,
    },
    {
      notification_id: 2,
      event_id: 99,
      type: 'Reminder',
      user_id: 10,
      content: 'Nhắc event khác',
      is_read: false,
    },
    {
      notification_id: 3,
      event_id: null,
      type: 'Violation',
      user_id: 10,
      content: 'Vi phạm',
      is_read: false,
    },
  ];

  const prisma = createMockPrisma({ initialEvents, initialNotifications });
  const app = testApp(prisma);
  const studentToken = await tokenService.sign(studentIdentity);

  await withServer(app, async (baseUrl) => {
    // 1. PATCH gửi cùng dueDate '2026-11-05T17:00:00Z' -> No-op: giữ nguyên reminded_at và Reminder
    const res1 = await fetch(`${baseUrl}/api/events/5`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dueDate: '2026-11-05T17:00:00Z' }),
    });
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.event.remindedAt, '2026-11-04T17:00:00Z'); // KHÔNG bị reset!
    const notifs1 = prisma._getNotifications();
    assert.equal(
      notifs1.some((n) => n.notification_id === 1),
      true,
    ); // Reminder 5 còn nguyên!

    // 2. PATCH gửi cùng remindBefore 24 -> No-op: giữ nguyên reminded_at và Reminder
    const res2 = await fetch(`${baseUrl}/api/events/5`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ remindBefore: 24 }),
    });
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.event.remindedAt, '2026-11-04T17:00:00Z');
    const notifs2 = prisma._getNotifications();
    assert.equal(
      notifs2.some((n) => n.notification_id === 1),
      true,
    );

    // 3. PATCH gửi dueDate thực sự khác -> Đổi thật: reset reminded_at và chỉ xóa Reminder của event 5
    const res3 = await fetch(`${baseUrl}/api/events/5`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dueDate: '2026-11-12T17:00:00Z' }),
    });
    assert.equal(res3.status, 200);
    const body3 = await res3.json();
    assert.equal(body3.event.remindedAt, null); // Đã reset
    const notifs3 = prisma._getNotifications();
    assert.equal(
      notifs3.some((n) => n.event_id === 5 && n.type === 'Reminder'),
      false,
    ); // Reminder của event 5 đã xóa
    assert.equal(
      notifs3.some((n) => n.notification_id === 2),
      true,
    ); // Reminder event 99 KHÔNG bị xóa
    assert.equal(
      notifs3.some((n) => n.notification_id === 3),
      true,
    ); // Violation KHÔNG bị xóa
  });
});

test('Tính nguyên tử và rollback: lỗi trong transaction khôi phục lại dữ liệu', async () => {
  const initialEvents = [
    {
      event_id: 15,
      user_id: 10,
      title: 'Hạn kiểm tra rollback',
      due_date: new Date('2026-11-05T17:00:00.000Z'),
      remind_before: 24,
      notes: null,
      status: 'Upcoming',
      reminded_at: new Date('2026-11-04T17:00:00.000Z'),
      created_at: new Date('2026-10-28T00:00:00.000Z'),
      updated_at: new Date('2026-10-28T00:00:00.000Z'),
    },
  ];

  const initialNotifications = [
    {
      notification_id: 10,
      event_id: 15,
      type: 'Reminder',
      user_id: 10,
      content: 'Nhắc 15',
      is_read: false,
    },
  ];

  const prisma = createMockPrisma({ initialEvents, initialNotifications });

  // Mô phỏng lỗi update trong transaction
  const originalUpdateMany = prisma.event.updateMany;
  prisma.event.updateMany = async () => {
    throw new Error('Database transaction failure simulation');
  };

  const app = testApp(prisma);
  const studentToken = await tokenService.sign(studentIdentity);

  await withServer(app, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/events/15`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dueDate: '2026-11-12T17:00:00Z' }),
    });

    assert.equal(res.status, 500); // Lỗi ném ra
    // Rollback: Reminder notification và event không bị xóa mất
    const notifs = prisma._getNotifications();
    assert.equal(
      notifs.some((n) => n.notification_id === 10),
      true,
    );
    const events = prisma._getEvents();
    assert.equal(
      events.find((e) => e.event_id === 15).due_date.toISOString(),
      '2026-11-05T17:00:00.000Z',
    );
  });

  prisma.event.updateMany = originalUpdateMany;
});

test('Concurrent PATCH vs Completed: Completed đã commit không bị đưa về Upcoming/Overdue', async () => {
  const initialEvents = [
    {
      event_id: 30,
      user_id: 10,
      title: 'Sự kiện kiểm tra concurrency',
      due_date: new Date('2026-11-05T17:00:00.000Z'),
      remind_before: 24,
      notes: null,
      status: 'Upcoming',
      reminded_at: null,
      created_at: new Date('2026-10-28T00:00:00.000Z'),
      updated_at: new Date('2026-10-28T00:00:00.000Z'),
    },
  ];

  const prisma = createMockPrisma({ initialEvents });
  const app = testApp(prisma);
  const studentToken = await tokenService.sign(studentIdentity);

  await withServer(app, async (baseUrl) => {
    // 1. Sự kiện được Completed trước
    const resCompleted = await fetch(`${baseUrl}/api/events/30/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'Completed' }),
    });
    assert.equal(resCompleted.status, 200);
    assert.equal((await resCompleted.json()).event.status, 'Completed');

    // 2. PATCH thông thường chạy sau: cập nhật title và dueDate mới
    const resPatch = await fetch(`${baseUrl}/api/events/30`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Tiêu đề mới',
        dueDate: '2026-11-15T17:00:00Z',
      }),
    });
    assert.equal(resPatch.status, 200);
    const bodyPatch = await resPatch.json();
    assert.equal(bodyPatch.event.title, 'Tiêu đề mới');
    assert.equal(bodyPatch.event.dueDate, '2026-11-15T17:00:00Z');
    // BẮT BUỘC giữ nguyên Completed, không bị đưa về Upcoming!
    assert.equal(bodyPatch.event.status, 'Completed');
  });
});

test('Concurrent PATCH: Completed commits between the read and conditional write', async () => {
  for (const dueDate of ['2026-11-05T17:00:00Z', '2026-10-01T17:00:00Z']) {
    const prisma = createMockPrisma({
      initialEvents: [
        {
          event_id: 30,
          user_id: 10,
          title: 'Before',
          due_date: new Date(dueDate),
          remind_before: 24,
          notes: null,
          status: 'Upcoming',
          reminded_at: null,
          created_at: fixedNow,
          updated_at: fixedNow,
        },
      ],
    });
    const updateMany = prisma.event.updateMany;
    let interleaved = false;
    prisma.event.updateMany = async (args) => {
      if (!interleaved && args.where.status?.not === 'Completed') {
        interleaved = true;
        await patchEventStatus(prisma, 10, '30', { status: 'Completed' });
      }
      return updateMany(args);
    };
    const result = await patchEvent(
      prisma,
      10,
      '30',
      { title: 'After' },
      fixedNow,
    );
    assert.equal(interleaved, true);
    assert.equal(result.event.status, 'Completed');
    assert.equal(result.event.title, 'After');
    assert.equal(prisma._getEvents()[0].status, 'Completed');
  }
});

test('PATCH /api/events/:id/status: cập nhật hoàn thành sự kiện và tính idempotent', async () => {
  const initialEvents = [
    {
      event_id: 11,
      user_id: 10,
      title: 'Sự kiện sắp tới',
      due_date: new Date('2026-11-05T17:00:00.000Z'),
      remind_before: 24,
      notes: null,
      status: 'Upcoming',
      reminded_at: null,
      created_at: new Date('2026-10-28T00:00:00.000Z'),
      updated_at: new Date('2026-10-28T00:00:00.000Z'),
    },
  ];

  const prisma = createMockPrisma({ initialEvents });
  const app = testApp(prisma);
  const studentToken = await tokenService.sign(studentIdentity);

  await withServer(app, async (baseUrl) => {
    // 1. Chuyển sang Completed thành công
    const res1 = await fetch(`${baseUrl}/api/events/11/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'Completed' }),
    });
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.event.status, 'Completed');

    // 2. Gọi lại lần 2: Idempotent trả 200 không đổi
    const res2 = await fetch(`${baseUrl}/api/events/11/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'Completed' }),
    });
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.event.status, 'Completed');

    // 3. Từ chối nếu gửi Upcoming hoặc Overdue -> 400 VALIDATION_ERROR
    for (const invalidStatus of ['Upcoming', 'Overdue', 'Invalid']) {
      const res = await fetch(`${baseUrl}/api/events/11/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: invalidStatus }),
      });
      assert.equal(res.status, 400);
      assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
    }
  });
});

test('DELETE /api/events/:id: xóa sự kiện và cascade Reminder notifications', async () => {
  const initialEvents = [
    {
      event_id: 21,
      user_id: 10,
      title: 'Sự kiện sắp xóa',
      due_date: new Date('2026-11-05T17:00:00.000Z'),
      remind_before: 24,
      notes: null,
      status: 'Upcoming',
      reminded_at: null,
      created_at: new Date('2026-10-28T00:00:00.000Z'),
      updated_at: new Date('2026-10-28T00:00:00.000Z'),
    },
  ];

  const initialNotifications = [
    {
      notification_id: 10,
      event_id: 21,
      type: 'Reminder',
      user_id: 10,
      content: 'Nhắc 21',
      is_read: false,
    },
    {
      notification_id: 11,
      event_id: null,
      type: 'Violation',
      user_id: 10,
      content: 'Thông báo vi phạm',
      is_read: false,
    },
  ];

  const prisma = createMockPrisma({ initialEvents, initialNotifications });
  const app = testApp(prisma);
  const studentToken = await tokenService.sign(studentIdentity);

  await withServer(app, async (baseUrl) => {
    // 1. Xóa thành công trả 204
    const resDelete = await fetch(`${baseUrl}/api/events/21`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(resDelete.status, 204);

    // Kiểm tra đã xóa khỏi DB mock
    assert.equal(prisma._getEvents().length, 0);
    // Cascade xóa Reminder của event 21
    const notifs = prisma._getNotifications();
    assert.equal(
      notifs.some((n) => n.notification_id === 10),
      false,
    );
    assert.equal(
      notifs.some((n) => n.notification_id === 11),
      true,
    ); // Violation giữ nguyên

    // 2. Xóa lại lần nữa -> 404 NOT_FOUND
    const resAgain = await fetch(`${baseUrl}/api/events/21`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(resAgain.status, 404);
    assert.equal((await resAgain.json()).error.code, 'NOT_FOUND');
  });
});

const isolatedDatabaseUrl = process.env.TEST_EVENTS_DATABASE_URL;

test('GET and DELETE accept an empty JSON request with Content-Length: 0', async () => {
  const prisma = createMockPrisma();
  await prisma.event.create({
    data: {
      user_id: 10,
      title: 'Empty body',
      due_date: new Date('2026-11-05T17:00:00Z'),
      remind_before: 24,
      status: 'Upcoming',
    },
  });
  const id = prisma._getEvents()[0].event_id;
  const token = await tokenService.sign(studentIdentity);
  await withServer(testApp(prisma), async (baseUrl) => {
    for (const [method, path, status] of [
      [
        'GET',
        '/api/events?from=2026-10-25T17:00:00Z&to=2026-11-15T17:00:00Z',
        200,
      ],
      ['GET', `/api/events/${id}`, 200],
      ['DELETE', `/api/events/${id}`, 204],
    ]) {
      const actual = await new Promise((resolve, reject) => {
        const req = request(
          baseUrl + path,
          {
            method,
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Content-Length': '0',
            },
          },
          (res) => {
            res.resume();
            res.on('end', () => resolve(res.statusCode));
            res.on('error', reject);
          },
        );
        req.on('error', reject);
        req.end();
      });
      assert.equal(actual, status, `${method} ${path}`);
    }
    assert.equal(prisma._getEvents().length, 0);
  });
});

for (const first of ['deadline', 'content']) {
  test(`Concurrent deadline/content PATCH: ${first} commits first`, async () => {
    let committed = createMockPrisma();
    await committed.event.create({
      data: {
        user_id: 10,
        title: 'Before',
        due_date: new Date('2026-10-01T17:00:00Z'),
        remind_before: 24,
        status: 'Overdue',
      },
    });
    const id = String(committed._getEvents()[0].event_id);
    let version = 0;
    let attempts = 0;
    let ready = 0;
    let releaseBoth;
    const bothReady = new Promise((resolve) => {
      releaseBoth = resolve;
    });
    let releaseFirst;
    const firstCommitted = new Promise((resolve) => {
      releaseFirst = resolve;
    });
    // Model overlapping snapshots and a database serialization conflict. The
    // losing transaction must reread committed data, not reuse its stale result.
    const client = {
      $transaction: async (operation, options) => {
        assert.equal(options?.isolationLevel, 'Serializable');
        const attempt = attempts++;
        const snapshotVersion = version;
        const tx = createMockPrisma({ initialEvents: committed._getEvents() });
        const result = await operation(tx);
        if (attempt < 2) {
          if (++ready === 2) releaseBoth();
          await bothReady;
          if (attempt === 1) await firstCommitted;
        }
        if (snapshotVersion !== version) {
          throw Object.assign(new Error('Serialization conflict'), {
            code: 'P2034',
          });
        }
        committed = tx;
        version++;
        if (attempt === 0) releaseFirst();
        return result;
      },
    };
    const inputs = {
      deadline: { dueDate: '2026-11-15T17:00:00Z' },
      content: { title: 'After', notes: 'Content only' },
    };
    const second = first === 'deadline' ? 'content' : 'deadline';
    await Promise.all(
      [first, second].map((kind) =>
        patchEvent(client, 10, id, inputs[kind], fixedNow),
      ),
    );
    assert.equal(attempts, 3);
    const event = committed._getEvents()[0];
    assert.equal(event.due_date.toISOString(), '2026-11-15T17:00:00.000Z');
    assert.equal(event.status, 'Upcoming');
    assert.equal(event.title, 'After');
    assert.equal(event.notes, 'Content only');
  });
}

test('PATCH serialization retries are bounded and other errors are not retried', async () => {
  for (const [code, expectedAttempts] of [
    ['P2034', 3],
    ['P2028', 1],
  ]) {
    let attempts = 0;
    const error = Object.assign(new Error('Transaction failure'), { code });
    await assert.rejects(
      patchEvent(
        {
          $transaction: async () => {
            attempts++;
            throw error;
          },
        },
        10,
        '1',
        { title: 'After' },
        fixedNow,
      ),
      (actual) => actual === error,
    );
    assert.equal(attempts, expectedAttempts);
  }
});

function assertIsolatedDatabase(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('TEST_EVENTS_DATABASE_URL must be a valid MySQL URL.');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (
    url.protocol !== 'mysql:' ||
    !['localhost', '127.0.0.1', '::1'].includes(hostname) ||
    !databaseName.startsWith('unihub_events_test') ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'TEST_EVENTS_DATABASE_URL must target a loopback-only unihub_events_test* database.',
    );
  }
}

test(
  'MySQL events integration: concurrent PATCH vs Completed, rollback atomicity and no-op reminders',
  {
    skip: !isolatedDatabaseUrl && 'TEST_EVENTS_DATABASE_URL is not configured.',
  },
  async () => {
    assertIsolatedDatabase(isolatedDatabaseUrl);
    const prisma = createPrismaClient(isolatedDatabaseUrl);
    await prisma.$connect();
    let testUserId;

    try {
      // 1. Tạo test user
      const user = await prisma.user.create({
        data: {
          email: `event_test_${Date.now()}@test.invalid`,
          full_name: 'Test Event User',
          role: 'Student',
        },
      });

      testUserId = user.user_id;

      // 2. Tạo test event
      const event = await prisma.event.create({
        data: {
          user_id: user.user_id,
          title: 'MySQL Integration Event',
          due_date: new Date('2026-11-10T17:00:00.000Z'),
          status: 'Upcoming',
          remind_before: 24,
        },
      });

      // 3. Tạo Reminder notification
      await prisma.notification.create({
        data: {
          user_id: user.user_id,
          event_id: event.event_id,
          type: 'Reminder',
          content: 'Nhắc hạn test',
        },
      });

      const remindedAt = new Date('2026-11-09T17:00:00Z');
      await prisma.event.update({
        where: { event_id: event.event_id },
        data: { reminded_at: remindedAt },
      });
      const id = String(event.event_id);
      const unchanged = await patchEvent(
        prisma,
        user.user_id,
        id,
        {
          dueDate: '2026-11-10T17:00:00Z',
          remindBefore: 24,
        },
        fixedNow,
      );
      assert.equal(unchanged.event.remindedAt, '2026-11-09T17:00:00Z');
      assert.equal(
        await prisma.notification.count({
          where: { event_id: event.event_id },
        }),
        1,
      );

      // Fail after notification deletion using a real database transaction.
      const failingClient = {
        $transaction: (operation) =>
          prisma.$transaction((tx) =>
            operation({
              event: {
                ...tx.event,
                updateMany: async () => {
                  throw new Error('Injected update failure');
                },
              },
              notification: tx.notification,
            }),
          ),
      };
      await assert.rejects(
        patchEvent(
          failingClient,
          user.user_id,
          id,
          {
            dueDate: '2026-11-12T17:00:00Z',
          },
          fixedNow,
        ),
        /Injected update failure/,
      );
      const rolledBack = await prisma.event.findUnique({
        where: { event_id: event.event_id },
      });
      assert.equal(
        rolledBack.due_date.toISOString(),
        '2026-11-10T17:00:00.000Z',
      );
      assert.equal(
        rolledBack.reminded_at.toISOString(),
        remindedAt.toISOString(),
      );
      assert.equal(
        await prisma.notification.count({
          where: { event_id: event.event_id },
        }),
        1,
      );

      await Promise.all([
        patchEvent(
          prisma,
          user.user_id,
          id,
          { title: 'Concurrent Title Update' },
          fixedNow,
        ),
        patchEventStatus(prisma, user.user_id, id, { status: 'Completed' }),
      ]);
      const finalEvent = await prisma.event.findUnique({
        where: { event_id: event.event_id },
      });
      assert.equal(finalEvent.status, 'Completed');
      assert.equal(finalEvent.title, 'Concurrent Title Update');
    } finally {
      try {
        if (testUserId !== undefined) {
          await prisma.event.deleteMany({ where: { user_id: testUserId } });
          await prisma.user.delete({ where: { user_id: testUserId } });
        }
      } finally {
        await prisma.$disconnect();
      }
    }
  },
);

test('Calendar and signed INT boundaries are validated independently of past-date checks', () => {
  for (const dueDate of [
    '2027-02-29T17:00:00Z',
    '2027-02-30T17:00:00Z',
    '2027-04-31T17:00:00Z',
  ]) {
    assert.equal(parseStrictUtcIsoDate(dueDate), null);
    assert.throws(() =>
      parseCreateEventInput({ title: 'Test', dueDate }, fixedNow),
    );
    assert.throws(() => parsePatchEventInput({ dueDate }, fixedNow));
  }
  assert.ok(parseStrictUtcIsoDate('2028-02-29T17:00:00Z'));
  for (const remindBefore of [0, 2147483647]) {
    assert.equal(
      parseCreateEventInput(
        { title: 'Test', dueDate: '2027-11-10T17:00:00Z', remindBefore },
        fixedNow,
      ).remindBefore,
      remindBefore,
    );
    assert.equal(
      parsePatchEventInput({ remindBefore }, fixedNow).remindBefore,
      remindBefore,
    );
  }
});
