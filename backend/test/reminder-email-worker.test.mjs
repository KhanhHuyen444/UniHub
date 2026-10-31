import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  MailFailure,
  MAIL_TIMEOUT_MS,
} from '../dist/modules/events/mail-transport.js';
import {
  freezeReminderEmail,
  readReminderEmailConfig,
} from '../dist/modules/events/reminder-email.js';
import { createPrismaEmailStore } from '../dist/modules/events/reminder-email.store.js';
import {
  IDEMPOTENCY_WINDOW_MS,
  RETRY_DELAYS_MS,
} from '../dist/modules/events/reminder-email-policy.js';
import {
  createReminderEmailWorker,
  createConfiguredReminderEmailWorker,
  EMAIL_POLL_INTERVAL_MS,
} from '../dist/modules/events/reminder-email.worker.js';

const instant = Date.parse('2026-11-01T00:00:00Z');
const config = readReminderEmailConfig({
  EVENT_REMINDER_EMAIL_ENABLED: 'true',
  EMAIL_FROM: 'sender@example.test',
  EMAIL_IDEMPOTENCY_NAMESPACE: 'test-lineage',
  APP_BASE_URL: 'https://unihub.example',
});
const inTransaction = new AsyncLocalStorage();
const flush = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

function row(id = 1, overrides = {}) {
  return {
    notification_id: id,
    ...freezeReminderEmail(
      config,
      {
        title: 'Original <title>',
        due_date: new Date(instant + 72 * 3_600_000),
      },
      'student@example.test',
      id,
    ),
    state: 'Pending',
    attempt_count: 0,
    next_attempt_at: new Date(instant),
    lease_token: null,
    lease_expires_at: null,
    first_attempt_at: null,
    provider_email_id: null,
    accepted_at: null,
    last_error_code: null,
    notification_type: 'Reminder',
    notification_user_id: 7,
    event_id: 5,
    event_user_id: 7,
    event_status: 'Upcoming',
    due_date: new Date(instant + 72 * 3_600_000),
    remind_before: 72,
    reminded_at: new Date(instant),
    user_id: 7,
    user_role: 'Student',
    recipient: 'student@example.test',
    ...overrides,
  };
}

