import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createPrismaClient } from '../dist/lib/prisma.js';
import {
  processReminderEvent,
  runDeadlineReminders,
  REMINDER_BATCH_SIZE,
} from '../dist/modules/events/reminders.service.js';
import {
  patchEvent,
  patchEventStatus,
  deleteEvent,
} from '../dist/modules/events/events.service.js';

// Explicit opt-in only. Never fall back to DATABASE_URL or load .env files.
const databaseUrl = process.env.TEST_REMINDERS_DATABASE_URL;
function assertIsolatedDatabase(value) {
  const url = new URL(value);
  assert.equal(url.protocol, 'mysql:');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  assert.match(
    decodeURIComponent(url.pathname.slice(1)),
    /^unihub_reminders_test(?:_[a-zA-Z0-9]+)?$/,
  );
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
async function bounded(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Transaction synchronization timed out')),
          3000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Hold the first transaction after its writes, before COMMIT. Start the second
// transaction's actual event read while those locks remain held, then release.
async function orderedTransactions(prisma, firstOperation, secondOperation) {
  const held = deferred();
  const release = deferred();
  const reading = deferred();
  let holdOnce = true;
  const firstClient = {
    $transaction: (operation, options) =>
      prisma.$transaction(async (tx) => {
        const result = await operation(tx);
        if (holdOnce) {
          holdOnce = false;
          held.resolve();
          await bounded(release.promise);
        }
        return result;
      }, options),
  };
  const secondClient = {
    $transaction: (operation, options) =>
      prisma.$transaction(
        (tx) =>
          operation(
            new Proxy(tx, {
              get(target, key) {
                if (key !== 'event') return Reflect.get(target, key);
                return new Proxy(tx.event, {
                  get(delegate, method) {
                    const original = Reflect.get(delegate, method);
                    if (method !== 'findUnique' && method !== 'findFirst')
                      return original;
                    return (...args) => {
                      const result = original.apply(delegate, args);
                      // PrismaPromise is lazy: .then starts the query before signaling.
                      const started = Promise.resolve(result);
                      started.catch(() => {});
                      queueMicrotask(() => reading.resolve());
                      return started;
                    };
                  },
                });
              },
            }),
          ),
        options,
      ),
  };
  const first = firstOperation(firstClient);
  first.catch(() => {});
  let second;
  try {
    await bounded(held.promise);
    second = secondOperation(secondClient);
    second.catch(() => {});
    await bounded(reading.promise);
    release.resolve();
    await Promise.all([first, second]);
  } finally {
    release.resolve();
    await Promise.allSettled([first, second]);
  }
}

test(
  'MySQL reminder transactions and concurrent Calendar mutations',
  {
    skip: !databaseUrl && 'No isolated TEST_REMINDERS_DATABASE_URL configured.',
  },
  async (t) => {
    assertIsolatedDatabase(databaseUrl);
    const prisma = createPrismaClient(databaseUrl);
    let userId;
    const now = () => new Date('2026-11-01T00:00:00Z');
    const due = new Date('2026-11-01T01:00:00Z');
    async function create(data = {}) {
      return prisma.event.create({
        data: {
          user_id: userId,
          title: 'Reminder integration',
          due_date: due,
          remind_before: 1,
          ...data,
        },
      });
    }
    const count = (id) =>
      prisma.notification.count({ where: { event_id: id, type: 'Reminder' } });
    try {
      const user = await prisma.user.create({
        data: {
          email: `reminder-${randomUUID()}@test.invalid`,
          full_name: 'Reminder Test',
          role: 'Student',
        },
      });
      userId = user.user_id;

      for (const mutation of [
        'dueDate',
        'remindBefore',
        'Completed',
        'DELETE',
      ]) {
        for (const workerFirst of [true, false]) {
          await t.test(
            `ordered race: ${mutation}, ${workerFirst ? 'worker' : 'mutation'} commits first`,
            async () => {
              const e = await create();
              const worker = (client) =>
                processReminderEvent(client, e.event_id, now);
              const mutate = (client) => {
                if (mutation === 'Completed')
                  return patchEventStatus(client, userId, String(e.event_id), {
                    status: 'Completed',
                  });
                if (mutation === 'DELETE')
                  return deleteEvent(client, userId, String(e.event_id));
                return patchEvent(
                  client,
                  userId,
                  String(e.event_id),
                  mutation === 'dueDate'
                    ? { dueDate: '2026-11-02T01:00:00Z' }
                    : { remindBefore: 0 },
                  now(),
                );
              };
              await orderedTransactions(
                prisma,
                workerFirst ? worker : mutate,
                workerFirst ? mutate : worker,
              );
              const row = await prisma.event.findUnique({
                where: { event_id: e.event_id },
              });
              const expectedCount =
                mutation === 'Completed' && workerFirst ? 1 : 0;
              assert.equal(await count(e.event_id), expectedCount);
              if (mutation === 'DELETE') assert.equal(row, null);
              else if (mutation === 'Completed')
                assert.equal(row.status, 'Completed');
              else {
                assert.equal(row.reminded_at, null);
                if (mutation === 'dueDate')
                  assert.equal(
                    row.due_date.toISOString(),
                    '2026-11-02T01:00:00.000Z',
                  );
                else assert.equal(row.remind_before, 0);
              }
              await processReminderEvent(prisma, e.event_id, now);
              assert.equal(await count(e.event_id), expectedCount);
            },
          );
        }
      }

      await t.test(
        'fractional clock boundaries, persisted DATETIME(0), idempotency',
        async () => {
          for (const fraction of [499, 500, 999]) {
            const e = await create();
            const clock = () => new Date(now().getTime() + fraction);
            await processReminderEvent(prisma, e.event_id, clock);
            const persisted = await prisma.event.findUnique({
              where: { event_id: e.event_id },
            });
            assert.ok(persisted.reminded_at instanceof Date);
            assert.equal(persisted.reminded_at.getUTCMilliseconds(), 0);
            assert.ok(
              Math.abs(persisted.reminded_at.getTime() - clock().getTime()) <
                1000,
            );
            await processReminderEvent(prisma, e.event_id, clock);
            assert.equal(await count(e.event_id), 1);

            const boundary = await create();
            // 1 ms outside the one-hour window, followed by exact threshold.
            const before = () => new Date(now().getTime() - 1);
            const scanBoundary = (clock) =>
              runDeadlineReminders(
                {
                  $queryRaw: async (...args) => {
                    const rows = await prisma.$queryRaw(...args);
                    return rows[0] && 'max_id' in rows[0]
                      ? rows
                      : rows.filter((r) => r.event_id === boundary.event_id);
                  },
                  $transaction: prisma.$transaction.bind(prisma),
                },
                { now: clock },
              );
            await scanBoundary(before);
            assert.equal(await count(boundary.event_id), 0);
            assert.equal(
              await processReminderEvent(prisma, boundary.event_id, before),
              'skipped',
            );
            await scanBoundary(now);
            assert.equal(await count(boundary.event_id), 1);
            assert.equal(
              await processReminderEvent(prisma, boundary.event_id, now),
              'skipped',
            );
            const expired = await create();
            assert.equal(
              await processReminderEvent(
                prisma,
                expired.event_id,
                () => new Date(due.getTime() + fraction),
              ),
              'overdue',
            );
            assert.equal(await count(expired.event_id), 0);
          }
        },
      );

      await t.test(
        'SQL candidate filtering, deadline order, batch limit and changed deadlines',
        async () => {
          // Scope the raw query to IDs selected from this isolated fixture by
          // deleting only this test user's prior events before exercising scans.
          await prisma.event.deleteMany({ where: { user_id: userId } });
          const late = await create({
            due_date: new Date('2026-11-01T00:50:00Z'),
          });
          const early = await create({
            due_date: new Date('2026-11-01T00:10:00Z'),
          });
          await create({ due_date: new Date('2026-11-03T00:00:00Z') });
          await create({ reminded_at: now() });
          await create({ status: 'Completed' });
          await create({ status: 'Overdue' });
          const expired = await create({ due_date: now(), reminded_at: now() });
          const selected = [];
          const scoped = {
            $queryRaw: async (...args) => {
              const rows = await prisma.$queryRaw(...args);
              if (rows[0] && 'max_id' in rows[0]) return rows;
              const owned = await prisma.event.findMany({
                where: { user_id: userId },
                select: { event_id: true },
              });
              const ids = new Set(owned.map((r) => r.event_id));
              const ownRows = rows.filter((r) => ids.has(r.event_id));
              selected.push(...ownRows.map((r) => r.event_id));
              return ownRows;
            },
            $transaction: prisma.$transaction.bind(prisma),
          };
          await runDeadlineReminders(scoped, { now });
          assert.deepEqual(selected, [
            expired.event_id,
            early.event_id,
            late.event_id,
          ]);
          // Move a previously excluded event earlier; next tick must reconsider it.
          const moved = await create({
            due_date: new Date('2026-11-03T00:00:00Z'),
          });
          await patchEvent(
            prisma,
            userId,
            String(moved.event_id),
            { dueDate: '2026-11-01T00:05:00Z' },
            now(),
          );
          await runDeadlineReminders(scoped, { now });
          assert.equal(await count(moved.event_id), 1);
          await prisma.event.createMany({
            data: Array.from({ length: REMINDER_BATCH_SIZE + 1 }, () => ({
              user_id: userId,
              title: 'Batch',
              due_date: due,
              remind_before: 1,
            })),
          });
          selected.length = 0;
          await runDeadlineReminders(scoped, { now });
          assert.equal(selected.length, REMINDER_BATCH_SIZE);
          selected.length = 0;
          await runDeadlineReminders(scoped, { now });
          assert.equal(selected.length, 1);
        },
      );

      await t.test(
        'scan resumes past persistent failures, removes successful rows and wraps to retry',
        async () => {
          await prisma.event.deleteMany({ where: { user_id: userId } });
          const poisoned = await Promise.all([create(), create(), create()]);
          const failing = new Set(poisoned.map((e) => e.event_id));
          const healthy = await create();
          const expired = await create({ due_date: now() });
          const selected = [];
          const scanState = {};
          const scoped = {
            $queryRaw: async (...args) => {
              const rows = await prisma.$queryRaw(...args);
              if (rows[0] && 'max_id' in rows[0]) return rows;
              const owned = await prisma.event.findMany({
                where: { user_id: userId },
                select: { event_id: true },
              });
              const ids = new Set(owned.map((e) => e.event_id));
              const result = rows.filter((e) => ids.has(e.event_id));
              selected.push(result.map((e) => e.event_id));
              return result;
            },
            $transaction: (operation, options) =>
              prisma.$transaction(
                (tx) =>
                  operation({
                    event: {
                      findUnique: (args) => {
                        if (failing.has(args.where.event_id))
                          throw new Error('Injected persistent row failure');
                        return tx.event.findUnique(args);
                      },
                      updateMany: (args) => tx.event.updateMany(args),
                    },
                    notification: tx.notification,
                  }),
                options,
              ),
          };
          await runDeadlineReminders(scoped, { now, scanState });
          assert.equal(await count(healthy.event_id), 0);
          assert.equal(
            (
              await prisma.event.findUnique({
                where: { event_id: expired.event_id },
              })
            ).status,
            'Overdue',
          );
          await runDeadlineReminders(scoped, { now, scanState });
          assert.deepEqual(selected[1], [healthy.event_id]);
          assert.equal(await count(healthy.event_id), 1);
          failing.clear();
          await runDeadlineReminders(scoped, { now, scanState });
          assert.deepEqual(
            new Set(selected[2]),
            new Set(poisoned.map((e) => e.event_id)),
          );
          for (const e of poisoned) assert.equal(await count(e.event_id), 1);
          await runDeadlineReminders(scoped, { now, scanState });
          assert.deepEqual(selected[3], []);
        },
      );

      await t.test(
        'two workers and repeated processing create exactly one row',
        async () => {
          const e = await create();
          // Force both transactions to read the same unclaimed event before
          // either attempts its write. Retries bypass the barrier.
          let reads = 0;
          let release;
          const bothRead = new Promise((resolve) => {
            release = resolve;
          });
          const overlapping = {
            $transaction: (operation, options) =>
              prisma.$transaction(
                (tx) =>
                  operation({
                    event: {
                      findUnique: async (args) => {
                        const row = await tx.event.findUnique(args);
                        if (++reads <= 2) {
                          if (reads === 2) release();
                          await bothRead;
                        }
                        return row;
                      },
                      updateMany: (args) => tx.event.updateMany(args),
                    },
                    notification: tx.notification,
                  }),
                options,
              ),
          };
          await Promise.all([
            processReminderEvent(overlapping, e.event_id, now),
            processReminderEvent(overlapping, e.event_id, now),
          ]);
          await processReminderEvent(prisma, e.event_id, now);
          assert.equal(await count(e.event_id), 1);
          const row = await prisma.notification.findFirst({
            where: { event_id: e.event_id },
          });
          assert.equal(row.user_id, userId);
          assert.equal(row.is_read, false);
        },
      );

      await t.test(
        'insert failure rolls back claim; retry succeeds',
        async () => {
          const e = await create();
          const failing = {
            $transaction: (operation, options) =>
              prisma.$transaction(
                (tx) =>
                  operation({
                    event: tx.event,
                    notification: {
                      create: async () => {
                        throw new Error('Injected insert failure');
                      },
                    },
                  }),
                options,
              ),
          };
          await assert.rejects(
            processReminderEvent(failing, e.event_id, now),
            /Injected/,
          );
          assert.equal(
            (await prisma.event.findUnique({ where: { event_id: e.event_id } }))
              .reminded_at,
            null,
          );
          assert.equal(await count(e.event_id), 0);
          await processReminderEvent(prisma, e.event_id, now);
          assert.equal(await count(e.event_id), 1);
        },
      );

      await t.test(
        'deadline and lead-time edits race with a worker without stale reminders',
        async () => {
          for (const patch of [
            { dueDate: '2026-11-02T01:00:00Z' },
            { remindBefore: 0 },
          ]) {
            const e = await create();
            await Promise.all([
              processReminderEvent(prisma, e.event_id, now),
              patchEvent(prisma, userId, String(e.event_id), patch, now()),
            ]);
            const updated = await prisma.event.findUnique({
              where: { event_id: e.event_id },
            });
            assert.equal(updated.reminded_at, null);
            assert.equal(await count(e.event_id), 0);
          }
        },
      );

      await t.test(
        'changed deadline can produce one new reminder; no-op preserves it',
        async () => {
          const e = await create();
          await processReminderEvent(prisma, e.event_id, now);
          await patchEvent(
            prisma,
            userId,
            String(e.event_id),
            { dueDate: '2026-11-01T00:30:00Z' },
            now(),
          );
          assert.equal(await count(e.event_id), 0);
          await processReminderEvent(prisma, e.event_id, now);
          await patchEvent(
            prisma,
            userId,
            String(e.event_id),
            { dueDate: '2026-11-01T00:30:00Z', notes: 'Changed' },
            now(),
          );
          await processReminderEvent(prisma, e.event_id, now);
          assert.equal(await count(e.event_id), 1);
        },
      );

      await t.test(
        'completion race preserves Completed; subsequent processing does not notify',
        async () => {
          const e = await create();
          await Promise.all([
            processReminderEvent(prisma, e.event_id, now),
            patchEventStatus(prisma, userId, String(e.event_id), {
              status: 'Completed',
            }),
          ]);
          const before = await count(e.event_id);
          assert.ok(before <= 1); // Reminder may commit before completion, as allowed.
          await processReminderEvent(prisma, e.event_id, now);
          assert.equal(await count(e.event_id), before);
          assert.equal(
            (await prisma.event.findUnique({ where: { event_id: e.event_id } }))
              .status,
            'Completed',
          );
        },
      );

      await t.test('deletion race leaves no orphan notification', async () => {
        const e = await create();
        await Promise.all([
          processReminderEvent(prisma, e.event_id, now),
          deleteEvent(prisma, userId, String(e.event_id)),
        ]);
        assert.equal(await count(e.event_id), 0);
        assert.equal(
          await processReminderEvent(prisma, e.event_id, now),
          'skipped',
        );
      });

      await t.test(
        'expired events transition without notification, including completion race',
        async () => {
          const e = await create({ due_date: now() });
          assert.equal(
            await processReminderEvent(prisma, e.event_id, now),
            'overdue',
          );
          assert.equal(await count(e.event_id), 0);
          const other = await create({ due_date: now() });
          await Promise.all([
            processReminderEvent(prisma, other.event_id, now),
            patchEventStatus(prisma, userId, String(other.event_id), {
              status: 'Completed',
            }),
          ]);
          assert.equal(
            (
              await prisma.event.findUnique({
                where: { event_id: other.event_id },
              })
            ).status,
            'Completed',
          );
          assert.equal(await count(other.event_id), 0);
        },
      );
    } finally {
      try {
        if (userId !== undefined) {
          await prisma.event.deleteMany({ where: { user_id: userId } });
          await prisma.user.delete({ where: { user_id: userId } });
        }
      } finally {
        await prisma.$disconnect();
      }
    }
  },
);
