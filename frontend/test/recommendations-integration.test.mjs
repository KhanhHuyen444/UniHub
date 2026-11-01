import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import {
  chromium,
  startRecommendationsHarness,
} from '../test-support/recommendations-browser.mjs';
const databaseUrl = process.env.TEST_RECOMMENDATIONS_FRONTEND_DATABASE_URL;
test(
  'real FR–BK–MySQL: Student cards/scores, Closed IDs, Guest/Admin denial, incomplete/empty and invalid token',
  {
    skip: !databaseUrl
      ? 'TEST_RECOMMENDATIONS_FRONTEND_DATABASE_URL is not configured.'
      : !chromium
        ? 'Playwright runner is unavailable.'
        : false,
  },
  async () => {
    const url = new URL(databaseUrl);
    assert.ok(
      url.protocol === 'mysql:' &&
        ['127.0.0.1', 'localhost'].includes(url.hostname) &&
        /^unihub_recommendations_frontend_test[A-Za-z0-9_]*$/.test(
          decodeURIComponent(url.pathname.slice(1)),
        ),
      'Use only an isolated loopback unihub_recommendations_frontend_test* database.',
    );
    const { createApp } = await import('../../backend/dist/app.js');
    const { createPrismaClient } = await import(
      '../../backend/dist/lib/prisma.js'
    );
    const { createAccessTokenService } = await import(
      '../../backend/dist/modules/auth/access-token.js'
    );
    const client = createPrismaClient(databaseUrl),
      rollback = new Error('Rollback Recommendations frontend fixtures');
    let harness, server;
    try {
      await client.$transaction(
        async (tx) => {
          for (const delegate of [tx.user, tx.category, tx.opportunity])
            assert.equal(
              await delegate.count(),
              0,
              'Refuse populated database.',
            );
          const major = await tx.category.create({
            data: { type: 'Major', name: 'Closed Major', status: 'Closed' },
          });
          const skill = await tx.category.create({
            data: { type: 'Skill', name: 'Closed Skill', status: 'Closed' },
          });
          const otherSkill = await tx.category.create({
            data: { type: 'Skill', name: 'Other Skill' },
          });
          const now = new Date('2026-11-05T17:00:00Z');
          const tokens = createAccessTokenService(
            {
              signingSecret: 'recommendations-fr-integration-test-only-secret',
              issuer: 'https://recommendations-fr.test.invalid',
              audience: 'recommendations-fr-test',
            },
            () => now,
          );
          let studentId;
          const signed = {};
          for (const [role, sessionId] of [
            ['Student', 'd7f55cee-2d7c-4df9-aece-36b6eb446db5'],
            ['Admin', 'e7f55cee-2d7c-4df9-aece-36b6eb446db5'],
          ]) {
            const user = await tx.user.create({
              data: {
                email: `${role.toLowerCase()}@recommendations-fr.test.invalid`,
                full_name: `Test ${role}`,
                role,
                major_id: major.category_id,
                academic_year: 2,
                skills: { create: { skill_id: skill.category_id } },
              },
            });
            if (role === 'Student') studentId = user.user_id;
            await tx.authSession.create({
              data: {
                session_id: sessionId,
                user_id: user.user_id,
                refresh_token_hash: (role === 'Student' ? 'a' : 'b').repeat(64),
                expires_at: new Date(now.getTime() + 60000),
              },
            });
            signed[role] = await tokens.sign({
              userId: user.user_id,
              role,
              sessionId,
            });
          }
          const create = (title, overrides = {}) =>
            tx.opportunity.create({
              data: {
                title,
                opportunity_type: 'Thực tập',
                publisher: 'Integration Publisher',
                status: 'Approved',
                work_format: 'Hybrid',
                location: 'Hà Nội',
                majors: { create: { major_id: major.category_id } },
                years: { create: { academic_year: 2 } },
                skills: {
                  create: [
                    { skill_id: skill.category_id },
                    { skill_id: otherSkill.category_id },
                  ],
                },
                ...overrides,
              },
            });
          await create('Matching opportunity'); // .4 + .3 + .15 = .85, Closed links count.
          const scholarship = await create('Matching scholarship', {
            opportunity_type: 'Học bổng',
            skills: undefined,
            deadline: new Date('2026-11-06T17:00:00Z'),
            deadline_source_date: new Date('2026-11-06T00:00:00Z'),
          }); // 1
          await create('Expired must not display', {
            deadline: new Date('2026-11-05T16:00:00Z'),
            deadline_source_timezone: 'UTC',
          });
          await create('Unknown must not display', {
            deadline: new Date('2026-12-01T00:00:00Z'),
          });
          await create('Pending must not display', { status: 'Pending' });
          const app = createApp({
            recommendations: {
              getPrismaClient: () => ({
                $transaction: (callback) => callback(tx),
              }),
              getEvaluatedAt: () => now,
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
            [signed.Admin, 403],
          ]) {
            const response = await fetch(
              `${backendTarget}/api/recommendations`,
              token ? { headers: { Authorization: `Bearer ${token}` } } : {},
            );
            assert.equal(response.status, status);
          }
          harness = await startRecommendationsHarness({
            backendTarget,
            authenticated: false,
          });
          const page = await harness.browser.newPage();
          await page.goto(harness.base + '/recommendations-test');
          await page
            .getByText('Cần đăng nhập Student', { exact: true })
            .waitFor();
          await page.evaluate((token) => {
            window.recommendationTest.setToken(token);
            window.recommendationTest.setRole('Student');
          }, signed.Student);
          await page
            .getByText('Matching opportunity', { exact: true })
            .waitFor();
          assert.deepEqual(
            await page.getByRole('heading', { level: 2 }).allTextContents(),
            ['Matching scholarship', 'Matching opportunity'],
          );
          await page.getByText('Điểm phù hợp: 85%', { exact: true }).waitFor();
          await page.getByText('Điểm phù hợp: 100%', { exact: true }).waitFor();
          assert.equal(
            await page
              .getByRole('link', {
                name: 'Xem chi tiết: Matching scholarship',
                exact: true,
              })
              .getAttribute('href'),
            `/opportunities/${scholarship.item_id}`,
          );
          assert.equal(
            await page
              .getByText('Expired must not display', { exact: true })
              .count(),
            0,
          );
          assert.equal(await tx.activityLog.count(), 0);
          await tx.user.update({
            where: { user_id: studentId },
            data: { academic_year: null },
          });
          await page
            .getByRole('button', { name: 'Tải lại gợi ý', exact: true })
            .click();
          await page
            .getByText('Cần hoàn thiện hồ sơ', { exact: true })
            .waitFor();
          await page
            .getByRole('button', { name: 'Hoàn thiện hồ sơ', exact: true })
            .click();
          assert.equal(
            await page.evaluate(() => window.profileRequested),
            true,
          );
          await tx.user.update({
            where: { user_id: studentId },
            data: { academic_year: 2 },
          });
          await tx.opportunity.updateMany({ data: { status: 'Rejected' } });
          await page
            .getByRole('button', { name: 'Thử lại', exact: true })
            .click();
          await page
            .getByText('Chưa có cơ hội phù hợp', { exact: true })
            .waitFor();
          await page.evaluate(() =>
            window.recommendationTest.setToken('invalid-token'),
          );
          await page
            .getByText('Phiên đăng nhập không hợp lệ', { exact: true })
            .waitFor();
          throw rollback;
        },
        { isolationLevel: 'RepeatableRead', timeout: 60000 },
      );
      assert.fail('Fixtures must roll back.');
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