// Fake SQL connection: executes the real store's statements and policy without
// opening a database. Serial transactions model atomic writes, not MySQL locks.
function database(initial = [row()]) {
  const f = {
    rows: new Map(initial.map((r) => [r.notification_id, structuredClone(r)])),
    now: instant,
    statements: [],
    failAcceptance: false,
    failNextCommit: false,
    loseNextCommitAck: false,
    skipNextWrite: false,
    beforeCommit: undefined,
    lockedRows: new Set(),
    beforeReadyLock: undefined,
  };
  let queue = Promise.resolve();
  const normalize = (first, values) =>
    Array.isArray(first)
      ? { sql: first.join('?'), values }
      : { sql: first.sql, values: first.values };
  const tx = {
    $queryRaw: async (first, ...values) => {
      assert.ok(inTransaction.getStore());
      const q = normalize(first, values);
      f.statements.push(q);
      if (q.sql.includes('SELECT r.*')) {
        const found = f.rows.get(q.values[0]);
        return found
          ? [{ ...structuredClone(found), db_now: new Date(f.now) }]
          : [];
      }
      if (q.sql.includes('SELECT notification_id, next_attempt_at')) {
        assert.doesNotMatch(q.sql, /FOR UPDATE/);
        const [afterTime, , afterId] = q.values;
        const candidates = [...f.rows.values()].filter(
          (r) =>
            ['Pending', 'Retry'].includes(r.state) &&
            +r.next_attempt_at <= f.now &&
            (afterTime === undefined ||
              +r.next_attempt_at > +afterTime ||
              (+r.next_attempt_at === +afterTime &&
                r.notification_id > afterId)),
        );
        candidates.sort(
          (a, b) =>
            +a.next_attempt_at - +b.next_attempt_at ||
            a.notification_id - b.notification_id,
        );
        return candidates
          .slice(0, 1)
          .map(({ notification_id, next_attempt_at }) => ({
            notification_id,
            next_attempt_at: new Date(next_attempt_at),
          }));
      }
      if (q.sql.includes('FORCE INDEX (PRIMARY)')) {
        assert.match(q.sql, /WHERE notification_id = \?/);
        assert.match(q.sql, /FOR UPDATE SKIP LOCKED/);
        assert.doesNotMatch(q.sql, /ORDER BY|JOIN/);
        await f.beforeReadyLock?.(q.values[0]);
        const found = f.rows.get(q.values[0]);
        return found &&
          !f.lockedRows.has(found.notification_id) &&
          ['Pending', 'Retry'].includes(found.state) &&
          +found.next_attempt_at <= f.now
          ? [{ notification_id: found.notification_id }]
          : [];
      }
      assert.match(q.sql, /FOR UPDATE/);
      if (q.sql.includes('WHERE notification_id =')) {
        const [id, token] = q.values;
        const found = f.rows.get(id);
        return found &&
          found.state === 'Processing' &&
          found.lease_token === token &&
          +found.lease_expires_at > f.now
          ? [{ notification_id: id }]
          : [];
      }
      assert.match(q.sql, /LIMIT 1 FOR UPDATE SKIP LOCKED/);
      const recovery = q.sql.includes('lease_expires_at <=');
      const candidates = [...f.rows.values()].filter((r) =>
        recovery
          ? r.state === 'Processing' && +r.lease_expires_at <= f.now
          : ['Pending', 'Retry'].includes(r.state) &&
            +r.next_attempt_at <= f.now,
      );
      candidates.sort(
        (a, b) =>
          (recovery
            ? +a.lease_expires_at - +b.lease_expires_at
            : +a.next_attempt_at - +b.next_attempt_at) ||
          a.notification_id - b.notification_id,
      );
      return candidates.length
        ? [{ notification_id: candidates[0].notification_id }]
        : [];
    },
    $executeRaw: async (first, ...values) => {
      assert.ok(inTransaction.getStore());
      const q = normalize(first, values);
      f.statements.push(q);
      if (f.skipNextWrite) {
        f.skipNextWrite = false;
        return 0;
      }
      if (q.sql.includes("SET state = 'Processing'")) {
        const [token, leaseSeconds, id, state, attempt, max] = q.values;
        const current = f.rows.get(id);
        if (
          !current ||
          current.state !== state ||
          current.attempt_count !== attempt ||
          attempt >= max ||
          current.lease_token !== null ||
          +current.next_attempt_at > f.now
        )
          return 0;
        assert.match(q.sql, /attempt_count = attempt_count \+ 1/);
        current.state = 'Processing';
        current.attempt_count++;
        current.first_attempt_at ??= new Date(Math.floor(f.now / 1000) * 1000);
        current.lease_token = token;
        current.lease_expires_at = new Date(
          Math.floor(f.now / 1000) * 1000 + leaseSeconds * 1000,
        );
        return 1;
      }
      if (q.sql.includes("SET state = 'Accepted'")) {
        if (f.failAcceptance) {
          f.failAcceptance = false;
          throw new Error('private DB failure');
        }
        const [providerId, id, token, attempt] = q.values;
        const current = f.rows.get(id);
        if (
          !current ||
          current.state !== 'Processing' ||
          current.lease_token !== token ||
          current.attempt_count !== attempt ||
          +current.lease_expires_at <= f.now
        )
          return 0;
        assert.match(q.sql, /lease_expires_at > UTC_TIMESTAMP\(3\)/);
        Object.assign(current, {
          state: 'Accepted',
          provider_email_id: providerId,
          accepted_at: new Date(f.now),
          lease_token: null,
          lease_expires_at: null,
          last_error_code: null,
        });
        return 1;
      }
      const [nextState, code, nextAt, id, previousState, attempt, token] =
        q.values;
      assert.match(q.sql, /lease_token <=> \?/);
      const current = f.rows.get(id);
      const expired = q.sql.includes('lease_expires_at <=');
      if (
        !current ||
        current.state !== previousState ||
        current.attempt_count !== attempt ||
        current.lease_token !== token
      )
        return 0;
      if (
        current.state === 'Processing' &&
        (expired
          ? +current.lease_expires_at > f.now
          : +current.lease_expires_at <= f.now)
      )
        return 0;
      Object.assign(current, {
        state: nextState,
        last_error_code: code,
        next_attempt_at: nextAt,
        lease_token: null,
        lease_expires_at: null,
      });
      return 1;
    },
  };
  const client = {
    $transaction(operation, options) {
      assert.equal(options.isolationLevel, 'ReadCommitted');
      assert.equal(options.maxWait, 5000);
      assert.equal(options.timeout, 5000);
      const result = queue.then(() =>
        inTransaction.run(true, async () => {
          const snapshot = structuredClone(f.rows);
          let result;
          try {
            result = await operation(tx);
            await f.beforeCommit?.();
            if (f.failNextCommit) {
              f.failNextCommit = false;
              throw new Error('private commit failure');
            }
          } catch (error) {
            f.rows = snapshot;
            throw error;
          }
          // Simulate a committed transaction whose acknowledgement was lost.
          if (f.loseNextCommitAck) {
            f.loseNextCommitAck = false;
            throw new Error('private lost commit acknowledgement');
          }
          return result;
        }),
      );
      queue = result.catch(() => {});
      return result;
    },
  };
  f.store = createPrismaEmailStore(client);
  return f;
}

function worker(f, send, overrides = {}) {
  let tick;
  let errors = 0;
  const calls = [];
  const logs = [];
  const timeoutCallbacks = new Set();
  const w = createReminderEmailWorker({
    enabled: true,
    getStore: () => f.store,
    monotonicNow: () => 0,
    transport: {
      send: async (...args) => {
        assert.ok(
          !inTransaction.getStore(),
          'provider call must be outside transaction',
        );
        calls.push(args);
        return send(...args);
      },
    },
    reportError: (...args) => {
      assert.deepEqual(args, []);
      errors++;
    },
    log: (event, diagnostic) => {
      assert.ok(!inTransaction.getStore(), 'diagnostics must be post-commit');
      assert.ok(Object.isFrozen(diagnostic));
      logs.push({ event, ...diagnostic });
    },
    setInterval: (callback, ms) => {
      assert.equal(ms, 5000);
      tick = callback;
      return { unref() {} };
    },
    clearInterval: () => {},
    setTimeout: (callback, ms) => {
      assert.equal(ms, MAIL_TIMEOUT_MS);
      timeoutCallbacks.add(callback);
      return callback;
    },
    clearTimeout: (callback) => timeoutCallbacks.delete(callback),
    ...overrides,
  });
  return {
    w,
    calls,
    logs,
    tick: () => tick(),
    errors: () => errors,
    timeout: () => {
      for (const callback of [...timeoutCallbacks]) callback();
    },
  };
}
const accepted = async () => ({ providerEmailId: 'provider-accepted-1' });

