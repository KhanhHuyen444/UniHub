import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  freezeReminderEmail,
  readReminderEmailConfig,
} from '../dist/modules/events/reminder-email.js';
import {
  processReminderEvent,
  runDeadlineReminders,
} from '../dist/modules/events/reminders.service.js';
import { createReminderScheduler } from '../dist/modules/events/reminders.scheduler.js';
import { patchEvent } from '../dist/modules/events/events.service.js';

const instant = new Date('2026-11-01T16:00:00Z');
const now = () => new Date(instant);
const environment = {
  EVENT_REMINDER_EMAIL_ENABLED: 'true',
  EMAIL_FROM: 'reminders@unihub.example',
  EMAIL_IDEMPOTENCY_NAMESPACE: 'test-lineage',
  APP_BASE_URL: 'https://unihub.example',
};
const email = readReminderEmailConfig(environment);

function fixture(overrides = {}) {
  const state = {
    event: {
      event_id: 1,
      user_id: 7,
      title: `<b>Title & "quote" 'single'</b>`,
      notes: 'Original notes',
      due_date: new Date('2026-11-01T17:00:00Z'),
      remind_before: 1,
      reminded_at: null,
      status: 'Upcoming',
      created_at: instant,
      updated_at: instant,
      ...overrides,
    },
    notifications: [],
    jobs: [],
  };
  const controls = {
    owner: { user_id: 7, role: 'Student', email: 'student@example.test' },
    failJob: false,
    conflictAfterInsert: 0,
    claimCount: 1,
    transactions: 0,
    ownerReads: 0,
    jobWrites: 0,
    deletes: 0,
    nextNotificationId: 42,
    attemptedJobs: [],
    onSerializationRollback: undefined,
  };
  let active = false;
  const tx = {
    event: {
      findUnique: async () => structuredClone(state.event),
      findFirst: async () => structuredClone(state.event),
      updateMany: async ({ where, data }) => {
        assert.ok(active);
        if ('due_date' in where) {
          assert.equal(where.status, 'Upcoming');
          assert.deepEqual(where.due_date, state.event.due_date);
          assert.equal(where.remind_before, state.event.remind_before);
          assert.deepEqual(where.reminded_at, state.event.reminded_at);
        }
        if (controls.claimCount === 1) Object.assign(state.event, data);
        return { count: controls.claimCount };
      },
    },
    notification: {
      create: async ({ data }) => {
        assert.ok(active);
        // Auto-increment allocation is not rolled back with transaction data.
        const row = { notification_id: controls.nextNotificationId++, ...data };
        state.notifications.push(row);
        return row;
      },
      deleteMany: async () => {
        controls.deletes++;
        state.notifications = [];
        // Model the approved FK cascade; this does not verify MySQL itself.
        state.jobs = [];
      },
    },
    user: {
      findUnique: async ({ where, select }) => {
        assert.ok(active);
        assert.deepEqual(where, { user_id: 7 });
        assert.deepEqual(select, { user_id: true, role: true, email: true });
        controls.ownerReads++;
        return controls.owner;
      },
    },
    eventReminderEmail: {
      create: async ({ data }) => {
        assert.ok(active);
        controls.jobWrites++;
        if (controls.failJob) throw new Error('private insertion failure');
        assert.equal(state.event.reminded_at.getTime(), instant.getTime());
        assert.equal(state.notifications.length, 1);
        assert.equal(
          data.notification_id,
          state.notifications[0].notification_id,
        );
        controls.attemptedJobs.push(structuredClone(data));
        state.jobs.push(data);
        return data;
      },
    },
  };
  const client = {
    $queryRaw: async (strings) =>
      strings.join('').includes('MAX(event_id)')
        ? [{ max_id: 1 }]
        : [{ event_id: 1, due_date: state.event.due_date }],
    $transaction: async (operation, options) => {
      controls.transactions++;
      assert.equal(options.isolationLevel, 'Serializable');
      const snapshot = structuredClone(state);
      active = true;
      try {
        const result = await operation(tx);
        if (controls.conflictAfterInsert-- > 0) throw { code: 'P2034' };
        return result;
      } catch (error) {
        Object.assign(state, snapshot);
        if (error?.code === 'P2034') controls.onSerializationRollback?.();
        throw error;
      } finally {
        active = false;
      }
    },
  };
  return { state, controls, client };
}

