import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createApp } from '../dist/app.js';
import { createAccessTokenService } from '../dist/modules/auth/access-token.js';

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
          if (where.type !== undefined && n.type !== where.type) {
            return false;
          }
          return true;
        });
      },
      deleteMany: async ({ where }) => {
        const before = notifications.length;
        notifications = notifications.filter((n) => {
          if (where.event_id !== undefined && n.event_id === where.event_id) {
            if (where.type !== undefined && n.type === where.type) return false;
            if (where.type === undefined) return false;
          }
          return true;
        });
        return { count: before - notifications.length };
      },
    },
    $transaction: async (callback) => {
      return callback(mock);
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

test('GET /api/events: kiểm tra validation tham số truy vấn khoảng lịch', async () => {
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

    // 6. Lỗi 400 VALIDATION_ERROR: remindBefore âm
    const resNeg = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...minimalPayload, remindBefore: -1 }),
    });
    assert.equal(resNeg.status, 400);
    assert.equal((await resNeg.json()).error.code, 'VALIDATION_ERROR');
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

test('PATCH /api/events/:id: cập nhật sự kiện, chuyển status và transaction reset Reminder', async () => {
  const initialEvents = [
    {
      event_id: 5,
      user_id: 10,
      title: 'Hạn ban đầu',
      due_date: new Date('2026-11-05T17:00:00.000Z'),
      remind_before: 24,
      notes: null,
      status: 'Upcoming',
      reminded_at: new Date('2026-11-04T17:00:00.000Z'),
      created_at: new Date('2026-10-28T00:00:00.000Z'),
      updated_at: new Date('2026-10-28T00:00:00.000Z'),
    },
    {
      event_id: 6,
      user_id: 10,
      title: 'Sự kiện đã hoàn thành',
      due_date: new Date('2026-10-20T00:00:00.000Z'), // Quá hạn
      remind_before: 24,
      notes: null,
      status: 'Completed',
      reminded_at: null,
      created_at: new Date('2026-10-18T00:00:00.000Z'),
      updated_at: new Date('2026-10-18T00:00:00.000Z'),
    },
    {
      event_id: 7,
      user_id: 10,
      title: 'Sự kiện quá hạn chưa xong',
      due_date: new Date('2026-10-20T00:00:00.000Z'), // Quá hạn so với evaluatedAt
      remind_before: 24,
      notes: 'Cũ',
      status: 'Overdue',
      reminded_at: null,
      created_at: new Date('2026-10-18T00:00:00.000Z'),
      updated_at: new Date('2026-10-18T00:00:00.000Z'),
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
      event_id: null,
      type: 'Violation',
      user_id: 10,
      content: 'Vi phạm',
      is_read: false,
    },
  ];

  const prisma = createMockPrisma({ initialEvents, initialNotifications });
  const evaluatedAt = new Date('2026-10-28T12:00:00.000Z');
  const app = testApp(prisma, evaluatedAt);
  const studentToken = await tokenService.sign(studentIdentity);

  await withServer(app, async (baseUrl) => {
    // 1. Chỉ sửa nội dung (title/notes) của event 5: KHÔNG reset reminded_at và KHÔNG xóa Reminder
    const res1 = await fetch(`${baseUrl}/api/events/5`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes: 'Ghi chú mới' }),
    });
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.event.notes, 'Ghi chú mới');
    assert.notEqual(body1.event.remindedAt, null); // Vẫn giữ reminded_at
    const notifs1 = prisma._getNotifications();
    assert.equal(
      notifs1.some((n) => n.notification_id === 1),
      true,
    ); // Vẫn giữ notification Reminder

    // 2. Sửa dueDate sang thời điểm tương lai mới: reset reminded_at = null và XÓA Reminder notification
    const res2 = await fetch(`${baseUrl}/api/events/5`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dueDate: '2026-11-12T17:00:00Z' }),
    });
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.event.dueDate, '2026-11-12T17:00:00Z');
    assert.equal(body2.event.remindedAt, null); // Đã reset thành null
    assert.equal(body2.event.status, 'Upcoming');
    const notifs2 = prisma._getNotifications();
    assert.equal(
      notifs2.some((n) => n.event_id === 5 && n.type === 'Reminder'),
      false,
    ); // Reminder đã bị xóa
    assert.equal(
      notifs2.some((n) => n.notification_id === 2),
      true,
    ); // Violation không bị ảnh hưởng

    // 3. Sửa nội dung sự kiện đã quá hạn (event 7): cho phép giữ dueDate cũ, status giữ Overdue
    const res3 = await fetch(`${baseUrl}/api/events/7`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes: 'Sửa nội dung sau hạn' }),
    });
    assert.equal(res3.status, 200);
    const body3 = await res3.json();
    assert.equal(body3.event.notes, 'Sửa nội dung sau hạn');
    assert.equal(body3.event.status, 'Overdue'); // Giữ Overdue theo flow 3a3

    // 4. Sửa sự kiện đã Completed (event 6): giữ nguyên Completed
    const res4 = await fetch(`${baseUrl}/api/events/6`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes: 'Ghi chú cho Completed' }),
    });
    assert.equal(res4.status, 200);
    const body4 = await res4.json();
    assert.equal(body4.event.status, 'Completed');

    // 5. Thử truyền status hoặc owner qua PATCH /api/events/:id -> 400 INVALID_REQUEST
    const res5 = await fetch(`${baseUrl}/api/events/5`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'Completed' }),
    });
    assert.equal(res5.status, 400);
    assert.equal((await res5.json()).error.code, 'INVALID_REQUEST');
  });
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
