import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  processReminderEvent,
  runDeadlineReminders,
  REMINDER_BATCH_SIZE,
} from '../dist/modules/events/reminders.service.js';
import {
  createReminderScheduler,
  REMINDER_INTERVAL_MS,
} from '../dist/modules/events/reminders.scheduler.js';

const instant = new Date('2026-11-01T00:00:00Z');
const now = () => new Date(instant);
const candidateQuery =
  (query) =>
  (strings, ...values) =>
    strings.join('').includes('MAX(event_id)')
      ? Promise.resolve([{ max_id: 10_000 }])
      : query(strings, ...values);
function fixture(overrides = {}) {
  const state = {
    event: {
      event_id: 1,
      user_id: 7,
      title: 'Hạn nộp bài',
      due_date: new Date(instant.getTime() + 3_600_000),
      remind_before: 1,
      reminded_at: null,
      status: 'Upcoming',
      ...overrides,
    },
    notifications: [],
    attempts: 0,
    failInsert: false,
    failUpdate: false,
    conflicts: 0,
    claimCount: 1,
  };
  const tx = {
    event: {
      findUnique: async () => structuredClone(state.event),
      updateMany: async ({ where, data }) => {
        assert.equal(where.status, 'Upcoming');
        assert.equal(where.due_date.getTime(), state.event.due_date.getTime());
        assert.equal(where.remind_before, state.event.remind_before);
        assert.deepEqual(where.reminded_at, state.event.reminded_at);
        if (state.failUpdate) throw new Error('update failed');
        if (state.claimCount === 1) Object.assign(state.event, data);
        return { count: state.claimCount };
      },
    },
    notification: {
      create: async ({ data }) => {
        if (state.failInsert) throw new Error('insert failed');
        state.notifications.push(data);
      },
    },
  };
  const client = {
    $queryRaw: candidateQuery(async () =>
      state.event
        ? [{ event_id: state.event.event_id, due_date: state.event.due_date }]
        : [],
    ),
    $transaction: async (operation, options) => {
      state.attempts++;
      assert.equal(options.isolationLevel, 'Serializable');
      assert.equal(options.timeout, 5000);
      if (state.conflicts-- > 0) throw { code: 'P2034' };
      const snapshot = structuredClone(state);
      try {
        return await operation(tx);
      } catch (error) {
        Object.assign(state, snapshot);
        throw error;
      }
    },
  };
  return { state, client };
}

for (const [label, overrides, expected] of [
  ['threshold inclusive', {}, 'reminded'],
  ['inside threshold', { due_date: new Date(+instant + 1000) }, 'reminded'],
  [
    'outside threshold',
    { due_date: new Date(+instant + 3_600_001) },
    'skipped',
  ],
  ['zero lead time', { remind_before: 0 }, 'skipped'],
  ['deadline equals now', { due_date: instant }, 'overdue'],
  ['expired', { due_date: new Date(+instant - 1000) }, 'overdue'],
  ['completed', { status: 'Completed', due_date: instant }, 'skipped'],
  ['overdue', { status: 'Overdue' }, 'skipped'],
  ['already reminded', { reminded_at: instant }, 'skipped'],
  [
    'expired after reminder',
    { reminded_at: instant, due_date: instant },
    'overdue',
  ],
]) {
  test(`eligibility: ${label}`, async () => {
    const { client, state } = fixture(overrides);
    assert.equal(await processReminderEvent(client, 1, now), expected);
    assert.equal(state.notifications.length, expected === 'reminded' ? 1 : 0);
    if (expected === 'overdue') assert.equal(state.event.status, 'Overdue');
    if (expected === 'reminded') {
      assert.deepEqual(state.event.reminded_at, instant);
      assert.deepEqual(state.notifications[0], {
        user_id: 7,
        event_id: 1,
        type: 'Reminder',
        content: 'Nhắc hạn sự kiện: Hạn nộp bài',
        is_read: false,
      });
    }
  });
}

test('repeated runs/restarted scheduler remain idempotent', async () => {
  const { client, state } = fixture({ title: 'x'.repeat(255) });
  await runDeadlineReminders(client, { now });
  await runDeadlineReminders(client, { now });
  assert.equal(state.notifications.length, 1);
  assert.ok(state.notifications[0].content.length <= 500);
});