const process = (f, config = email) =>
  processReminderEvent(f.client, 1, now, () => false, config);

test('configuration defaults disabled without inspecting enabled-only settings', () => {
  const env = new Proxy(
    {},
    {
      get: (_, name) => {
        assert.equal(name, 'EVENT_REMINDER_EMAIL_ENABLED');
        return undefined;
      },
    },
  );
  assert.deepEqual(readReminderEmailConfig(env), { enabled: false });
  assert.deepEqual(
    readReminderEmailConfig({ EVENT_REMINDER_EMAIL_ENABLED: 'false' }),
    { enabled: false },
  );
});

test('enabled configuration rejects missing/unsafe settings without leaking values', () => {
  for (const overrides of [
    { EVENT_REMINDER_EMAIL_ENABLED: 'yes' },
    { EMAIL_FROM: undefined },
    { EMAIL_FROM: 'private\r\nheader@example.test' },
    { EMAIL_IDEMPOTENCY_NAMESPACE: 'deploy/123' },
    { EMAIL_IDEMPOTENCY_NAMESPACE: 'x'.repeat(65) },
    { APP_BASE_URL: 'not a URL' },
    { APP_BASE_URL: 'https://user:private@unihub.example' },
    { APP_BASE_URL: 'https://unihub.example/path' },
    { APP_BASE_URL: 'https://unihub.example?private=1' },
    { APP_BASE_URL: 'https://unihub.example#private' },
    { APP_BASE_URL: 'http://unihub.example' },
    { APP_BASE_URL: 'http://localhost:5173', NODE_ENV: 'production' },
  ]) {
    assert.throws(
      () => readReminderEmailConfig({ ...environment, ...overrides }),
      { message: 'REMINDER_EMAIL_CONFIG_INVALID' },
    );
  }
  const local = readReminderEmailConfig({
    ...environment,
    APP_BASE_URL: 'http://127.0.0.1:5173',
  });
  assert.equal(local.calendarUrl, 'http://127.0.0.1:5173/calendar');
});

test('valid single mailboxes work unchanged for both sender and recipient', () => {
  for (const address of [
    'student@example.test',
    'First.Last+calendar@Sub-Domain.Example.TEST',
    "o'connor@example.test",
    "!#$%&'*+-/=?^_`{|}~@example.test",
    'student@xn--bcher-kva.example',
    `${'a'.repeat(64)}@${'b'.repeat(63)}.example`,
  ]) {
    const config = readReminderEmailConfig({
      ...environment,
      EMAIL_FROM: address,
    });
    const payload = JSON.parse(
      freezeReminderEmail(config, fixture().state.event, address, 42)
        .payload_json,
    );
    assert.equal(payload.from, address);
    assert.deepEqual(payload.to, [address]);
  }
});

test('malformed mailboxes are rejected consistently for sender and recipient', () => {
  const controls = Array.from({ length: 33 }, (_, index) =>
    String.fromCharCode(index),
  );
  controls.push(
    ...Array.from({ length: 33 }, (_, index) =>
      String.fromCharCode(127 + index),
    ),
  );
  const invalid = [
    '',
    'missing-at.example.test',
    '@example.test',
    'student@',
    'student@@example.test',
    'student@example',
    'a,b@example.test',
    'one@example.test,two@example.test',
    'one@example.test;two@example.test',
    'Name <student@example.test>',
    '<student@example.test>',
    'student(comment)@example.test',
    '"student"@example.test',
    '.student@example.test',
    'student.@example.test',
    'stu..dent@example.test',
    'student@.example.test',
    'student@example..test',
    'student@example.test.',
    'student@-example.test',
    'student@example-.test',
    'student@exam_ple.test',
    'student@[127.0.0.1]',
    `${'a'.repeat(65)}@example.test`,
    `student@${'a'.repeat(64)}.test`,
    `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}`,
    ' student@example.test',
    'student@example.test ',
    'stu dent@example.test',
    'student@example.test\r\n',
    'student\u00a0@example.test',
    'student\u2003@example.test',
    ...controls.flatMap((character) => [
      `stu${character}dent@example.test`,
      `student@example.test${character}`,
    ]),
  ];
  for (const address of invalid) {
    assert.throws(
      () => readReminderEmailConfig({ ...environment, EMAIL_FROM: address }),
      { message: 'REMINDER_EMAIL_CONFIG_INVALID' },
      JSON.stringify(address),
    );
    assert.throws(
      () => freezeReminderEmail(email, fixture().state.event, address, 42),
      { message: 'REMINDER_EMAIL_RECIPIENT_INVALID' },
      JSON.stringify(address),
    );
  }
});