test('worker accepts one immutable request outside transactions and never resends Accepted', async () => {
  const f = database();
  const original = structuredClone(f.rows.get(1));
  const w = worker(f, accepted);
  w.w.start();
  await flush();
  const current = f.rows.get(1);
  assert.equal(current.state, 'Accepted');
  assert.equal(current.attempt_count, 1);
  assert.equal(current.provider_email_id, 'provider-accepted-1');
  assert.equal(current.lease_token, null);
  assert.equal(current.payload_json, original.payload_json);
  assert.equal(w.calls[0][0], original.payload_json);
  assert.equal(w.calls[0][1].idempotencyKey, original.idempotency_key);
  w.tick();
  await flush();
  await w.w.stop();
  assert.equal(w.calls.length, 1);
});

test('transient failures use each explicit backoff then stop after six claims', async () => {
  const f = database();
  const w = worker(f, async () => {
    throw new MailFailure('PROVIDER_UNAVAILABLE', true);
  });
  w.w.start();
  await flush();
  for (let attempt = 1; attempt <= 6; attempt++) {
    const current = f.rows.get(1);
    assert.equal(current.attempt_count, attempt);
    assert.equal(w.calls.length, attempt);
    if (attempt === 6) {
      assert.equal(current.state, 'Dead');
      assert.equal(current.last_error_code, 'ATTEMPTS_EXHAUSTED');
      break;
    }
    assert.equal(current.state, 'Retry');
    assert.equal(
      +current.next_attempt_at - f.now,
      RETRY_DELAYS_MS[attempt - 1],
    );
    w.tick();
    await flush();
    assert.equal(w.calls.length, attempt, 'backoff cannot be bypassed');
    f.now = +current.next_attempt_at;
    w.tick();
    await flush();
  }
  w.tick();
  await flush();
  await w.w.stop();
  assert.equal(w.calls.length, 6);
  for (const call of w.calls) {
    assert.equal(call[0], w.calls[0][0]);
    assert.equal(call[1].idempotencyKey, w.calls[0][1].idempotencyKey);
  }
});

test('permanent failure goes Dead; 429 respects Retry-After and its six-hour ceiling', async () => {
  for (const [failure, state, delay, code] of [
    [
      new MailFailure('PROVIDER_REJECTED', false),
      'Dead',
      undefined,
      'PROVIDER_REJECTED',
    ],
    [
      new MailFailure('IDEMPOTENCY_CONFLICT', false),
      'Dead',
      undefined,
      'IDEMPOTENCY_CONFLICT',
    ],
    [
      new MailFailure('RATE_LIMITED', true, 180_000),
      'Retry',
      180_000,
      'RATE_LIMITED',
    ],
    [
      new MailFailure('RATE_LIMITED', true, 21_600_000),
      'Retry',
      21_600_000,
      'RATE_LIMITED',
    ],
    [
      new MailFailure('RATE_LIMITED', true, 21_601_000),
      'Dead',
      undefined,
      'RETRY_AFTER_EXCEEDS_LIMIT',
    ],
  ]) {
    const f = database();
    const w = worker(f, async () => {
      throw failure;
    });
    w.w.start();
    await flush();
    await w.w.stop();
    const current = f.rows.get(1);
    assert.equal(current.state, state);
    assert.equal(current.last_error_code, code);
    if (delay) assert.equal(+current.next_attempt_at - f.now, delay);
  }
});

test('ten-second timeout is ambiguous; late provider success cannot overwrite Retry', async () => {
  const f = database();
  const pending = deferred();
  const w = worker(f, () => pending.promise);
  w.w.start();
  await flush();
  assert.equal(w.calls.length, 1);
  w.timeout();
  await flush();
  assert.equal(w.calls[0][1].signal.aborted, true);
  assert.equal(f.rows.get(1).state, 'Retry');
  pending.resolve({ providerEmailId: 'late-acceptance' });
  await flush();
  await w.w.stop();
  assert.equal(f.rows.get(1).state, 'Retry');
  assert.equal(f.rows.get(1).provider_email_id, null);
});

