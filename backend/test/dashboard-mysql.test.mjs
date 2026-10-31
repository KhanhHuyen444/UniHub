import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalize, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { createPrismaClient } from '../dist/lib/prisma.js';
import { getOpportunityMetric } from '../dist/modules/dashboard/dashboard.service.js';

const url = process.env.TEST_DASHBOARD_DATABASE_URL;
test(
  'real MySQL: exact opportunity types under case-insensitive collation, zero statuses and no writes',
  { skip: !url && 'Dedicated runner not configured.' },
  async () => {
    const parsed = new URL(url);
    assert.equal(parsed.protocol, 'mysql:');
    assert.equal(parsed.hostname, '127.0.0.1');
    assert.match(parsed.pathname, /^\/unihub_dashboard_test_[a-f0-9]+$/);
    const identity = JSON.parse(
      process.env.TEST_DASHBOARD_MYSQL_IDENTITY ?? 'null',
    );
    assert.ok(
      identity,
      'Use dedicated runner; refuses an arbitrary existing server',
    );
    const p = createPrismaClient(url);
    try {
      const [server] =
        await p.$queryRaw`SELECT @@port AS port, @@datadir AS datadir, @@server_uuid AS uuid, @@collation_database AS collation`;
      assert.equal(Number(server.port), identity.port);
      assert.equal(server.uuid, identity.uuid);
      assert.equal(
        normalize(resolve(server.datadir)).toLowerCase(),
        normalize(resolve(identity.datadir)).toLowerCase(),
      );
      assert.equal(server.collation, 'utf8mb4_0900_as_ci');
      assert.equal(await p.opportunity.count(), 0);
      assert.equal(await p.user.count(), 0);
      const now = new Date('2026-10-31T00:00:00Z');
      const zero = await getOpportunityMetric(p, now);
      assert.deepEqual(zero.byStatus, { Pending: 0, Approved: 0, Rejected: 0 });
      const types = ['Thực tập', 'Việc làm', 'Học bổng'];
      const statuses = ['Pending', 'Approved', 'Rejected'];
      await p.opportunity.createMany({
        data: types.flatMap((opportunity_type) =>
          statuses.map((status) => ({
            opportunity_type,
            status,
            title: 'Isolated dashboard regression',
            publisher: 'Fixture only',
          })),
        ),
      });
      await p.opportunity.create({
        data: {
          opportunity_type: 'Thực tập',
          status: 'Approved',
          title: 'Additional valid',
          publisher: 'Fixture only',
        },
      });
      const wrongTypes = [
        'thực tập',
        'THỰC TẬP',
        'Thực Tập',
        'việc làm',
        'VIỆC LÀM',
        'Việc Làm',
        'học bổng',
        'HỌC BỔNG',
        'Học Bổng',
        'Bài viết định hướng',
      ];
      await p.opportunity.createMany({
        data: wrongTypes.flatMap((opportunity_type) =>
          statuses.map((status) => ({
            opportunity_type,
            status,
            title: 'Excluded type regression',
            publisher: 'Fixture only',
          })),
        ),
      });
      const old = await p.opportunity.groupBy({
        by: ['status'],
        where: { opportunity_type: { in: types } },
        _count: { _all: true },
      });
      assert.ok(
        old.find((x) => x.status === 'Approved')._count._all > 4,
        'Original query must reproduce the collation bug',
      );
      const before = await p.opportunity.findMany({
        orderBy: { item_id: 'asc' },
      });
      const actual = await getOpportunityMetric(p, now);
      assert.deepEqual(actual, {
        byStatus: { Pending: 3, Approved: 4, Rejected: 3 },
        evaluatedAt: '2026-10-31T00:00:00Z',
      });
      assert.deepEqual(
        await p.opportunity.findMany({ orderBy: { item_id: 'asc' } }),
        before,
      );
      assert.equal(await p.activityLog.count(), 0);
      await p.opportunity.deleteMany({
        where: { status: { in: ['Approved', 'Rejected'] } },
      });
      const missing = await getOpportunityMetric(p, now);
      assert.deepEqual(missing.byStatus, {
        Pending: 3,
        Approved: 0,
        Rejected: 0,
      });
      await mkdir('.cache/tv4', { recursive: true });
      await writeFile(
        '.cache/tv4/dashboard-mysql.json',
        JSON.stringify(
          {
            checkedAt: new Date().toISOString(),
            passed: true,
            collation: server.collation,
            ephemeralIdentityVerified: true,
            originalBugReproduced: true,
            wrongTypeVariants: wrongTypes,
            actual,
            missing,
            metricReadOnly: true,
            personalOrGroupDatabaseUsed: false,
          },
          null,
          2,
        ),
      );
    } finally {
      await p.$disconnect();
    }
  },
);