test('candidate deleted, completed or rescheduled before transaction is reread', async () => {
  for (const change of [
    (s) => (s.event = null),
    (s) => (s.event.status = 'Completed'),
    (s) => (s.event.due_date = new Date(+instant + 7_200_000)),
    (s) => (s.event.remind_before = 0),
  ]) {
    const { client, state } = fixture();
    const original = client.$transaction;
    client.$transaction = (...args) => {
      change(state);
      return original(...args);
    };
    await runDeadlineReminders(client, { now });
    assert.equal(state.notifications.length, 0);
  }
});

test('lost conditional claim never creates a notification', async () => {
  const { client, state } = fixture();
  state.claimCount = 0;
  assert.equal(await processReminderEvent(client, 1, now), 'skipped');
  assert.equal(state.notifications.length, 0);
});

test('rollback insert/update failures and retry next run', async () => {
  for (const failure of ['failInsert', 'failUpdate']) {
    const { client, state } = fixture();
    state[failure] = true;
    await assert.rejects(processReminderEvent(client, 1, now));
    assert.equal(state.event.reminded_at, null);
    assert.equal(state.notifications.length, 0);
    assert.equal(state.attempts, 1);
    state[failure] = false;
    await processReminderEvent(client, 1, now);
    assert.equal(state.notifications.length, 1);
  }
});

test('serialization retry is bounded', async () => {
  const { client, state } = fixture();
  state.conflicts = 2;
  assert.equal(await processReminderEvent(client, 1, now), 'reminded');
  assert.equal(state.attempts, 3);
  state.conflicts = 4;
  await assert.rejects(processReminderEvent(client, 1, now));
  assert.equal(state.attempts, 6);
});

test('retry rolls back a notification and rereads deadline, status and clock', async () => {
  for (const mutation of ['deadline', 'completed', 'expired']) {
    const { client, state } = fixture();
    const transaction = client.$transaction;
    let first = true;
    let clock = instant;
    client.$transaction = async (operation, options) => {
      if (!first) return transaction(operation, options);
      first = false;
      await assert.rejects(
        transaction(async (tx) => {
          await operation(tx);
          assert.equal(state.notifications.length, 1);
          throw { code: 'P2034' };
        }, options),
      );
      if (mutation === 'deadline')
        state.event.due_date = new Date(+instant + 7_200_000);
      if (mutation === 'completed') state.event.status = 'Completed';
      if (mutation === 'expired') clock = new Date(+instant + 3_600_000);
      throw { code: 'P2034' };
    };
    assert.equal(
      await processReminderEvent(client, 1, () => clock),
      mutation === 'expired' ? 'overdue' : 'skipped',
    );
    assert.equal(state.notifications.length, 0);
    assert.equal(state.event.reminded_at, null);
  }
});