test('crash before sending consumes a claim; expiry recovers with fresh token and fencing', async () => {
  const f = database();
  const first = await f.store.claim();
  assert.match(first.leaseToken, /^[a-f0-9-]{36}$/);
  assert.equal(+f.rows.get(1).lease_expires_at - f.now, 60_000);
  f.now += 60_000;
  assert.equal(
    await f.store.settle(first, { accepted: true, providerEmailId: 'stale' }),
    false,
  );
  await f.store.recoverExpired();
  assert.equal(f.rows.get(1).state, 'Retry');
  assert.equal(f.rows.get(1).attempt_count, 1);
  assert.equal(+f.rows.get(1).next_attempt_at, f.now + 30_000);
  f.now += 30_000;
  const second = await f.store.claim();
  assert.notEqual(second.leaseToken, first.leaseToken);
  assert.equal(f.rows.get(1).attempt_count, 2);
  assert.equal(await f.store.preflight(first), null);
  assert.equal(
    await f.store.settle(first, {
      accepted: false,
      failure: new MailFailure('NETWORK_ERROR', true),
    }),
    false,
  );
  assert.equal(
    await f.store.settle(first, { accepted: true, providerEmailId: 'stale' }),
    false,
  );
  assert.equal(f.rows.get(1).lease_token, second.leaseToken);
});

test('ambiguous acceptance/DB failure is retried with exactly the same body/key', async () => {
  const f = database();
  f.failAcceptance = true;
  const provider = new Map();
  const w = worker(f, async (body, { idempotencyKey }) => {
    const prior = provider.get(idempotencyKey);
    if (prior) assert.equal(body, prior.body);
    else provider.set(idempotencyKey, { body, providerEmailId: randomUUID() });
    return { providerEmailId: provider.get(idempotencyKey).providerEmailId };
  });
  w.w.start();
  await flush();
  assert.equal(f.rows.get(1).state, 'Processing');
  f.now += 90_000;
  w.tick();
  await flush();
  await w.w.stop();
  assert.equal(w.calls.length, 2);
  assert.equal(provider.size, 1);
  assert.equal(f.rows.get(1).state, 'Accepted');
  assert.equal(f.rows.get(1).attempt_count, 2);
});

for (const [label, patch] of [
  ['Completed', { event_status: 'Completed' }],
  ['Overdue', { event_status: 'Overdue' }],
  ['expired deadline', { due_date: new Date(instant) }],
  ['zero reminder', { remind_before: 0 }],
  ['outside reminder window', { remind_before: 1 }],
  ['cleared reminded marker', { reminded_at: null }],
  ['owner mismatch', { event_user_id: 8 }],
  ['missing User', { user_id: null }],
  ['non-Student', { user_role: 'Admin' }],
  ['Violation', { notification_type: 'Violation' }],
  ['missing Event', { event_id: null }],
  ['recipient change', { recipient: 'other@example.test' }],
  ['invalid recipient', { recipient: 'a,b@example.test' }],
]) {
  test(`preflight cancels ${label} without sending`, async () => {
    const f = database();
    const claim = await f.store.claim();
    Object.assign(f.rows.get(1), patch);
    assert.equal(await f.store.preflight(claim), null);
    assert.equal(f.rows.get(1).state, 'Cancelled');
    const w = worker(f, accepted);
    w.w.start();
    await flush();
    await w.w.stop();
    assert.equal(w.calls.length, 0);
  });
}

test('title/notes changes preserve frozen request; deletion prevents send and resurrection', async () => {
  const f = database();
  const claim = await f.store.claim();
  const original = f.rows.get(1).payload_json;
  Object.assign(f.rows.get(1), { title: 'Changed', notes: 'Changed' });
  assert.equal((await f.store.preflight(claim)).payloadJson, original);
  f.rows.delete(1); // Model FK cascade, not proof of actual MySQL enforcement.
  assert.equal(await f.store.preflight(claim), null);
  assert.equal(
    await f.store.settle(claim, {
      accepted: true,
      providerEmailId: 'already-in-flight',
    }),
    false,
  );
  assert.equal(f.rows.size, 0);
});

test('retry/recovery stop at deadline, completion, attempt budget and 23-hour window', async () => {
  for (const [patch, state, code] of [
    [{ event_status: 'Completed' }, 'Cancelled', 'EVENT_INELIGIBLE'],
    [{ due_date: new Date(instant + 60_000) }, 'Cancelled', 'DEADLINE_PASSED'],
    [{ attempt_count: 6 }, 'Dead', 'ATTEMPTS_EXHAUSTED'],
    [
      { first_attempt_at: new Date(instant - IDEMPOTENCY_WINDOW_MS) },
      'Dead',
      'IDEMPOTENCY_WINDOW_EXPIRED',
    ],
  ]) {
    const f = database();
    await f.store.claim();
    Object.assign(f.rows.get(1), patch);
    f.now += 60_000;
    await f.store.recoverExpired();
    assert.equal(f.rows.get(1).state, state);
    assert.equal(f.rows.get(1).last_error_code, code);
  }
});

test('failed in-flight request cancels if eligibility changed; acceptance records provider outcome', async () => {
  for (const succeeded of [false, true]) {
    const f = database();
    const pending = deferred();
    const w = worker(f, () => pending.promise);
    w.w.start();
    await flush();
    f.rows.get(1).event_status = 'Completed';
    pending.resolve(
      succeeded
        ? { providerEmailId: 'accepted-before-completion' }
        : Promise.reject(new MailFailure('PROVIDER_UNAVAILABLE', true)),
    );
    await flush();
    await w.w.stop();
    assert.equal(f.rows.get(1).state, succeeded ? 'Accepted' : 'Cancelled');
    assert.equal(w.calls.length, 1);
  }
});