test('enabled enqueue commits bell, marker and one complete frozen request', async () => {
  const f = fixture();
  assert.equal(await process(f), 'reminded');
  assert.equal(f.state.notifications.length, 1);
  assert.equal(f.state.jobs.length, 1);
  const job = f.state.jobs[0];
  assert.equal(job.idempotency_key, 'unihub/test-lineage/event-reminder/42');
  assert.deepEqual(Object.keys(job).sort(), [
    'idempotency_key',
    'notification_id',
    'payload_json',
  ]);
  const payload = JSON.parse(job.payload_json);
  assert.deepEqual(Object.keys(payload), [
    'from',
    'to',
    'subject',
    'html',
    'text',
  ]);
  assert.equal(payload.from, environment.EMAIL_FROM);
  assert.deepEqual(payload.to, ['student@example.test']);
  assert.equal(payload.subject, 'UniHub — Nhắc hạn sự kiện');
  assert.match(
    payload.html,
    /&lt;b&gt;Title &amp; &quot;quote&quot; &#39;single&#39;&lt;\/b&gt;/,
  );
  assert.match(
    payload.html,
    /02\/11\/2026 00:00:00 \(Asia\/Ho_Chi_Minh, UTC\+07:00\)/,
  );
  assert.match(payload.html, /href="https:\/\/unihub.example\/calendar"/);
  assert.ok(payload.text.includes(f.state.event.title));
  assert.ok(!payload.text.includes('&lt;'));
  assert.equal(await process(f), 'skipped');
  assert.equal(f.state.jobs.length, 1);
});

test('disabled mode never reads owner or accesses the outbox', async () => {
  const f = fixture();
  f.controls.owner = null;
  f.controls.failJob = true;
  assert.equal(await process(f, { enabled: false }), 'reminded');
  assert.equal(f.controls.ownerReads, 0);
  assert.equal(f.controls.jobWrites, 0);
  assert.equal(f.state.notifications.length, 1);
});

test('invalid recipient/owner and insertion failure roll back everything', async () => {
  for (const owner of [
    null,
    { user_id: 7, role: 'Admin', email: 'admin@example.test' },
    { user_id: 8, role: 'Student', email: 'other@example.test' },
    { user_id: 7, role: 'Student', email: 'private-invalid-email' },
    { user_id: 7, role: 'Student', email: 'x'.repeat(256) + '@test.invalid' },
  ]) {
    const f = fixture();
    f.controls.owner = owner;
    await assert.rejects(
      process(f),
      /REMINDER_EMAIL_(OWNER|RECIPIENT)_INVALID/,
    );
    assert.equal(f.state.event.reminded_at, null);
    assert.deepEqual(f.state.notifications, []);
    assert.deepEqual(f.state.jobs, []);
    assert.equal(f.controls.transactions, 1);
  }
  const f = fixture();
  f.controls.failJob = true;
  const errors = [];
  await runDeadlineReminders(f.client, {
    now,
    email,
    onEventError: (id) => errors.push(id),
  });
  assert.deepEqual(errors, [1]);
  assert.equal(f.state.event.reminded_at, null);
  assert.deepEqual(f.state.notifications, []);
  assert.deepEqual(f.state.jobs, []);
  f.controls.failJob = false;
  await runDeadlineReminders(f.client, { now, email });
  assert.equal(f.state.jobs.length, 1);
});

