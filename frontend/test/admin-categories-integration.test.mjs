import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import {
  chromium,
  startAdminCategoriesHarness,
} from '../test-support/admin-categories-browser.mjs';
const databaseUrl = process.env.TEST_ADMIN_CATEGORIES_FRONTEND_DATABASE_URL;
test(
  'real FR–BK–MySQL Admin CRUD: permission, create/rename/status, duplicate/final Active, audit and references',
  {
    skip: !databaseUrl
      ? 'TEST_ADMIN_CATEGORIES_FRONTEND_DATABASE_URL is not configured.'
      : !chromium
        ? 'Playwright runner is unavailable.'
        : false,
  },
  async () => {
    const url = new URL(databaseUrl);
    assert.ok(
      url.protocol === 'mysql:' &&
        ['127.0.0.1', 'localhost'].includes(url.hostname) &&
        /^unihub_admin_categories_frontend_test[A-Za-z0-9_]*$/.test(
          decodeURIComponent(url.pathname.slice(1)),
        ),
      'Use only a disposable loopback unihub_admin_categories_frontend_test* database.',
    );
    const { createApp } = await import('../../backend/dist/app.js');
    const { createPrismaClient } = await import(
      '../../backend/dist/lib/prisma.js'
    );
    const { createAccessTokenService } = await import(
      '../../backend/dist/modules/auth/access-token.js'
    );
    const client = createPrismaClient(databaseUrl);
    const rollback = new Error('Rollback Admin frontend integration fixtures');
    let harness, server;
    try {
      await client.$transaction(
        async (tx) => {
          for (const delegate of [tx.category, tx.user, tx.activityLog])
            assert.equal(
              await delegate.count(),
              0,
              'Refuse a populated database.',
            );
          const data = await tx.category.create({
            data: { type: 'Major', name: 'Data' },
          });
          await tx.category.create({ data: { type: 'Major', name: 'Design' } });
          await tx.category.create({
            data: { type: 'Skill', name: 'Old Skill', status: 'Closed' },
          });
          const now = new Date('2026-10-29T00:00:00Z');
          const tokens = createAccessTokenService(
            {
              signingSecret: 'admin-categories-fr-test-only-secret-32-bytes',
              issuer: 'https://admin-categories.test.invalid',
              audience: 'admin-categories-test',
            },
            () => now,
          );
          const signed = {};
          let studentId;
          for (const [role, sessionId] of [
            ['Admin', 'd7f55cee-2d7c-4df9-aece-36b6eb446db5'],
            ['Student', 'e7f55cee-2d7c-4df9-aece-36b6eb446db5'],
          ]) {
            const user = await tx.user.create({
              data: {
                email: `${role.toLowerCase()}@admin-categories.test.invalid`,
                full_name: `Test ${role}`,
                role,
                major_id: data.category_id,
              },
            });
            if (role === 'Student') studentId = user.user_id;
            await tx.authSession.create({
              data: {
                session_id: sessionId,
                user_id: user.user_id,
                refresh_token_hash: (role === 'Admin' ? 'a' : 'b').repeat(64),
                expires_at: new Date(now.getTime() + 60000),
              },
            });
            signed[role] = await tokens.sign({
              userId: user.user_id,
              role,
              sessionId,
            });
          }
          // Reuse the fixture transaction to roll back all rows/logs. Atomicity and
          // concurrent real transaction locking are checked by the Backend MySQL test.
          const app = createApp({
            adminCategories: {
              getPrismaClient: () => ({
                category: tx.category,
                $transaction: (callback) => callback(tx),
              }),
              auth: {
                verifyToken: tokens.verify,
                now: () => now,
                getPrismaClient: () => tx,
              },
            },
          });
          server = app.listen(0, '127.0.0.1');
          await once(server, 'listening');
          const backendTarget = `http://127.0.0.1:${server.address().port}`;
          for (const [token, status] of [
            [null, 401],
            [signed.Student, 403],
          ]) {
            for (const [method, path, body] of [
              ['GET', '?type=Major'],
              ['POST', '', { type: 'Major', name: 'Denied' }],
              ['PATCH', `/${data.category_id}`, { name: 'Denied' }],
              ['PATCH', `/${data.category_id}/status`, { status: 'Closed' }],
            ]) {
              const response = await fetch(
                `${backendTarget}/api/admin/categories${path}`,
                {
                  method,
                  headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    ...(body ? { 'Content-Type': 'application/json' } : {}),
                  },
                  ...(body ? { body: JSON.stringify(body) } : {}),
                },
              );
              assert.equal(response.status, status);
            }
          }
          assert.equal(await tx.activityLog.count(), 0);
          harness = await startAdminCategoriesHarness({
            backendTarget,
            authenticated: false,
          });
          const page = await harness.browser.newPage();
          await page.goto(harness.base + '/admin-categories-test');
          await page
            .getByText('Cần đăng nhập Admin', { exact: true })
            .waitFor();
          await page.evaluate((token) => {
            window.adminTest.setToken(token);
            window.adminTest.setRole('Admin');
          }, signed.Admin);
          await page.getByText('Data', { exact: true }).waitFor();
          const create = page.getByRole('form', {
            name: 'Tạo danh mục',
            exact: true,
          });
          await create
            .getByLabel('Tên danh mục', { exact: false })
            .fill('Data');
          await create
            .getByRole('button', { name: 'Tạo danh mục', exact: true })
            .click();
          await page
            .getByText('Tên danh mục đã tồn tại trong loại này.', {
              exact: true,
            })
            .waitFor();
          assert.equal(await tx.activityLog.count(), 0);
          await create
            .getByLabel('Tên danh mục', { exact: false })
            .fill('New Major');
          await create
            .getByLabel('Lý do tạo (tùy chọn)', { exact: true })
            .fill('Create through UI');
          await create
            .getByRole('button', { name: 'Tạo danh mục', exact: true })
            .click();
          await page.getByText('New Major', { exact: true }).waitFor();
          await page
            .getByRole('button', { name: 'Đổi tên New Major', exact: true })
            .click();
          const edit = page.getByRole('form', {
            name: 'Chỉnh sửa danh mục',
            exact: true,
          });
          await edit.getByLabel('Tên mới', { exact: false }).fill('Updated');
          await edit
            .getByRole('button', { name: 'Lưu thay đổi', exact: true })
            .click();
          await page.getByText('Updated', { exact: true }).waitFor();
          async function statusButton(label) {
            const button = page.getByRole('button', {
              name: label,
              exact: true,
            });
            await button.waitFor();
            await button.click();
            await edit
              .getByRole('button', { name: 'Lưu thay đổi', exact: true })
              .click();
          }
          await statusButton('Đóng Updated');
          await page
            .getByRole('button', { name: 'Mở lại Updated', exact: true })
            .waitFor();
          await statusButton('Mở lại Updated');
          await page
            .getByRole('button', { name: 'Đóng Updated', exact: true })
            .waitFor();
          await statusButton('Đóng Data');
          await page
            .getByRole('button', { name: 'Mở lại Data', exact: true })
            .waitFor();
          await statusButton('Đóng Design');
          await page
            .getByRole('button', { name: 'Mở lại Design', exact: true })
            .waitFor();
          await statusButton('Đóng Updated');
          await page
            .getByText(
              'Không thể đóng danh mục Active cuối cùng của loại này.',
              { exact: true },
            )
            .waitFor();
          const logs = await tx.activityLog.findMany({
            orderBy: { log_id: 'asc' },
          });
          assert.deepEqual(
            logs.map((log) => log.action_type),
            [
              'CREATE_CATEGORY',
              'RENAME_CATEGORY',
              'CLOSE_CATEGORY',
              'REOPEN_CATEGORY',
              'CLOSE_CATEGORY',
              'CLOSE_CATEGORY',
            ],
          );
          assert.equal(logs[0].reason, 'Create through UI');
          assert.equal(
            (await tx.user.findUnique({ where: { user_id: studentId } }))
              .major_id,
            data.category_id,
          );
          assert.equal(
            await tx.category.count({
              where: { type: 'Major', status: 'Active' },
            }),
            1,
          );
          await page
            .getByRole('button', { name: 'Skill', exact: true })
            .click();
          await page.getByText('Old Skill', { exact: true }).waitFor();
          await page.getByText('Closed', { exact: true }).waitFor();
          await page.evaluate(() => window.adminTest.setToken('invalid-token'));
          await page
            .getByText('Không được truy cập danh mục Admin', { exact: true })
            .waitFor();
          assert.equal(await page.getByRole('form').count(), 0);
          throw rollback;
        },
        { timeout: 60000 },
      );
      assert.fail('Fixture transaction must roll back.');
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await harness?.close();
      if (server)
        await new Promise((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      await client.$disconnect();
    }
  },
);