test('expired sixth claim cannot send and recovery does not refund its attempt', async () => {
  const f = database([
    row(1, {
      state: 'Retry',
      attempt_count: 5,
      first_attempt_at: new Date(instant),
    }),
  ]);
  const claim = await f.store.claim();
  assert.equal(f.rows.get(1).attempt_count, 6);
  f.now += 60_000;
  assert.equal(await f.store.preflight(claim), null);
  await f.store.recoverExpired();
  assert.equal(f.rows.get(1).state, 'Dead');
  assert.equal(f.rows.get(1).attempt_count, 6);
  assert.equal(await f.store.claim(), null);
});

test('namespace line terminators are rejected before constructing provider keys', () => {
  assert.throws(
    () =>
      readReminderEmailConfig({
        EVENT_REMINDER_EMAIL_ENABLED: 'true',
        EMAIL_FROM: 'sender@example.test',
        EMAIL_IDEMPOTENCY_NAMESPACE: 'test\n',
        APP_BASE_URL: 'https://unihub.example',
      }),
    /CONFIG_INVALID/,
  );
});

test('no request is started when timeout would cross deadline/window or lease', async () => {
  for (const patch of [
    { due_date: new Date(instant + MAIL_TIMEOUT_MS) },
    {
      first_attempt_at: new Date(
        instant - IDEMPOTENCY_WINDOW_MS + MAIL_TIMEOUT_MS,
      ),
      attempt_count: 1,
      state: 'Retry',
    },
  ]) {
    const f = database([row(1, patch)]);
    const w = worker(f, accepted);
    w.w.start();
    await flush();
    await w.w.stop();
    assert.equal(w.calls.length, 0);
    assert.ok(['Cancelled', 'Dead'].includes(f.rows.get(1).state));
  }
  const f = database();
  let reads = 0;
  const w = worker(f, accepted, {
    monotonicNow: () => (reads++ === 0 ? 0 : 60_000),
  });
  w.w.start();
  await flush();
  await w.w.stop();
  assert.equal(w.calls.length, 0);
});

test('invalid payload/key goes Dead without sending or mutating frozen fields', async () => {
  for (const patch of [
    { payload_json: '{}' },
    { payload_json: 'not JSON' },
    { idempotency_key: 'unihub/test/event-reminder/999' },
    { idempotency_key: 'unihub/test/event-reminder/1\n' },
  ]) {
    const f = database([row(1, patch)]);
    const w = worker(f, accepted);
    w.w.start();
    await flush();
    await w.w.stop();
    assert.equal(w.calls.length, 0);
    assert.equal(f.rows.get(1).state, 'Dead');
    for (const [key, value] of Object.entries(patch))
      assert.equal(f.rows.get(1)[key], value);
  }
});

test('concurrent workers claim distinct jobs; each instance keeps two send slots', async () => {
  const f = database(Array.from({ length: 8 }, (_, index) => row(index + 1)));
  const gates = [];
  const send = () => {
    const d = deferred();
    gates.push(d);
    return d.promise;
  };
  const one = worker(f, send);
  const two = worker(f, send);
  one.w.start();
  two.w.start();
  await flush();
  assert.equal(one.calls.length, 2);
  assert.equal(two.calls.length, 2);
  const keys = [...one.calls, ...two.calls].map(
    (call) => call[1].idempotencyKey,
  );
  assert.equal(new Set(keys).size, 4);
  one.tick();
  two.tick();
  await flush();
  assert.equal(one.calls.length + two.calls.length, 4);
  for (const d of gates) d.resolve({ providerEmailId: 'accepted' });
  await flush();
  await Promise.all([one.w.stop(), two.w.stop()]);
  assert.equal(
    [...f.rows.values()].filter((r) => r.state === 'Accepted').length,
    4,
  );
  assert.ok(f.statements.some((q) => /FOR UPDATE SKIP LOCKED/.test(q.sql)));
});