test('payload construction failure rolls back the bell and marker', async () => {
  const f = fixture({ title: null });
  await assert.rejects(process(f));
  assert.equal(f.state.event.reminded_at, null);
  assert.deepEqual(f.state.notifications, []);
  assert.deepEqual(f.state.jobs, []);
  assert.equal(f.controls.jobWrites, 0);
});

test('whole-transaction serialization retries are bounded and leave one job', async () => {
  const f = fixture();
  f.controls.conflictAfterInsert = 2;
  await process(f);
  assert.equal(f.controls.transactions, 3);
  assert.equal(f.state.notifications.length, 1);
  assert.equal(f.state.jobs.length, 1);
  assert.equal(f.state.notifications[0].notification_id, 44);
  assert.equal(f.state.jobs[0].notification_id, 44);
  assert.equal(
    f.state.jobs[0].idempotency_key,
    'unihub/test-lineage/event-reminder/44',
  );
  const failing = fixture();
  failing.controls.conflictAfterInsert = 3;
  await assert.rejects(process(failing), (error) => error.code === 'P2034');
  assert.equal(failing.controls.transactions, 3);
  assert.equal(failing.state.event.reminded_at, null);
  assert.deepEqual(failing.state.jobs, []);
  assert.deepEqual(failing.state.notifications, []);
});

test('P2034 retry freezes current recipient/deadline and uses the new notification ID', async () => {
  const f = fixture();
  f.controls.conflictAfterInsert = 1;
  f.controls.onSerializationRollback = () => {
    assert.deepEqual(f.state.notifications, []);
    assert.deepEqual(f.state.jobs, []);
    assert.equal(f.state.event.reminded_at, null);
    f.controls.owner.email = 'current+calendar@example.test';
    // Still within the current one-hour reminder window.
    f.state.event.due_date = new Date('2026-11-01T16:30:00Z');
  };
  assert.equal(await process(f), 'reminded');
  assert.equal(f.controls.transactions, 2);
  assert.equal(f.controls.ownerReads, 2);
  assert.equal(f.state.notifications.length, 1);
  assert.equal(f.state.notifications[0].notification_id, 43);
  assert.equal(f.state.jobs.length, 1);
  const [rolledBack, committed] = f.controls.attemptedJobs;
  assert.equal(rolledBack.notification_id, 42);
  assert.equal(
    rolledBack.idempotency_key,
    'unihub/test-lineage/event-reminder/42',
  );
  assert.deepEqual(JSON.parse(rolledBack.payload_json).to, [
    'student@example.test',
  ]);
  assert.deepEqual(f.state.jobs[0], committed);
  assert.equal(committed.notification_id, 43);
  assert.equal(
    committed.idempotency_key,
    'unihub/test-lineage/event-reminder/43',
  );
  const payload = JSON.parse(committed.payload_json);
  assert.deepEqual(payload.to, ['current+calendar@example.test']);
  assert.match(payload.html, /01\/11\/2026 23:30:00/);
  assert.match(payload.text, /01\/11\/2026 23:30:00/);
  assert.ok(!committed.payload_json.includes('student@example.test'));
  assert.ok(!committed.payload_json.includes('02/11/2026 00:00:00'));
});

