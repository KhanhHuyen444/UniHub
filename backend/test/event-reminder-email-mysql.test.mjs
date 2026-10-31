import { waitForReadyEmailFixture } from './helpers/event-reminder-email-mysql-fixture.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { createPrismaClient } from '../dist/lib/prisma.js';
import { Prisma } from '../dist/generated/prisma/client.js';
import { processReminderEvent } from '../dist/modules/events/reminders.service.js';
import {
  patchEvent,
  patchEventStatus,
  deleteEvent,
} from '../dist/modules/events/events.service.js';
import { readReminderEmailConfig } from '../dist/modules/events/reminder-email.js';
import { createPrismaEmailStore } from '../dist/modules/events/reminder-email.store.js';
import { createReminderEmailWorker } from '../dist/modules/events/reminder-email.worker.js';
import { MailFailure } from '../dist/modules/events/mail-transport.js';
import {
  RETRY_DELAYS_MS,
  IDEMPOTENCY_WINDOW_MS,
} from '../dist/modules/events/reminder-email-policy.js';
import {
  openVerifiedEmailMysqlClients,
  requireEmailMysqlValidation,
  verifyEmailMysqlPrivileges,
} from './helpers/event-reminder-email-mysql-guard.mjs';

const requested = [
  'UNIHUB_EMAIL_MYSQL_TEST',
  'TEST_EVENT_REMINDER_EMAIL_DATABASE_URL',
  'TEST_EVENT_REMINDER_EMAIL_DENIED_URL',
  'TEST_EVENT_REMINDER_EMAIL_ADMIN_URL',
  'TEST_EVENT_REMINDER_EMAIL_MYSQL_IDENTITY',
].some((name) => process.env[name] !== undefined);
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
async function bounded(promise, ms = 3500) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('EMAIL_MYSQL_BARRIER_TIMEOUT')),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function until(check, ms = 3500) {
  const start = performance.now();
  while (performance.now() - start < ms) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('EMAIL_MYSQL_CONDITION_TIMEOUT');
}
function heldTransaction(client) {
  const entered = deferred(),
    release = deferred();
  let first = true;
  return {
    entered,
    release,
    client: {
      $transaction: (operation, options) =>
        client.$transaction(async (tx) => {
          const result = await operation(tx);
          if (first) {
            first = false;
            entered.resolve();
            await bounded(release.promise);
          }
          return result;
        }, options),
    },
  };
}
function errorCodes(error, seen = new Set()) {
  if (!error || typeof error !== 'object' || seen.has(error)) return [];
  seen.add(error);
  return [error.code, error.errno, error.originalCode]
    .filter((x) => x !== undefined)
    .map(String)
    .concat(
      ...['meta', 'cause', 'driverAdapterError'].map((key) =>
        errorCodes(error[key], seen),
      ),
    );
}
async function sqlFailure(promise, accepted) {
  await assert.rejects(promise, (error) => {
    assert.ok(
      errorCodes(error).some((code) => accepted.includes(code)),
      'Expected a specific MySQL/Prisma constraint or privilege code',
    );
    return true;
  });
}