test('disabled mode has no database/transport/timer access; shutdown aborts and drains', async () => {
  const disabled = createReminderEmailWorker({
    enabled: false,
    getStore: () => {
      throw new Error('must not access DB');
    },
    setInterval: () => {
      throw new Error('must not start timer');
    },
  });
  disabled.start();
  await disabled.stop();
  const configured = createConfiguredReminderEmailWorker({
    EVENT_REMINDER_EMAIL_ENABLED: 'false',
  });
  configured.start();
  await configured.stop();
  assert.throws(
    () =>
      createConfiguredReminderEmailWorker({
        EVENT_REMINDER_EMAIL_ENABLED: 'true',
        EMAIL_FROM: 'sender@example.test',
        EMAIL_IDEMPOTENCY_NAMESPACE: 'test',
        APP_BASE_URL: 'https://unihub.example',
      }),
    /PROVIDER_CONFIG_INVALID/,
  );
  assert.throws(
    () =>
      createConfiguredReminderEmailWorker({
        EVENT_REMINDER_EMAIL_ENABLED: 'true',
        EMAIL_PROVIDER: 'gmail-smtp',
        EMAIL_FROM: 'sender@example.test',
        EMAIL_IDEMPOTENCY_NAMESPACE: 'test',
        APP_BASE_URL: 'https://unihub.example',
      }),
    /PROVIDER_CONFIG_INVALID/,
  );
  const gmailConfigured = createConfiguredReminderEmailWorker({
    EVENT_REMINDER_EMAIL_ENABLED: 'true',
    EMAIL_PROVIDER: 'gmail-smtp',
    EMAIL_FROM: 'sender@example.test',
    EMAIL_IDEMPOTENCY_NAMESPACE: 'test',
    APP_BASE_URL: 'https://unihub.example',
    GMAIL_APP_PASSWORD: 'abcdefghijklmnop',
  });
  assert.ok(gmailConfigured);
  const f = database();
  const w = worker(f, () => new Promise(() => {}));
  w.w.start();
  await flush();
  await w.w.stop();
  assert.equal(w.calls[0][1].signal.aborted, true);
  assert.equal(f.rows.get(1).state, 'Retry');
  w.tick();
  w.w.start();
  await flush();
  assert.equal(w.calls.length, 1);
  assert.equal(EMAIL_POLL_INTERVAL_MS, 5000);
});

test('structured logs identify the committed claim/acceptance, excluding provider IDs', async () => {
  const f = database();
  const w = worker(f, async () => ({
    providerEmailId: 'private-provider-reference',
  }));
  w.w.start();
  await flush();
  await w.w.stop();
  assert.deepEqual(w.logs, [
    {
      event: 'claim',
      notification_id: 1,
      attempt_count: 1,
      state: 'Processing',
      error_code: null,
    },
    {
      event: 'provider_acceptance',
      notification_id: 1,
      attempt_count: 1,
      state: null,
      error_code: null,
    },
    {
      event: 'accepted',
      notification_id: 1,
      attempt_count: 1,
      state: 'Accepted',
      error_code: null,
    },
  ]);
  const serialized = JSON.stringify(w.logs);
  for (const forbidden of [
    'sender@example.test',
    'student@example.test',
    'Original',
    'Frozen',
    'unihub/test-lineage',
    'private-provider-reference',
  ]) {
    assert.ok(!serialized.includes(forbidden));
  }
});

test('retry/cancellation/permanent-failure logs report the actual committed decision', async () => {
  for (const [patch, failure, event, state, code, count] of [
    [
      {},
      new MailFailure('PROVIDER_UNAVAILABLE', true),
      'retry',
      'Retry',
      'PROVIDER_UNAVAILABLE',
      1,
    ],
    [
      {},
      new MailFailure('PROVIDER_REJECTED', false),
      'permanent_failure',
      'Dead',
      'PROVIDER_REJECTED',
      1,
    ],
    [
      { recipient: 'changed@example.test' },
      null,
      'cancellation',
      'Cancelled',
      'RECIPIENT_CHANGED',
      0,
    ],
  ]) {
    const f = database([row(1, patch)]);
    const w = worker(f, async () => {
      throw failure;
    });
    w.w.start();
    await flush();
    await w.w.stop();
    const diagnostic = w.logs.find((log) => log.event === event);
    assert.deepEqual(diagnostic, {
      event,
      notification_id: 1,
      attempt_count: count,
      state,
      error_code: code,
    });
    assert.equal(f.rows.get(1).state, state);
    assert.equal(f.rows.get(1).attempt_count, count);
  }
});

test('lease recovery reports its committed attempt separately from the next claim', async () => {
  const f = database();
  await f.store.claim();
  f.now += 90_000;
  const w = worker(f, accepted);
  w.w.start();
  await flush();
  await w.w.stop();
  assert.deepEqual(
    w.logs.find((log) => log.event === 'lease_recovery'),
    {
      event: 'lease_recovery',
      notification_id: 1,
      attempt_count: 1,
      state: 'Retry',
      error_code: 'REQUEST_TIMEOUT',
    },
  );
  assert.equal(w.logs.find((log) => log.event === 'claim').attempt_count, 2);
  assert.equal(w.logs.find((log) => log.event === 'accepted').attempt_count, 2);
});

test('store diagnostics wait for commit and expose exactly four safe fields', async () => {
  const f = database();
  const beforeCommit = deferred();
  const release = deferred();
  const diagnostics = [];
  f.beforeCommit = async () => {
    beforeCommit.resolve();
    await release.promise;
  };
  const pending = f.store.claim((operation, diagnostic) => {
    assert.ok(!inTransaction.getStore());
    assert.ok(Object.isFrozen(diagnostic));
    diagnostics.push({ operation, ...diagnostic });
  });
  await beforeCommit.promise;
  assert.deepEqual(diagnostics, []);
  release.resolve();
  await pending;
  assert.deepEqual(diagnostics, [
    {
      operation: 'claim',
      notification_id: 1,
      attempt_count: 1,
      state: 'Processing',
      error_code: null,
    },
  ]);
});