test('candidate query is bounded, parameterized and orders by deadline', async () => {
  const { client } = fixture();
  client.$queryRaw = candidateQuery(async (strings, ...values) => {
    const sql = strings.join('?');
    assert.match(sql, /due_date <= \?/);
    assert.match(sql, /reminded_at IS NULL AND due_date > \?/);
    assert.match(sql, /TIMESTAMPDIFF\(MICROSECOND/);
    assert.match(sql, /ORDER BY due_date ASC, event_id ASC/);
    assert.match(sql, /LIMIT \?/);
    assert.equal(values[0], 10_000);
    assert.deepEqual(values.slice(2), [
      instant,
      instant,
      instant,
      REMINDER_BATCH_SIZE,
    ]);
    return [];
  });
  await runDeadlineReminders(client, { now });
});

test('event failures are isolated; outage errors and cancellation are bounded', async () => {
  const { client, state } = fixture();
  state.failInsert = true;
  let queries = 0;
  client.$queryRaw = candidateQuery(async () => {
    queries++;
    return [1, 2, 3, 4].map((event_id) => ({ event_id, due_date: instant }));
  });
  const failed = [];
  await runDeadlineReminders(client, {
    now,
    onEventError: (id) => failed.push(id),
  });
  assert.deepEqual(failed, [1, 2, 3]);
  assert.equal(state.attempts, 3);
  assert.equal(queries, 1);
  await runDeadlineReminders(client, { shouldStop: () => true });
  assert.equal(queries, 1);
});

function scanFixture(size, failing) {
  const rows = Array.from({ length: size }, (_, index) => ({
    event_id: index + 1,
    user_id: 7,
    title: 'Scan',
    status: 'Upcoming',
    due_date: new Date(+instant + 3_600_000),
    remind_before: 1,
    reminded_at: null,
  }));
  const notified = [];
  const state = {};
  const client = {
    $queryRaw: async (strings, ...values) => {
      if (strings.join('').includes('MAX(event_id)'))
        return [{ max_id: Math.max(...rows.map((r) => r.event_id)) }];
      const [maxId, after] = values;
      const cursor = after.values;
      return rows
        .filter(
          (r) =>
            r.event_id <= maxId &&
            r.status === 'Upcoming' &&
            r.reminded_at === null &&
            (!cursor.length ||
              +r.due_date > +cursor[0] ||
              (+r.due_date === +cursor[0] && r.event_id > cursor[2])),
        )
        .sort((a, b) => +a.due_date - +b.due_date || a.event_id - b.event_id)
        .slice(0, REMINDER_BATCH_SIZE)
        .map((r) => ({ event_id: r.event_id, due_date: r.due_date }));
    },
    $transaction: async (operation) => {
      let current;
      return operation({
        event: {
          findUnique: async ({ where }) => {
            if (failing.has(where.event_id))
              throw new Error('Persistent event failure');
            current = rows.find((r) => r.event_id === where.event_id);
            return { ...current };
          },
          updateMany: async ({ data }) => {
            Object.assign(current, data);
            return { count: 1 };
          },
        },
        notification: {
          create: async ({ data }) => notified.push(data.event_id),
        },
      });
    },
  };
  return {
    rows,
    notified,
    state,
    client,
    tick: () => runDeadlineReminders(client, { now, scanState: state }),
  };
}

test('more than 100 persistent failing events cannot starve healthy events behind them', async () => {
  const f = scanFixture(
    108,
    new Set(Array.from({ length: 103 }, (_, i) => i + 1)),
  );
  for (let tick = 0; tick < 37; tick++) await f.tick();
  assert.deepEqual(f.notified, [104, 105, 106, 107, 108]);
});

test('sweep wraps to recover failures, moved deadlines and IDs inserted after its watermark', async () => {
  const failing = new Set([1, 2, 3]);
  const f = scanFixture(4, failing);
  await f.tick();
  assert.equal(f.state.maxId, 4);
  assert.equal(f.state.after.event_id, 3);
  f.rows[3].due_date = new Date(+instant + 1000); // Move behind cursor.
  f.rows.push({ ...f.rows[3], event_id: 5 }); // Beyond fixed sweep watermark.
  failing.clear();
  await f.tick();
  assert.deepEqual(f.notified, []);
  assert.equal(f.state.maxId, undefined);
  await f.tick();
  assert.deepEqual(f.notified, [4, 5, 1, 2, 3]);
  await f.tick();
  assert.equal(f.notified.length, 5);
});

const flush = () => new Promise((resolve) => setImmediate(resolve));
function schedulerFixture(getClient) {
  let callback;
  let scheduled = 0;
  let cleared = 0;
  let errors = 0;
  const scheduler = createReminderScheduler({
    getClient: () => {
      const client = getClient();
      return {
        ...client,
        $queryRaw: candidateQuery(client.$queryRaw.bind(client)),
      };
    },
    now,
    reportError: () => errors++,
    setInterval: (fn, delay) => {
      assert.equal(delay, 60_000);
      callback = fn;
      scheduled++;
      return { unref() {} };
    },
    clearInterval: () => cleared++,
  });
  return {
    scheduler,
    tick: () => callback(),
    counts: () => ({ scheduled, cleared, errors }),
  };
}

test('scheduler starts once, skips overlap, drains stop and cannot restart after shutdown', async () => {
  assert.equal(REMINDER_INTERVAL_MS, 60_000);
  let release;
  let queries = 0;
  const f = schedulerFixture(() => ({
    $queryRaw: () => {
      queries++;
      return new Promise((r) => {
        release = r;
      });
    },
  }));
  f.scheduler.start();
  f.scheduler.start();
  await flush();
  f.tick();
  await flush();
  assert.equal(queries, 1);
  let stopped = false;
  const stopping = f.scheduler.stop().then(() => {
    stopped = true;
  });
  await flush();
  assert.equal(stopped, false);
  release([]);
  await stopping;
  f.tick();
  await flush();
  assert.equal(queries, 1);
  f.scheduler.start();
  await flush();
  await f.scheduler.stop();
  assert.equal(queries, 1);
  assert.deepEqual(f.counts(), { scheduled: 1, cleared: 1, errors: 0 });
});

test('scheduler isolates missing database and query failures, retries next tick', async () => {
  let calls = 0;
  const f = schedulerFixture(() => {
    calls++;
    if (calls === 1) throw new Error('private database configuration');
    return {
      $queryRaw: async () => {
        throw new Error('private SQL');
      },
    };
  });
  f.scheduler.start();
  await flush();
  f.tick();
  await flush();
  await f.scheduler.stop();
  assert.equal(f.counts().errors, 2);
});

test('stop before startup microtask avoids database access', async () => {
  const f = schedulerFixture(() => {
    throw new Error('must not connect');
  });
  f.scheduler.start();
  await f.scheduler.stop();
  assert.equal(f.counts().errors, 0);
});

test('stop cancels queued transaction work and remaining candidates', async () => {
  const { client, state } = fixture();
  client.$queryRaw = candidateQuery(async () => [
    { event_id: 1, due_date: instant },
    { event_id: 2, due_date: instant },
  ]);
  const transaction = client.$transaction;
  let release;
  client.$transaction = async (...args) => {
    await new Promise((resolve) => {
      release = resolve;
    });
    return transaction(...args);
  };
  const f = schedulerFixture(() => client);
  f.scheduler.start();
  await flush();
  const stopped = f.scheduler.stop();
  f.scheduler.start();
  f.tick();
  release();
  await stopped;
  assert.equal(state.attempts, 1);
  assert.equal(state.notifications.length, 0);
  assert.equal(f.counts().scheduled, 1);
});

test('stop waits for an in-flight transaction to settle and skips remaining candidates', async () => {
  const { client, state } = fixture();
  client.$queryRaw = candidateQuery(async () => [
    { event_id: 1, due_date: instant },
    { event_id: 2, due_date: instant },
  ]);
  const transaction = client.$transaction;
  let release;
  client.$transaction = (operation, options) =>
    transaction(async (tx) => {
      const result = await operation(tx);
      await new Promise((resolve) => {
        release = resolve;
      });
      return result;
    }, options);
  const f = schedulerFixture(() => client);
  f.scheduler.start();
  await flush();
  assert.equal(state.notifications.length, 1);
  let settled = false;
  const stopped = f.scheduler.stop().then(() => {
    settled = true;
  });
  await flush();
  assert.equal(settled, false);
  release();
  await stopped;
  assert.equal(state.attempts, 1);
});

test('shutdown stops retries after an in-flight serialization conflict', async () => {
  let stopped = false;
  let attempts = 0;
  const client = {
    $transaction: async () => {
      attempts++;
      stopped = true;
      throw { code: 'P2034' };
    },
  };
  assert.equal(
    await processReminderEvent(client, 1, now, () => stopped),
    'skipped',
  );
  assert.equal(attempts, 1);
});

test('fractional clocks keep threshold and expiry comparisons exact', async () => {
  for (const fraction of [499, 500, 999]) {
    const f = fixture();
    assert.equal(
      await processReminderEvent(
        f.client,
        1,
        () => new Date(+instant - fraction),
      ),
      'skipped',
    );
    assert.equal(
      await processReminderEvent(
        f.client,
        1,
        () => new Date(+instant + fraction),
      ),
      'reminded',
    );
    const expired = fixture({ due_date: instant });
    assert.equal(
      await processReminderEvent(
        expired.client,
        1,
        () => new Date(+instant + fraction),
      ),
      'overdue',
    );
  }
});
