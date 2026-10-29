import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../dist/app.js';
import { createPrismaClient } from '../dist/lib/prisma.js';
import { createAccessTokenService } from '../dist/modules/auth/access-token.js';

const databaseUrl = process.env.TEST_RECOMMENDATIONS_DATABASE_URL;
const now = new Date('2026-11-05T17:00:00Z');
test(
  'isolated MySQL HTTP: real profile/session/joins, Closed IDs, expiry, public shape and no writes',
  {
    skip:
      !databaseUrl && 'TEST_RECOMMENDATIONS_DATABASE_URL is not configured.',
  },
  async () => {
    const url = new URL(databaseUrl);
    assert.ok(
      url.protocol === 'mysql:' &&
        ['127.0.0.1', 'localhost'].includes(url.hostname) &&
        /^unihub_recommendations_test[A-Za-z0-9_]*$/.test(
          decodeURIComponent(url.pathname.slice(1)),
        ),
      'Use only an isolated loopback unihub_recommendations_test* database.',
    );
    const client = createPrismaClient(databaseUrl);
    const rollback = new Error('Rollback this test fixture transaction');
    try {
      await client.$transaction(
        async (tx) => {
          assert.equal(
            await tx.user.count(),
            0,
            'Refuse populated test database.',
          );
          assert.equal(
            await tx.category.count(),
            0,
            'Refuse populated test database.',
          );
          assert.equal(
            await tx.opportunity.count(),
            0,
            'Refuse populated test database.',
          );
          const major = await tx.category.create({
            data: { type: 'Major', name: 'Test Major' },
          });
          const closedSkill = await tx.category.create({
            data: { type: 'Skill', name: 'Closed Skill', status: 'Closed' },
          });
          const activeSkill = await tx.category.create({
            data: { type: 'Skill', name: 'Active Skill' },
          });
          const student = await tx.user.create({
            data: {
              email: 'recommendation-test@example.invalid',
              full_name: 'Test Student',
              role: 'Student',
              major_id: major.category_id,
              academic_year: 2,
              skills: { create: { skill_id: closedSkill.category_id } },
            },
          });
          const sessionId = 'd7f55cee-2d7c-4df9-aece-36b6eb446db5';
          await tx.authSession.create({
            data: {
              session_id: sessionId,
              user_id: student.user_id,
              refresh_token_hash: 'a'.repeat(64),
              expires_at: new Date(now.getTime() + 60000),
            },
          });
          const create = (overrides = {}, years = [2]) =>
            tx.opportunity.create({
              data: {
                opportunity_type: 'Thực tập',
                title: 'Test recommendation',
                publisher: 'Test Publisher',
                status: 'Approved',
                work_format: 'Online',
                location: null,
                majors: { create: { major_id: major.category_id } },
                skills: {
                  create: [
                    { skill_id: closedSkill.category_id },
                    { skill_id: activeSkill.category_id },
                  ],
                },
                ...(years.length
                  ? {
                      years: {
                        create: years.map((academic_year) => ({
                          academic_year,
                        })),
                      },
                    }
                  : {}),
                ...overrides,
              },
            });
          const valid = await create(); // .4 + .3 + .3/2 = .85
          const equalDatetime = await create({
            opportunity_type: 'Việc làm',
            deadline: now,
            deadline_source_timezone: 'Asia/Ho_Chi_Minh',
          });
          const openDate = await create({
            opportunity_type: 'Học bổng',
            deadline: new Date('2026-11-06T17:00:00Z'),
            deadline_source_date: new Date('2026-11-06T00:00:00Z'),
          });
          const noYear = await create({}, []); // .55, not all years
          const noRequiredSkills = await create({ skills: undefined }); // 1
          const excluded = [];
          for (const overrides of [
            { status: 'Pending' },
            { status: 'Rejected' },
            { opportunity_type: 'Bài viết định hướng' },
            { opportunity_type: 'thực tập' },
            { opportunity_type: 'Thuc tap' },
            { deadline: new Date(now.getTime() + 1000) }, // future legacy unknown
            {
              deadline: new Date(now.getTime() - 1000),
              deadline_source_timezone: 'UTC',
            },
            {
              deadline: now,
              deadline_source_date: new Date('2026-11-05T00:00:00Z'),
            },
          ])
            excluded.push(await create(overrides));
          const tokens = createAccessTokenService(
            {
              signingSecret: 'recommendations-mysql-test-only-signing-secret',
              issuer: 'https://recommendations.test.invalid',
              audience: 'mysql-test',
            },
            () => now,
          );
          const token = await tokens.sign({
            userId: student.user_id,
            role: 'Student',
            sessionId,
          });
          // Share the fixture-owned RepeatableRead transaction so every fixture write
          // can be rolled back. Queries, joins and shared Auth use real Prisma/MySQL.
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
          const snapshot = async () => ({
            user: await tx.user.findUnique({
              where: { user_id: student.user_id },
              include: { skills: true },
            }),
            opportunities: await tx.opportunity.findMany({
              orderBy: { item_id: 'asc' },
            }),
            auditCount: await tx.activityLog.count(),
          });
          const before = await snapshot();
          const server = app.listen(0, '127.0.0.1');
          await once(server, 'listening');
          try {
            const base = `http://127.0.0.1:${server.address().port}/api/recommendations`;
            const request = () =>
              fetch(base, { headers: { Authorization: `Bearer ${token}` } });
            const response = await request();
            assert.equal(response.status, 200);
            const body = await response.json();
            assert.deepEqual(
              body.items.map(({ id, matchScore }) => [id, matchScore]),
              [
                [noRequiredSkills.item_id, 1],
                [equalDatetime.item_id, 0.85],
                [openDate.item_id, 0.85],
                [valid.item_id, 0.85],
                [noYear.item_id, 0.55],
              ],
            );
            assert.deepEqual(body.meta, {
              evaluatedAt: '2026-11-05T17:00:00Z',
            });
            assert.equal(body.items[1].deadline.state, 'open');
            assert.equal(
              body.items.some((item) =>
                excluded.some((row) => row.item_id === item.id),
              ),
              false,
            );
            assert.deepEqual(await snapshot(), before);
            await tx.category.update({
              where: { category_id: major.category_id },
              data: { status: 'Closed' },
            });
            await tx.category.update({
              where: { category_id: activeSkill.category_id },
              data: { status: 'Closed' },
            });
            assert.deepEqual(
              await (await request()).json(),
              body,
              'Closing linked categories must not change scores.',
            );
            await tx.user.update({
              where: { user_id: student.user_id },
              data: { academic_year: null },
            });
            const incomplete = await request();
            assert.equal(incomplete.status, 409);
            assert.equal(
              (await incomplete.json()).error.code,
              'PROFILE_INCOMPLETE',
            );
          } finally {
            await new Promise((resolve, reject) =>
              server.close((error) => (error ? reject(error) : resolve())),
            );
          }
          throw rollback;
        },
        { isolationLevel: 'RepeatableRead', timeout: 30000 },
      );
      assert.fail('Test fixtures must roll back.');
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await client.$disconnect();
    }
  },
);