test('rejected or ambiguous claim commits publish no committed diagnostic', async () => {
  for (const flag of ['failNextCommit', 'loseNextCommitAck']) {
    const f = database();
    const diagnostics = [];
    f[flag] = true;
    await assert.rejects(f.store.claim((...args) => diagnostics.push(args)));
    assert.deepEqual(diagnostics, []);
    assert.equal(
      f.rows.get(1).state,
      flag === 'failNextCommit' ? 'Pending' : 'Processing',
    );
  }
});

test('zero-row writes and lost fences never publish successful transitions', async () => {
  const f = database();
  const diagnostics = [];
  const observe = (...args) => diagnostics.push(args);
  f.skipNextWrite = true;
  assert.equal(await f.store.claim(observe), null);
  assert.deepEqual(diagnostics, []);
  const claim = await f.store.claim();
  f.skipNextWrite = true;
  assert.equal(
    await f.store.settle(
      claim,
      { accepted: true, providerEmailId: 'valid-id' },
      observe,
    ),
    false,
  );
  assert.deepEqual(diagnostics, []);
  f.rows.get(1).lease_token = randomUUID();
  assert.equal(await f.store.preflight(claim, observe), null);
  assert.equal(
    await f.store.settle(
      claim,
      { accepted: false, failure: new MailFailure('NETWORK_ERROR', true) },
      observe,
    ),
    false,
  );
  assert.deepEqual(diagnostics, []);
});

test('partial lease recovery logs only individually acknowledged commits', async () => {
  const processing = {
    state: 'Processing',
    attempt_count: 1,
    first_attempt_at: new Date(instant),
    lease_token: randomUUID(),
    lease_expires_at: new Date(instant + 60_000),
  };
  const f = database([
    row(1, processing),
    row(2, { ...processing, lease_token: randomUUID() }),
  ]);
  f.now += 90_000;
  let commits = 0;
  f.beforeCommit = () => {
    if (++commits === 2) f.failNextCommit = true;
  };
  const diagnostics = [];
  await assert.rejects(
    f.store.recoverExpired((operation, diagnostic) =>
      diagnostics.push({ operation, ...diagnostic }),
    ),
  );
  assert.deepEqual(diagnostics, [
    {
      operation: 'lease_recovery',
      notification_id: 1,
      attempt_count: 1,
      state: 'Retry',
      error_code: 'REQUEST_TIMEOUT',
    },
  ]);
  assert.equal(f.rows.get(2).state, 'Processing');
});

test('provider acceptance plus uncertain settlement never claims committed Accepted', async () => {
  for (const lostAck of [false, true]) {
    const f = database();
    const w = worker(f, async () => {
      if (lostAck) f.loseNextCommitAck = true;
      else f.failAcceptance = true;
      return { providerEmailId: 'private-provider-reference' };
    });
    w.w.start();
    await flush();
    await w.w.stop();
    assert.equal(
      w.logs.filter((log) => log.event === 'provider_acceptance').length,
      1,
    );
    assert.equal(w.logs.filter((log) => log.event === 'accepted').length, 0);
    assert.deepEqual(
      w.logs.find((log) => log.event === 'settlement_failure'),
      {
        event: 'settlement_failure',
        notification_id: 1,
        attempt_count: 1,
        state: null,
        error_code: 'SETTLEMENT_FAILED',
      },
    );
    assert.equal(f.rows.get(1).state, lostAck ? 'Accepted' : 'Processing');
    assert.ok(!JSON.stringify(w.logs).includes('private'));
  }
});

test('deleted in-flight job reports unsuccessful settlement without inferred cancellation', async () => {
  const f = database();
  const pending = deferred();
  const w = worker(f, () => pending.promise);
  w.w.start();
  await flush();
  f.rows.delete(1);
  pending.resolve({ providerEmailId: 'valid-id' });
  await flush();
  await w.w.stop();
  assert.deepEqual(
    w.logs.find((log) => log.event === 'settlement_failure'),
    {
      event: 'settlement_failure',
      notification_id: 1,
      attempt_count: 1,
      state: null,
      error_code: 'SETTLEMENT_NOT_APPLIED',
    },
  );
  assert.ok(
    !w.logs.some((log) =>
      ['cancellation', 'accepted', 'lease_recovery'].includes(log.event),
    ),
  );
});

test('null preflight from deletion or fencing is not logged as cancellation', async () => {
  for (const deleted of [false, true]) {
    const f = database();
    const preflight = f.store.preflight;
    f.store.preflight = (claim, observe) => {
      if (deleted) f.rows.delete(1);
      else f.rows.get(1).lease_token = randomUUID();
      return preflight(claim, observe);
    };
    const w = worker(f, accepted);
    w.w.start();
    await flush();
    await w.w.stop();
    assert.deepEqual(
      w.logs.map((log) => log.event),
      ['claim'],
    );
    assert.equal(w.calls.length, 0);
  }
});

