import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalize, resolve } from 'node:path';
import { createPrismaClient } from '../dist/lib/prisma.js';
import {
  listNotifications,
  markNotificationRead,
} from '../dist/modules/notifications/notifications.service.js';
const url = process.env.TEST_NOTIFICATIONS_DATABASE_URL;
test(
  'real isolated MySQL Notifications service',
  { skip: !url && 'Dedicated runner not configured.' },
  async (t) => {
    const parsed = new URL(url);
    assert.equal(parsed.hostname, '127.0.0.1');
    assert.match(parsed.pathname, /^\/unihub_notifications_test_[a-f0-9]+$/);
    const identity = JSON.parse(
      process.env.TEST_NOTIFICATIONS_MYSQL_IDENTITY ?? 'null',
    );
    assert.ok(identity, 'Dedicated runner required');
    const p = createPrismaClient(url);
    try {
      const [server] =
        await p.$queryRaw`SELECT @@port AS port,@@datadir AS datadir,@@server_uuid AS uuid`;
      assert.equal(Number(server.port), identity.port);
      assert.equal(server.uuid, identity.uuid);
      assert.equal(
        normalize(resolve(server.datadir)).toLowerCase(),
        normalize(resolve(identity.datadir)).toLowerCase(),
      );
      assert.equal(await p.user.count(), 0);
      const owner = await p.user.create({
          data: {
            email: 'owner@test.invalid',
            full_name: 'Isolated owner',
            role: 'Student',
          },
        }),
        other = await p.user.create({
          data: {
            email: 'other@test.invalid',
            full_name: 'Other isolated owner',
            role: 'Student',
          },
        });
      const event = await p.event.create({
        data: {
          user_id: owner.user_id,
          title: 'Isolated Reminder detail',
          due_date: new Date('2026-11-01T12:00:00Z'),
          remind_before: 24,
        },
      });
      const at = new Date('2026-10-31T00:00:00Z');
      const first = await p.notification.create({
        data: {
          user_id: owner.user_id,
          event_id: event.event_id,
          type: 'Reminder',
          content: 'first',
          created_at: at,
        },
      });
      await p.notification.create({
        data: {
          user_id: owner.user_id,
          event_id: event.event_id,
          type: 'Reminder',
          content: 'second',
          created_at: at,
        },
      });
      const newest = await p.notification.create({
        data: {
          user_id: owner.user_id,
          type: 'Violation',
          content: 'violation',
          created_at: at,
        },
      });
      const foreign = await p.notification.create({
        data: {
          user_id: other.user_id,
          type: 'Violation',
          content: 'other owner',
          created_at: at,
        },
      });
      await t.test(
        'owner filter, stable pagination and unreadCount across all pages',
        async () => {
          const page = await listNotifications(
            p,
            owner.user_id,
            '/api/notifications?page=1&pageSize=1',
          );
          assert.equal(page.items[0].id, newest.notification_id);
          assert.equal(page.items[0].eventId, null);
          assert.deepEqual(page.meta, {
            page: 1,
            pageSize: 1,
            total: 3,
            totalPages: 3,
          });
          assert.equal(page.unreadCount, 3);
          const next = await listNotifications(
            p,
            owner.user_id,
            '/api/notifications?page=2&pageSize=1',
          );
          assert.notEqual(next.items[0].id, page.items[0].id);
          assert.equal(next.items[0].eventId, event.event_id);
          assert.equal(next.unreadCount, 3);
          const ownOther = await listNotifications(
            p,
            other.user_id,
            '/api/notifications',
          );
          assert.deepEqual(
            ownOther.items.map((x) => x.id),
            [foreign.notification_id],
          );
        },
      );
      await t.test(
        'idempotent read changes only is_read and cannot cross owner',
        async () => {
          const before = await p.notification.findUnique({
            where: { notification_id: first.notification_id },
          });
          await assert.rejects(
            markNotificationRead(
              p,
              other.user_id,
              String(first.notification_id),
            ),
            (e) => e.status === 404,
          );
          assert.deepEqual(
            await markNotificationRead(
              p,
              owner.user_id,
              String(first.notification_id),
            ),
            { notification: { id: first.notification_id, isRead: true } },
          );
          await markNotificationRead(
            p,
            owner.user_id,
            String(first.notification_id),
          );
          assert.deepEqual(
            await p.notification.findUnique({
              where: { notification_id: first.notification_id },
            }),
            { ...before, is_read: true },
          );
          assert.equal(
            (await listNotifications(p, owner.user_id, '/api/notifications'))
              .unreadCount,
            2,
          );
        },
      );
      await t.test(
        'out-of-range page keeps totals and global unreadCount',
        async () => {
          const result = await listNotifications(
            p,
            owner.user_id,
            '/api/notifications?page=99&pageSize=1',
          );
          assert.deepEqual(result.items, []);
          assert.equal(result.meta.total, 3);
          assert.equal(result.unreadCount, 2);
        },
      );
      await t.test(
        'existing event FK cascades Reminder only, preserves unrelated Violation and no logs',
        async () => {
          await p.event.delete({ where: { event_id: event.event_id } });
          const remaining = await listNotifications(
            p,
            owner.user_id,
            '/api/notifications',
          );
          assert.deepEqual(
            remaining.items.map((x) => x.id),
            [newest.notification_id],
          );
          assert.equal(await p.activityLog.count(), 0);
        },
      );
    } finally {
      await p.$disconnect();
    }
  },
);