for (const [label, mutate, expected] of [
  [
    'recipient becomes invalid',
    (f) => {
      f.controls.owner.email = 'bad,address@example.test';
    },
    'REMINDER_EMAIL_RECIPIENT_INVALID',
  ],
  [
    'owner loses Student role',
    (f) => {
      f.controls.owner.role = 'Admin';
    },
    'REMINDER_EMAIL_OWNER_INVALID',
  ],
  [
    'Event becomes Completed',
    (f) => {
      f.state.event.status = 'Completed';
    },
    'skipped',
  ],
  [
    'Event becomes Overdue',
    (f) => {
      f.state.event.status = 'Overdue';
    },
    'skipped',
  ],
  [
    'deadline moves outside window',
    (f) => {
      f.state.event.due_date = new Date(+instant + 7_200_000);
    },
    'skipped',
  ],
  [
    'deadline has passed',
    (f) => {
      f.state.event.due_date = new Date(+instant - 1000);
    },
    'overdue',
  ],
  [
    'reminders are disabled',
    (f) => {
      f.state.event.remind_before = 0;
    },
    'skipped',
  ],
]) {
  test(`P2034 retry leaves no job when ${label}`, async () => {
    const f = fixture();
    f.controls.conflictAfterInsert = 1;
    f.controls.onSerializationRollback = () => {
      assert.deepEqual(f.state.notifications, []);
      assert.deepEqual(f.state.jobs, []);
      assert.equal(f.state.event.reminded_at, null);
      mutate(f);
    };
    if (expected.startsWith('REMINDER_EMAIL_')) {
      await assert.rejects(process(f), { message: expected });
    } else {
      assert.equal(await process(f), expected);
    }
    assert.equal(f.controls.transactions, 2);
    assert.equal(f.controls.attemptedJobs.length, 1);
    assert.deepEqual(f.state.jobs, []);
    assert.deepEqual(f.state.notifications, []);
    assert.equal(f.state.event.reminded_at, null);
    if (expected === 'overdue') assert.equal(f.state.event.status, 'Overdue');
  });
}

test('ineligible events and lost claims do not touch owner/outbox', async () => {
  for (const overrides of [
    { status: 'Completed' },
    { status: 'Overdue' },
    { remind_before: 0 },
    { reminded_at: instant },
    { due_date: new Date(+instant + 3_600_001) },
    { due_date: instant },
  ]) {
    const f = fixture(overrides);
    await process(f);
    assert.equal(f.controls.ownerReads, 0);
    assert.equal(f.controls.jobWrites, 0);
  }
  const f = fixture();
  f.controls.claimCount = 0;
  assert.equal(await process(f), 'skipped');
  assert.equal(f.controls.jobWrites, 0);
});

test('title/notes edits preserve frozen job; reminder edits use existing deletion', async () => {
  const f = fixture();
  await process(f);
  const frozen = structuredClone(f.state.jobs);
  const bell = structuredClone(f.state.notifications);
  await patchEvent(
    f.client,
    7,
    '1',
    { title: 'Changed title', notes: 'Changed notes' },
    instant,
  );
  assert.equal(f.controls.deletes, 0);
  assert.deepEqual(f.state.jobs, frozen);
  assert.deepEqual(f.state.notifications, bell);
  assert.equal(await process(f), 'skipped');
  assert.deepEqual(f.state.jobs, frozen);
  await patchEvent(f.client, 7, '1', { remindBefore: 2 }, instant);
  assert.equal(f.controls.deletes, 1);
  assert.equal(f.state.event.reminded_at, null);
  assert.deepEqual(f.state.jobs, []);
});

test('frozen serialization/key are deterministic and use no current environment', () => {
  const event = fixture().state.event;
  const first = freezeReminderEmail(email, event, 'student@example.test', 42);
  assert.deepEqual(
    freezeReminderEmail(email, event, 'student@example.test', 42),
    first,
  );
  assert.throws(
    () => freezeReminderEmail(email, event, 'invalid', 42),
    /RECIPIENT_INVALID/,
  );
  assert.throws(
    () =>
      freezeReminderEmail(
        email,
        { ...event, due_date: new Date(NaN) },
        'student@example.test',
        42,
      ),
    /PAYLOAD_INVALID/,
  );
});

test('scheduler passes enabled configuration to the enqueue transaction', async () => {
  const f = fixture();
  let reportCount = 0;
  const scheduler = createReminderScheduler({
    getClient: () => f.client,
    email,
    now,
    reportError: () => reportCount++,
    setInterval: () => ({ unref() {} }),
    clearInterval: () => {},
  });
  scheduler.start();
  await new Promise((resolve) => setImmediate(resolve));
  await scheduler.stop();
  assert.equal(reportCount, 0);
  assert.equal(f.state.jobs.length, 1);
});