test('unknown error codes and extra metadata cannot leak PII or secrets', async () => {
  const sensitive = 'private-student@example.test private-API-key';
  const f = database();
  const w = worker(f, async () => {
    throw new MailFailure(sensitive, false);
  });
  w.w.start();
  await flush();
  await w.w.stop();
  assert.equal(
    w.logs.find((log) => log.event === 'send_failure').error_code,
    'UNKNOWN_FAILURE',
  );
  assert.equal(
    w.logs.find((log) => log.event === 'permanent_failure').error_code,
    'UNKNOWN_FAILURE',
  );
  const bad = worker(database([]), accepted, {
    getStore: () => ({
      recoverExpired: async () => {},
      claim: async (observe) => {
        observe('claim', {
          notification_id: sensitive,
          attempt_count: sensitive,
          state: 'Dead',
          error_code: sensitive,
          payload_json: sensitive,
          idempotency_key: sensitive,
        });
        return null;
      },
    }),
  });
  bad.w.start();
  await flush();
  await bad.w.stop();
  for (const log of [...w.logs, ...bad.logs]) {
    assert.deepEqual(Object.keys(log).sort(), [
      'attempt_count',
      'error_code',
      'event',
      'notification_id',
      'state',
    ]);
    assert.ok(!JSON.stringify(log).includes('private'));
  }
  assert.ok(
    bad.logs.every(
      (log) =>
        log.notification_id === null &&
        log.attempt_count === null &&
        log.error_code === 'UNKNOWN_FAILURE',
    ),
  );
});

test('empty polling is silent and logger exceptions do not alter worker outcomes', async () => {
  const empty = worker(database([]), accepted);
  empty.w.start();
  await flush();
  empty.tick();
  await flush();
  empty.tick();
  await flush();
  await empty.w.stop();
  assert.deepEqual(empty.logs, []);
  assert.equal(empty.errors(), 0);
  const f = database();
  const w = worker(f, accepted, {
    log: () => {
      throw new Error('private logger failure');
    },
  });
  w.w.start();
  await flush();
  await w.w.stop();
  assert.equal(f.rows.get(1).state, 'Accepted');
  assert.equal(f.rows.get(1).attempt_count, 1);
  assert.equal(w.calls.length, 1);
});

test('default logger follows console conventions and emits only projected fields', async (t) => {
  const output = [];
  t.mock.method(console, 'info', (...args) => output.push(args));
  t.mock.method(console, 'error', (...args) => output.push(args));
  const f = database();
  const w = worker(
    f,
    async () => {
      throw new Error('private API-key student@example.test');
    },
    { log: undefined },
  );
  w.w.start();
  await flush();
  await w.w.stop();
  assert.ok(output.length > 0);
  for (const [event, diagnostic] of output) {
    assert.match(event, /^event_reminder_email\.[a-z_]+$/);
    assert.deepEqual(Object.keys(diagnostic).sort(), [
      'attempt_count',
      'error_code',
      'notification_id',
      'state',
    ]);
    assert.ok(!JSON.stringify([event, diagnostic]).includes('private'));
    assert.ok(!JSON.stringify(diagnostic).includes('@'));
  }
});

test('claim discovery never locks sorting candidates; only the chosen primary key is locked', async () => {
  const f = database([row(1), row(2)]);
  assert.equal((await f.store.claim()).notificationId, 1);
  const selects = f.statements.filter((q) => /SELECT/.test(q.sql));
  assert.doesNotMatch(selects[0].sql, /FOR UPDATE/);
  assert.match(
    selects[0].sql,
    /ORDER BY next_attempt_at, notification_id LIMIT 1/,
  );
  assert.match(selects[1].sql, /FORCE INDEX \(PRIMARY\)/);
  assert.deepEqual(selects[1].values, [1]);
  assert.equal(f.rows.get(2).state, 'Pending');
});

test('claim traverses a locked prefix without an arbitrary candidate cutoff', async () => {
  const f = database(Array.from({ length: 102 }, (_, i) => row(i + 1)));
  for (let id = 1; id <= 101; id++) f.lockedRows.add(id);
  assert.equal((await f.store.claim()).notificationId, 102);
  assert.equal(f.rows.get(1).state, 'Pending');
  f.lockedRows.add(102);
  assert.equal(await f.store.claim(), null);
});

test('claim revalidates deleted, rescheduled and already claimed candidates under the primary-key lock', async () => {
  for (const change of ['delete', 'future', 'claimed']) {
    const f = database([row(1), row(2)]);
    f.beforeReadyLock = async (id) => {
      if (id !== 1) return;
      if (change === 'delete') f.rows.delete(id);
      else if (change === 'future')
        f.rows.get(id).next_attempt_at = new Date(f.now + 1000);
      else f.rows.get(id).state = 'Processing';
    };
    assert.equal((await f.store.claim()).notificationId, 2);
  }
});

test('claim keeps global due-time priority across Pending and Retry with ID tie-breaking', async () => {
  const retry = {
    state: 'Retry',
    attempt_count: 1,
    first_attempt_at: new Date(instant - 60000),
  };
  const f = database([
    row(1, { next_attempt_at: new Date(instant) }),
    row(3, { ...retry, next_attempt_at: new Date(instant - 1000) }),
    row(2, { ...retry, next_attempt_at: new Date(instant - 1000) }),
  ]);
  assert.equal((await f.store.claim()).notificationId, 2);
  assert.equal((await f.store.claim()).notificationId, 3);
  assert.equal((await f.store.claim()).notificationId, 1);
});