test(
  'Event Reminder Email: guarded disposable MySQL 8.4 integration',
  {
    skip:
      !requested &&
      'Inactive: use the isolated runner; no database URL fallback.',
  },
  async (t) => {
    const clients = await openVerifiedEmailMysqlClients(
      process.env,
      createPrismaClient,
    );
    const { admin, a, b, denied, config } = clients;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('NETWORK_PROVIDER_DISABLED_IN_EMAIL_MYSQL_TESTS');
    };
    const ownerIds = [];
    const email = readReminderEmailConfig({
      EVENT_REMINDER_EMAIL_ENABLED: 'true',
      EMAIL_FROM: 'reminders@synthetic.invalid',
      EMAIL_IDEMPOTENCY_NAMESPACE: `isolated-${config.identity.nonce}`,
      APP_BASE_URL: 'https://synthetic.invalid',
    });
    const storeA = createPrismaEmailStore(a),
      storeB = createPrismaEmailStore(b);
    const now = async () =>
      (await admin.$queryRaw`SELECT UTC_TIMESTAMP(0) AS instant`)[0].instant;
    const job = (id) =>
      admin.eventReminderEmail.findUnique({ where: { notification_id: id } });
    let owner;
    async function fixture({ enqueue = true, ...data } = {}) {
      const at = await now();
      const event = await admin.event.create({
        data: {
          user_id: owner.user_id,
          title: 'Synthetic <event> & "quote"',
          due_date: new Date(+at + 48 * 3_600_000),
          remind_before: 72,
          ...data,
        },
      });
      if (!enqueue) return { event, at };
      assert.equal(
        await processReminderEvent(
          a,
          event.event_id,
          () => at,
          () => false,
          email,
        ),
        'reminded',
      );
      const notification = await admin.notification.findFirst({
        where: { event_id: event.event_id, type: 'Reminder' },
      });
      assert.ok(notification, 'Enqueue must create the Reminder notification');
      await waitForReadyEmailFixture(admin, notification.notification_id);
      return {
        event,
        at,
        notification,
        row: await job(notification.notification_id),
      };
    }
    async function expire(id, retryDue = false) {
      if (retryDue)
        await admin.$executeRaw`UPDATE event_reminder_emails SET next_attempt_at = DATE_SUB(UTC_TIMESTAMP(0), INTERVAL 1 SECOND) WHERE notification_id = ${id}`;
      else
        await admin.$executeRaw`UPDATE event_reminder_emails SET lease_expires_at = DATE_SUB(UTC_TIMESTAMP(0), INTERVAL 1 SECOND) WHERE notification_id = ${id}`;
    }
    async function waitForJobLock() {
      await until(async () => {
        const [result] = await admin.$queryRaw`
        SELECT COUNT(*) AS waiting FROM performance_schema.data_lock_waits w
        JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID
        WHERE l.OBJECT_SCHEMA = ${config.identity.database} AND l.OBJECT_NAME = 'event_reminder_emails'
      `;
        return Number(result.waiting) > 0;
      }, 2000);
    }
    try {
      // Refuse a reused database even when its name and server identity match.
      assert.equal(
        await admin.user.count(),
        0,
        'Dedicated fresh schema required',
      );
      assert.equal(await admin.event.count(), 0);
      assert.equal(await admin.notification.count(), 0);
      assert.equal(
        await admin.eventReminderEmail.count(),
        0,
        'Migration must not backfill',
      );
      assert.equal(await admin.activityLog.count(), 0);

      await requireEmailMysqlValidation(async () => {
        const migrationRoot = new URL('../prisma/migrations/', import.meta.url);
        const expected = {};
        for (const entry of await readdir(migrationRoot, {
          withFileTypes: true,
        })) {
          if (entry.isDirectory())
            expected[entry.name] = createHash('sha256')
              .update(
                await readFile(
                  new URL(`${entry.name}/migration.sql`, migrationRoot),
                ),
              )
              .digest('hex');
        }
        assert.deepEqual(expected, config.identity.migrationHashes);
        const history =
          await admin.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM _prisma_migrations`;
        assert.equal(history.length, Object.keys(expected).length);
        for (const migration of history) {
          assert.equal(migration.checksum, expected[migration.migration_name]);
          assert.ok(migration.finished_at instanceof Date);
          assert.equal(migration.rolled_back_at, null);
        }
        const ddl = Object.values(
          (await admin.$queryRaw`SHOW CREATE TABLE event_reminder_emails`)[0],
        ).find(
          (value) =>
            typeof value === 'string' && value.includes('CREATE TABLE'),
        );
        for (const name of [
          'chk_ere_state',
          'chk_ere_attempt_count',
          'chk_ere_payload_json',
          'chk_ere_idempotency_key',
          'chk_ere_lease',
          'chk_ere_attempt_clock',
          'chk_ere_state_attempts',
          'chk_ere_acceptance',
          'ere_ready_idx',
          'ere_lease_idx',
          'ere_idempotency_key_uq',
          'ere_notification_id_fkey',
        ])
          assert.ok(ddl.includes(name));
        assert.match(ddl, /PRIMARY KEY \(`notification_id`\)/);
        assert.match(
          ddl,
          /REFERENCES `notifications` \(`notification_id`\) ON DELETE CASCADE/,
        );
        const columns =
          await admin.$queryRaw`SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, COLLATION_NAME AS collation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_reminder_emails'`;
        const byName = new Map(columns.map((column) => [column.name, column]));
        assert.equal(byName.get('notification_id').type, 'int');
        assert.equal(byName.get('attempt_count').type, 'tinyint unsigned');
        assert.equal(byName.get('payload_json').type, 'longtext');
        assert.equal(byName.get('idempotency_key').collation, 'ascii_bin');
        assert.equal(byName.get('lease_token').collation, 'ascii_bin');
      });

      await requireEmailMysqlValidation(async () => {
        await verifyEmailMysqlPrivileges(a, config.identity.database, true);
        await verifyEmailMysqlPrivileges(b, config.identity.database, true);
        await verifyEmailMysqlPrivileges(
          denied,
          config.identity.database,
          false,
        );
      });
      owner = await admin.user.create({
        data: {
          email: `student-${config.identity.nonce}@synthetic.invalid`,
          full_name: 'Synthetic email test Student',
          role: 'Student',
        },
      });
      ownerIds.push(owner.user_id);
      t.beforeEach(async () => {
        await admin.event.deleteMany({ where: { user_id: { in: ownerIds } } });
        await admin.notification.deleteMany({
          where: { user_id: { in: ownerIds } },
        });
        await admin.user.update({
          where: { user_id: owner.user_id },
          data: { email: owner.email, role: 'Student' },
        });
      });

      await t.test(
        'all CHECK families reject invalid rows; PK, unique and orphan FK reject duplicates',
        async () => {
          const f = await fixture();
          const id = f.notification.notification_id;
          for (const assignment of [
            Prisma.sql`state = 'pending'`,
            Prisma.sql`state = 'Dead', attempt_count = 7, first_attempt_at = UTC_TIMESTAMP(0)`,
            Prisma.sql`payload_json = '{'`,
            Prisma.sql`idempotency_key = ''`,
            Prisma.sql`lease_token = ${randomUUID()}`,
            Prisma.sql`state = 'Dead', attempt_count = 1, first_attempt_at = NULL`,
            Prisma.sql`state = 'Pending', attempt_count = 1, first_attempt_at = UTC_TIMESTAMP(0)`,
            Prisma.sql`state = 'Retry', attempt_count = 6, first_attempt_at = UTC_TIMESTAMP(0)`,
            Prisma.sql`state = 'Processing', lease_token = ${randomUUID()}, lease_expires_at = DATE_ADD(UTC_TIMESTAMP(0), INTERVAL 60 SECOND)`,
            Prisma.sql`state = 'Accepted', attempt_count = 1, first_attempt_at = UTC_TIMESTAMP(0)`,
            Prisma.sql`provider_email_id = 'synthetic-reference', accepted_at = UTC_TIMESTAMP(0)`,
          ])
            await sqlFailure(
              admin.$executeRaw(
                Prisma.sql`UPDATE event_reminder_emails SET ${assignment} WHERE notification_id = ${id}`,
              ),
              ['3819'],
            );
          const data = {
            notification_id: id,
            payload_json: f.row.payload_json,
            idempotency_key: f.row.idempotency_key,
          };
          await sqlFailure(admin.eventReminderEmail.create({ data }), [
            '1062',
            'P2002',
          ]);
          await sqlFailure(
            admin.eventReminderEmail.create({
              data: {
                ...data,
                notification_id: 2_147_483_647,
                idempotency_key: 'synthetic-orphan',
              },
            }),
            ['1452', 'P2003'],
          );
          const other = await admin.notification.create({
            data: {
              user_id: owner.user_id,
              event_id: f.event.event_id,
              type: 'Reminder',
              content: 'Synthetic duplicate-key test',
            },
          });
          await sqlFailure(
            admin.eventReminderEmail.create({
              data: { ...data, notification_id: other.notification_id },
            }),
            ['1062', 'P2002'],
          );
          assert.equal((await job(id)).state, 'Pending');
        },
      );

      await t.test(
        'runtime privileges: enqueue/claim work, direct job DELETE and DDL/log mutations are forbidden',
        async () => {
          const f = await fixture();
          const claim = await storeA.claim();
          assert.equal(claim.notificationId, f.notification.notification_id);
          assert.ok(await storeA.preflight(claim));
          assert.equal(
            await storeA.settle(claim, {
              accepted: true,
              providerEmailId: 'synthetic-accepted',
            }),
            true,
          );
          await sqlFailure(
            a.$executeRaw`DELETE FROM event_reminder_emails WHERE notification_id = -1`,
            ['1142'],
          );
          await sqlFailure(
            a.$executeRaw`CREATE TABLE unihub_forbidden_ddl_probe (id INTEGER)`,
            ['1142'],
          );
          await sqlFailure(
            a.$executeRaw`UPDATE activity_logs SET reason = 'forbidden' WHERE log_id = -1`,
            ['1142'],
          );
          await sqlFailure(
            a.$executeRaw`DELETE FROM activity_logs WHERE log_id = -1`,
            ['1142'],
          );
          assert.equal(await a.activityLog.count(), 0);
        },
      );

      await t.test(
        'Notification/Event cascades remove jobs despite runtime lacking direct child DELETE',
        async () => {
          const one = await fixture();
          await a.notification.delete({
            where: { notification_id: one.notification.notification_id },
          });
          assert.equal(await job(one.notification.notification_id), null);
          const two = await fixture();
          const violation = await admin.notification.create({
            data: {
              user_id: owner.user_id,
              type: 'Violation',
              content: 'Synthetic unrelated notice',
            },
          });
          await deleteEvent(a, owner.user_id, String(two.event.event_id));
          assert.equal(await job(two.notification.notification_id), null);
          assert.ok(
            await admin.notification.findUnique({
              where: { notification_id: violation.notification_id },
            }),
          );
          assert.equal(await admin.activityLog.count(), 0);
        },
      );

      await t.test(
        'real permission/CHECK/recipient failures roll back marker, bell and outbox atomically',
        async () => {
          for (const failure of ['privilege', 'check', 'recipient']) {
            const f = await fixture({ enqueue: false });
            let client = failure === 'privilege' ? denied : a;
            if (failure === 'recipient')
              await admin.user.update({
                where: { user_id: owner.user_id },
                data: { email: 'bad,address@synthetic.invalid' },
              });
            if (failure === 'check')
              client = {
                $transaction: (operation, options) =>
                  a.$transaction(
                    (tx) =>
                      operation(
                        new Proxy(tx, {
                          get(target, key) {
                            if (key === 'eventReminderEmail')
                              return {
                                create: ({ data }) =>
                                  tx.eventReminderEmail.create({
                                    data: { ...data, payload_json: '{' },
                                  }),
                              };
                            const value = Reflect.get(target, key);
                            return typeof value === 'function'
                              ? value.bind(target)
                              : value;
                          },
                        }),
                      ),
                    options,
                  ),
              };
            await assert.rejects(
              processReminderEvent(
                client,
                f.event.event_id,
                () => f.at,
                () => false,
                email,
              ),
            );
            assert.equal(
              (
                await admin.event.findUnique({
                  where: { event_id: f.event.event_id },
                })
              ).reminded_at,
              null,
            );
            assert.equal(
              await admin.notification.count({
                where: { event_id: f.event.event_id },
              }),
              0,
            );
            assert.equal(await admin.eventReminderEmail.count(), 0);
            await admin.user.update({
              where: { user_id: owner.user_id },
              data: { email: owner.email },
            });
            await processReminderEvent(
              a,
              f.event.event_id,
              () => f.at,
              () => false,
              email,
            );
            assert.equal(await admin.eventReminderEmail.count(), 1);
            await admin.event.delete({ where: { event_id: f.event.event_id } });
          }
        },
      );

      await t.test(
        'parallel schedulers create one bell and one outbox job',
        async () => {
          const f = await fixture({ enqueue: false });
          await Promise.all(
            [a, b].map((client) =>
              processReminderEvent(
                client,
                f.event.event_id,
                () => f.at,
                () => false,
                email,
              ),
            ),
          );
          assert.equal(
            await admin.notification.count({
              where: { event_id: f.event.event_id },
            }),
            1,
          );
          assert.equal(await admin.eventReminderEmail.count(), 1);
        },
      );

      await t.test(
        'disabled email succeeds as bell-only without outbox privileges',
        async () => {
          const f = await fixture({ enqueue: false });
          assert.equal(
            await processReminderEvent(
              denied,
              f.event.event_id,
              () => f.at,
              () => false,
              { enabled: false },
            ),
            'reminded',
          );
          assert.equal(
            await admin.notification.count({
              where: { event_id: f.event.event_id, type: 'Reminder' },
            }),
            1,
          );
          assert.equal(await admin.eventReminderEmail.count(), 0);
        },
      );

      await t.test(
        'independent sessions skip a specifically locked row and claim other work',
        async () => {
          const first = await fixture(),
            second = await fixture();
          const locked = deferred(),
            release = deferred();
          let connectionA;
          const holding = a.$transaction(
            async (tx) => {
              connectionA = Number(
                (await tx.$queryRaw`SELECT CONNECTION_ID() AS id`)[0].id,
              );
              await tx.$queryRaw`SELECT notification_id FROM event_reminder_emails WHERE notification_id = ${first.notification.notification_id} FOR UPDATE`;
              locked.resolve();
              await bounded(release.promise);
            },
            { isolationLevel: 'ReadCommitted', timeout: 5000 },
          );
          holding.catch(() => {});
          try {
            await bounded(locked.promise);
            const [otherConnection] =
              await b.$queryRaw`SELECT CONNECTION_ID() AS id`;
            assert.notEqual(connectionA, Number(otherConnection.id));
            const claim = await bounded(storeB.claim(), 2000);
            assert.ok(claim, 'An unlocked, database-ready job must be claimed');
            assert.equal(
              claim.notificationId,
              second.notification.notification_id,
            );
          } finally {
            release.resolve();
            await holding;
          }
        },
      );

      await t.test(
        'two store claim transactions can overlap and commit distinct claims',
        async () => {
          const jobs = [await fixture(), await fixture()];
          // Recheck both jobs at the overlap boundary; null is not evidence of
          // over-locking unless another due Pending job actually exists.
          for (const f of jobs)
            await waitForReadyEmailFixture(
              admin,
              f.notification.notification_id,
            );
          const [plan] = await admin.$queryRaw`
            EXPLAIN FORMAT=JSON SELECT notification_id, next_attempt_at FROM event_reminder_emails
            WHERE state IN ('Pending', 'Retry') AND next_attempt_at <= UTC_TIMESTAMP(3)
            ORDER BY next_attempt_at, notification_id LIMIT 1
          `;
          console.info(
            'Email claim candidate EXPLAIN (non-locking):',
            JSON.stringify(plan),
          );
          const [lockPlan] = await admin.$queryRaw`
            EXPLAIN FORMAT=JSON SELECT notification_id FROM event_reminder_emails FORCE INDEX (PRIMARY)
            WHERE notification_id = ${jobs[0].notification.notification_id}
              AND state IN ('Pending', 'Retry') AND next_attempt_at <= UTC_TIMESTAMP(3)
            FOR UPDATE SKIP LOCKED
          `;
          console.info(
            'Email claim primary-key EXPLAIN:',
            JSON.stringify(lockPlan),
          );
          const held = heldTransaction(a);
          const first = createPrismaEmailStore(held.client).claim();
          first.catch(() => {});
          try {
            await bounded(held.entered.promise);
            const second = await bounded(storeB.claim(), 2000);
            assert.ok(
              second,
              'Claim plan must not lock every eligible row while returning LIMIT 1',
            );
            held.release.resolve();
            const firstClaim = await first;
            assert.ok(firstClaim, 'First overlapping claim must succeed');
            assert.notEqual(firstClaim.notificationId, second.notificationId);
          } finally {
            held.release.resolve();
            await first;
          }
        },
      );

      await t.test(
        'UTC/native integer mapping, 60-second lease and SQL parameter binding',
        async () => {
          const attack = `Sinh viên ' \\"; DROP TABLE users; -- <script>alert(1)</script>`;
          const f = await fixture({ title: attack });
          const token = "token' OR 1=1 --x";
          const injected = createPrismaEmailStore(a, () => token);
          const claim = await injected.claim();
          const stored = await job(f.notification.notification_id);
          assert.equal(stored.lease_token, token);
          assert.equal(typeof stored.attempt_count, 'number');
          assert.equal(typeof stored.notification_id, 'number');
          assert.equal(stored.attempt_count, 1);
          assert.equal(
            +stored.lease_expires_at - +stored.first_attempt_at,
            60_000,
          );
          assert.equal(stored.first_attempt_at.getUTCMilliseconds(), 0);
          const prepared = await injected.preflight(claim);
          assert.ok(prepared.databaseNow instanceof Date);
          const [mapping] =
            await a.$queryRaw`SELECT UTC_TIMESTAMP(3) AS instant, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW()) AS offset_seconds, @@session.time_zone AS timezone, ${attack} AS bound_value`;
          assert.ok(mapping.instant instanceof Date);
          assert.equal(Number(mapping.offset_seconds), 0);
          assert.equal(mapping.timezone, '+00:00');
          assert.equal(mapping.bound_value, attack);
          assert.equal(
            JSON.parse(prepared.payloadJson).text.includes(attack),
            true,
          );
          assert.ok(
            JSON.parse(prepared.payloadJson).html.includes('&lt;script&gt;'),
          );
          assert.equal(await admin.user.count(), 1);
        },
      );

      await t.test(
        'lease expiry/recovery consumes attempts and fences a stale worker',
        async () => {
          const f = await fixture();
          const first = await storeA.claim();
          await expire(f.notification.notification_id);
          assert.equal(await storeB.preflight(first), null);
          assert.equal(
            await storeA.settle(first, {
              accepted: true,
              providerEmailId: 'stale-acceptance',
            }),
            false,
          );
          const recovered = [];
          await storeB.recoverExpired((operation, diagnostic) =>
            recovered.push({ operation, ...diagnostic }),
          );
          const retry = await job(f.notification.notification_id);
          assert.equal(retry.state, 'Retry');
          assert.equal(retry.attempt_count, 1);
          assert.equal(recovered[0].operation, 'lease_recovery');
          await expire(f.notification.notification_id, true);
          const second = await storeB.claim();
          assert.notEqual(second.leaseToken, first.leaseToken);
          assert.equal(
            await storeA.settle(first, {
              accepted: false,
              failure: new MailFailure('NETWORK_ERROR', true),
            }),
            false,
          );
          assert.equal(
            (await job(f.notification.notification_id)).attempt_count,
            2,
          );
        },
      );

      await t.test(
        'acceptance in progress wins over recovery after lease expiry without duplicate transition',
        async () => {
          const f = await fixture();
          const claim = await storeA.claim();
          await admin.$executeRaw`UPDATE event_reminder_emails SET lease_expires_at = DATE_ADD(UTC_TIMESTAMP(0), INTERVAL 2 SECOND) WHERE notification_id = ${f.notification.notification_id}`;
          const expiry = (await job(f.notification.notification_id))
            .lease_expires_at;
          const held = heldTransaction(a);
          const accepting = createPrismaEmailStore(held.client).settle(claim, {
            accepted: true,
            providerEmailId: 'synthetic-race-acceptance',
          });
          accepting.catch(() => {});
          try {
            await bounded(held.entered.promise);
            await until(async () => +(await now()) >= +expiry, 2500);
            const diagnostics = [];
            await storeB.recoverExpired((...args) => diagnostics.push(args));
            assert.deepEqual(diagnostics, []);
          } finally {
            held.release.resolve();
            await accepting;
          }
          assert.equal(
            (await job(f.notification.notification_id)).state,
            'Accepted',
          );
        },
      );

      await t.test(
        'recovery in progress prevents stale acceptance from overwriting Retry',
        async () => {
          const f = await fixture();
          const claim = await storeA.claim();
          await expire(f.notification.notification_id);
          const held = heldTransaction(b);
          const recovering = createPrismaEmailStore(
            held.client,
          ).recoverExpired();
          recovering.catch(() => {});
          try {
            await bounded(held.entered.promise);
            const accepting = storeA.settle(claim, {
              accepted: true,
              providerEmailId: 'stale',
            });
            accepting.catch(() => {});
            held.release.resolve();
            await recovering;
            assert.equal(await accepting, false);
          } finally {
            held.release.resolve();
            await recovering;
          }
          assert.equal(
            (await job(f.notification.notification_id)).state,
            'Retry',
          );
        },
      );

      for (const mutation of [
        'title/notes',
        'dueDate',
        'remindBefore',
        'DELETE',
        'Completed',
      ]) {
        await t.test(
          `Calendar ${mutation} during a locked preflight`,
          async () => {
            const f = await fixture();
            const claim = await storeA.claim();
            const held = heldTransaction(a);
            const preflighting = createPrismaEmailStore(held.client).preflight(
              claim,
            );
            preflighting.catch(() => {});
            let changing;
            try {
              await bounded(held.entered.promise);
              changing =
                mutation === 'DELETE'
                  ? deleteEvent(b, owner.user_id, String(f.event.event_id))
                  : mutation === 'Completed'
                    ? patchEventStatus(
                        b,
                        owner.user_id,
                        String(f.event.event_id),
                        { status: 'Completed' },
                      )
                    : patchEvent(
                        b,
                        owner.user_id,
                        String(f.event.event_id),
                        mutation === 'title/notes'
                          ? {
                              title: 'Edited synthetic title',
                              notes: 'Edited notes',
                            }
                          : mutation === 'dueDate'
                            ? {
                                dueDate: new Date(
                                  +f.event.due_date + 3_600_000,
                                ).toISOString(),
                              }
                            : { remindBefore: 0 },
                        await now(),
                      );
              changing.catch(() => {});
              if (['dueDate', 'remindBefore', 'DELETE'].includes(mutation))
                await waitForJobLock();
              else await bounded(changing);
            } finally {
              held.release.resolve();
              await Promise.allSettled([preflighting, changing]);
            }
            await changing;
            const prepared = await preflighting;
            assert.equal(
              prepared.payloadJson,
              f.row.payload_json,
              'Committed preflight is a snapshot, not an external-send lock',
            );
            if (mutation === 'title/notes')
              assert.equal(
                (await storeB.preflight(claim)).payloadJson,
                f.row.payload_json,
              );
            else {
              assert.equal(await storeB.preflight(claim), null);
              if (mutation === 'Completed')
                assert.equal(
                  (await job(f.notification.notification_id)).state,
                  'Cancelled',
                );
              else
                assert.equal(await job(f.notification.notification_id), null);
            }
          },
        );
      }

      for (const mutation of [
        'title/notes',
        'dueDate',
        'remindBefore',
        'DELETE',
        'Completed',
      ]) {
        await t.test(
          `fake in-flight acceptance then ${mutation} before settlement`,
          async () => {
            const f = await fixture();
            const sent = deferred(),
              accept = deferred(),
              logs = [],
              calls = [];
            const worker = createReminderEmailWorker({
              enabled: true,
              getStore: () => storeA,
              transport: {
                send: async (body, options) => {
                  calls.push({ body, key: options.idempotencyKey });
                  sent.resolve();
                  return accept.promise;
                },
              },
              log: (event, fields) => logs.push({ event, ...fields }),
              reportError: () => {},
              setInterval: () => ({ unref() {} }),
              clearInterval: () => {},
            });
            worker.start();
            try {
              await bounded(sent.promise);
              if (mutation === 'DELETE')
                await deleteEvent(b, owner.user_id, String(f.event.event_id));
              else if (mutation === 'Completed')
                await patchEventStatus(
                  b,
                  owner.user_id,
                  String(f.event.event_id),
                  { status: 'Completed' },
                );
              else
                await patchEvent(
                  b,
                  owner.user_id,
                  String(f.event.event_id),
                  mutation === 'title/notes'
                    ? { title: 'Later synthetic title', notes: 'Later notes' }
                    : mutation === 'dueDate'
                      ? {
                          dueDate: new Date(
                            +f.event.due_date + 3_600_000,
                          ).toISOString(),
                        }
                      : { remindBefore: 0 },
                  await now(),
                );
              accept.resolve({
                providerEmailId: 'synthetic-provider-accepted',
              });
              await until(() =>
                logs.some((entry) =>
                  ['accepted', 'settlement_failure'].includes(entry.event),
                ),
              );
              assert.deepEqual(calls, [
                { body: f.row.payload_json, key: f.row.idempotency_key },
              ]);
              if (['title/notes', 'Completed'].includes(mutation))
                assert.equal(
                  (await job(f.notification.notification_id)).state,
                  'Accepted',
                );
              else {
                assert.equal(await job(f.notification.notification_id), null);
                assert.ok(
                  logs.some(
                    (entry) => entry.error_code === 'SETTLEMENT_NOT_APPLIED',
                  ),
                );
              }
            } finally {
              accept.resolve({
                providerEmailId: 'synthetic-provider-accepted',
              });
              await worker.stop();
            }
          },
        );
      }

      await t.test(
        'six real claims enforce each retry delay, budget and immutable request',
        async () => {
          const f = await fixture();
          for (let attempt = 1; attempt <= 6; attempt++) {
            const claim = await storeA.claim();
            assert.ok(claim);
            const prepared = await storeA.preflight(claim);
            assert.equal(prepared.payloadJson, f.row.payload_json);
            assert.equal(prepared.idempotencyKey, f.row.idempotency_key);
            const before = await now();
            await storeA.settle(claim, {
              accepted: false,
              failure: new MailFailure('PROVIDER_UNAVAILABLE', true),
            });
            const after = await now(),
              stored = await job(claim.notificationId);
            assert.equal(stored.attempt_count, attempt);
            if (attempt === 6) {
              assert.equal(stored.state, 'Dead');
              assert.equal(await storeB.claim(), null);
            } else {
              assert.equal(stored.state, 'Retry');
              assert.ok(
                +stored.next_attempt_at >=
                  +before + RETRY_DELAYS_MS[attempt - 1],
              );
              assert.ok(
                +stored.next_attempt_at <=
                  +after + RETRY_DELAYS_MS[attempt - 1] + 1000,
              );
              assert.equal(
                await storeB.claim(),
                null,
                'Retry cannot be claimed early',
              );
              // Test-only time compression: change this synthetic row, never server time.
              await expire(claim.notificationId, true);
            }
          }
        },
      );

      await t.test(
        'current ownership/role/recipient, deadline and 23-hour window cancel or stop requests',
        async () => {
          for (const change of [
            'recipient',
            'role',
            'owner',
            'deadline',
            'window',
          ]) {
            const f = await fixture();
            const claim = await storeA.claim();
            if (change === 'recipient')
              await admin.user.update({
                where: { user_id: owner.user_id },
                data: { email: 'changed@synthetic.invalid' },
              });
            if (change === 'role')
              await admin.user.update({
                where: { user_id: owner.user_id },
                data: { role: 'Admin' },
              });
            if (change === 'owner') {
              const other = await admin.user.create({
                data: {
                  email: `other-${randomUUID()}@synthetic.invalid`,
                  full_name: 'Synthetic other Student',
                  role: 'Student',
                },
              });
              ownerIds.push(other.user_id);
              await admin.event.update({
                where: { event_id: f.event.event_id },
                data: { user_id: other.user_id },
              });
            }
            if (change === 'deadline')
              await admin.event.update({
                where: { event_id: f.event.event_id },
                data: { due_date: await now() },
              });
            if (change === 'window')
              await admin.eventReminderEmail.update({
                where: { notification_id: claim.notificationId },
                data: {
                  first_attempt_at: new Date(
                    +(await now()) - IDEMPOTENCY_WINDOW_MS,
                  ),
                },
              });
            assert.equal(await storeB.preflight(claim), null);
            assert.equal(
              (await job(claim.notificationId)).state,
              change === 'window' ? 'Dead' : 'Cancelled',
            );
            await admin.event.delete({ where: { event_id: f.event.event_id } });
            await admin.user.update({
              where: { user_id: owner.user_id },
              data: { email: owner.email, role: 'Student' },
            });
          }
        },
      );
    } finally {
      globalThis.fetch = originalFetch;
      try {
        if (ownerIds.length) {
          await admin.event.deleteMany({
            where: { user_id: { in: ownerIds } },
          });
          await admin.notification.deleteMany({
            where: { user_id: { in: ownerIds } },
          });
          assert.equal(
            await admin.activityLog.count(),
            0,
            'activity_logs must remain untouched',
          );
          await admin.user.deleteMany({ where: { user_id: { in: ownerIds } } });
        }
      } finally {
        await Promise.allSettled(
          [admin, a, b, denied].map((client) => client.$disconnect()),
        );
      }
    }
  },
);
