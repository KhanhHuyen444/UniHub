import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPrismaClient } from '../dist/lib/prisma.js';
import { mutateAdminCategory } from '../dist/modules/categories/admin-categories.service.js';

const databaseUrl = process.env.TEST_ADMIN_CATEGORIES_DATABASE_URL;
test(
  'isolated MySQL: collation uniqueness, final Active race, references and audit rollback',
  {
    skip:
      !databaseUrl && 'TEST_ADMIN_CATEGORIES_DATABASE_URL is not configured.',
  },
  async () => {
    const url = new URL(databaseUrl);
    assert.ok(
      url.protocol === 'mysql:' &&
        ['127.0.0.1', 'localhost'].includes(url.hostname) &&
        /^unihub_admin_categories_test[A-Za-z0-9_]*$/.test(
          decodeURIComponent(url.pathname.slice(1)),
        ),
      'Use only a disposable loopback unihub_admin_categories_test* database.',
    );
    const client = createPrismaClient(databaseUrl);
    try {
      for (const delegate of [
        client.category,
        client.user,
        client.activityLog,
      ]) {
        assert.equal(
          await delegate.count(),
          0,
          'Refuse populated database; never clear existing data.',
        );
      }
      const actor = await client.user.create({
        data: {
          email: 'admin-categories-test@example.invalid',
          full_name: 'Test Admin',
          role: 'Admin',
        },
      });
      const create = (type, name) =>
        mutateAdminCategory(client, actor.user_id, {
          kind: 'create',
          type,
          name,
          reason: null,
        });
      const first = (await create('Major', 'École')).category;
      const second = (await create('Major', 'Ecole')).category;
      await assert.rejects(create('Major', 'école'), {
        code: 'DUPLICATE_CATEGORY',
      });
      const skill = (await create('Skill', 'École')).category;
      const changeStatus = (id, status) =>
        mutateAdminCategory(client, actor.user_id, {
          kind: 'status',
          id,
          status,
          reason: 'Integration test',
        });
      await client.user.update({
        where: { user_id: actor.user_id },
        data: { major_id: first.id },
      });
      const results = await Promise.allSettled([
        changeStatus(first.id, 'Closed'),
        changeStatus(second.id, 'Closed'),
      ]);
      assert.equal(
        results.filter((result) => result.status === 'fulfilled').length,
        1,
      );
      const rejected = results.find((result) => result.status === 'rejected');
      assert.equal(rejected.reason.code, 'LAST_ACTIVE_CATEGORY');
      assert.equal(
        await client.category.count({
          where: { type: 'Major', status: 'Active' },
        }),
        1,
      );
      assert.equal(
        (await client.user.findUnique({ where: { user_id: actor.user_id } }))
          .major_id,
        first.id,
      );
      assert.equal(
        (await client.category.findUnique({ where: { category_id: skill.id } }))
          .status,
        'Active',
      );
      const before = await client.category.findUnique({
        where: { category_id: first.id },
      });
      const auditCount = await client.activityLog.count();
      const failingClient = {
        $transaction: (callback, options) =>
          client.$transaction(
            (tx) =>
              callback(
                new Proxy(tx, {
                  get(target, key, receiver) {
                    if (key === 'activityLog')
                      return {
                        create: async () => {
                          throw new Error('Injected audit failure');
                        },
                      };
                    return Reflect.get(target, key, receiver);
                  },
                }),
              ),
            options,
          ),
      };
      await assert.rejects(
        mutateAdminCategory(failingClient, actor.user_id, {
          kind: 'rename',
          id: first.id,
          name: 'Must roll back',
          reason: null,
        }),
        /Injected audit failure/,
      );
      assert.deepEqual(
        await client.category.findUnique({ where: { category_id: first.id } }),
        before,
      );
      assert.equal(await client.activityLog.count(), auditCount);
      const renamed = await mutateAdminCategory(client, actor.user_id, {
        kind: 'rename',
        id: first.id,
        name: 'Updated',
        reason: 'Rename',
      });
      assert.equal(renamed.changed, true);
      const noOp = await mutateAdminCategory(client, actor.user_id, {
        kind: 'rename',
        id: first.id,
        name: 'Updated',
        reason: null,
      });
      assert.equal(noOp.changed, false);
      assert.equal(await client.activityLog.count(), auditCount + 1);
      const closed = await client.category.findFirst({
        where: { type: 'Major', status: 'Closed' },
      });
      await changeStatus(closed.category_id, 'Active');
      const logs = await client.activityLog.findMany({
        orderBy: { log_id: 'asc' },
      });
      assert.deepEqual(
        logs.map((log) => log.action_type),
        [
          'CREATE_CATEGORY',
          'CREATE_CATEGORY',
          'CREATE_CATEGORY',
          'CLOSE_CATEGORY',
          'RENAME_CATEGORY',
          'REOPEN_CATEGORY',
        ],
      );
      assert.ok(
        logs.every(
          (log) =>
            log.admin_id === actor.user_id && log.target_type === 'Category',
        ),
      );
    } finally {
      // Keep append-only audit records. The caller disposes of this private test DB.
      await client.$disconnect();
    }
  },
);
