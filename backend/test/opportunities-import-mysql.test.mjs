import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, normalize } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createPrismaClient } from '../dist/lib/prisma.js';
import { importCategories } from '../dist/scripts/opportunities-import.js';
const config = process.env.TEST_IMPORTER_MYSQL_CONFIG
  ? JSON.parse(process.env.TEST_IMPORTER_MYSQL_CONFIG)
  : null;
const catalog = JSON.parse(
  await readFile(
    new URL('../../data/catalog/initial-categories.json', import.meta.url),
    'utf8',
  ),
);
async function snapshot(p) {
  return {
    categories: await p.category.findMany({ orderBy: { category_id: 'asc' } }),
    opportunities: await p.opportunity.findMany({
      orderBy: { item_id: 'asc' },
    }),
    majors: await p.opportunityMajor.findMany(),
    skills: await p.opportunitySkill.findMany(),
    years: await p.opportunityYear.findMany(),
    users: await p.user.count(),
    logs: await p.activityLog.count(),
  };
}
test(
  'catalog importer on guarded isolated MySQL only',
  { skip: !config },
  async (t) => {
    const clients = {};
    const cases = [];
    const report = {
      environment:
        'fresh isolated MySQL; existing migrations; no personal/group configuration',
      cases,
    };
    try {
      for (const name of ['base', 'reuse', 'closed', 'rollback', 'identity']) {
        const u = new URL(config.urls[name]);
        assert.equal(u.hostname, '127.0.0.1');
        assert.equal(Number(u.port), config.port);
        assert.notEqual(config.port, 3306);
        assert.match(
          u.pathname,
          /^\/unihub_importer_test_[a-f0-9]+_(base|reuse|closed|rollback|identity)$/,
        );
        const p = createPrismaClient(u.toString());
        clients[name] = p;
        const [id] =
          await p.$queryRaw`SELECT @@port AS port, @@datadir AS datadir, @@server_uuid AS uuid, VERSION() AS version`;
        assert.equal(Number(id.port), config.port);
        assert.equal(
          normalize(resolve(id.datadir)).toLowerCase(),
          normalize(resolve(config.datadir)).toLowerCase(),
        );
        assert.equal(id.uuid, config.uuid);
        assert.match(id.version, /^8\.4\./);
        assert.match(id.datadir, /unihub-importer-mysql-/);
        report.serverVersion = id.version;
        assert.equal(await p.category.count(), 0);
        assert.equal(await p.opportunity.count(), 0);
        assert.equal(await p.user.count(), 0);
      }
      const p = clients.base;
      await t.test('default dry-run writes nothing', async () => {
        const before = await snapshot(p);
        const r = await importCategories(p, catalog);
        assert.equal(r.writes, 0);
        assert.equal(
          r.plan.categories.filter((c) => c.action === 'create').length,
          30,
        );
        assert.deepEqual(await snapshot(p), before);
        cases.push('dry-run: pass');
      });
      await t.test(
        'first apply creates exactly 11 Major and 19 Skill, no opportunities/accounts/logs',
        async () => {
          const r = await importCategories(p, catalog, { apply: true });
          assert.equal(r.created, 30);
          const s = await snapshot(p);
          assert.equal(
            s.categories.filter((c) => c.type === 'Major').length,
            11,
          );
          assert.equal(
            s.categories.filter((c) => c.type === 'Skill').length,
            19,
          );
          assert(s.categories.every((c) => c.status === 'Active'));
          assert.equal(
            s.opportunities.length +
              s.majors.length +
              s.skills.length +
              s.years.length +
              s.users +
              s.logs,
            0,
          );
          cases.push('first apply: 30 categories, no other writes');
        },
      );
      await t.test(
        'rerun is unchanged and dry-run proposes no new rows',
        async () => {
          const before = await snapshot(p);
          const r = await importCategories(p, catalog, { apply: true });
          assert.equal(r.created, 0);
          assert.equal(r.reused, 30);
          assert.deepEqual(await snapshot(p), before);
          assert(
            (await importCategories(p, catalog)).plan.categories.every(
              (c) => c.action === 'reuse',
            ),
          );
          cases.push('rerun: 0 create, 30 reuse, unchanged');
        },
      );
      await t.test(
        'reuse preserves spelling/IDs, same name different type and processed opportunity relations',
        async () => {
          const q = clients.reuse;
          const existing = await q.category.create({
            data: {
              type: catalog[0].type,
              name: catalog[0].name.toLowerCase(),
              status: 'Active',
            },
          });
          const other = await q.category.create({
            data: { type: 'Skill', name: catalog[0].name, status: 'Active' },
          });
          for (const status of ['Approved', 'Rejected'])
            await q.opportunity.create({
              data: {
                title: 'Isolated processed fixture',
                publisher: 'Isolated fixture publisher',
                opportunity_type: 'Thực tập',
                status,
                is_verified: status === 'Approved',
                majors: { create: { major_id: existing.category_id } },
                skills: { create: { skill_id: other.category_id } },
                years: { create: { academic_year: 3 } },
              },
            });
          const before = await snapshot(q);
          const r = await importCategories(q, catalog, { apply: true });
          assert.equal(r.created, 29);
          assert.equal(r.reused, 1);
          const after = await snapshot(q);
          assert.deepEqual(after.categories.slice(0, 2), before.categories);
          for (const k of [
            'opportunities',
            'majors',
            'skills',
            'years',
            'users',
            'logs',
          ])
            assert.deepEqual(after[k], before[k]);
          cases.push(
            'reuse: original rows and Approved/Rejected joins unchanged',
          );
        },
      );
      await t.test(
        'Closed blocks whole apply and is not reopened',
        async () => {
          const q = clients.closed;
          await q.category.create({
            data: { ...catalog.at(-1), status: 'Closed' },
          });
          const before = await snapshot(q);
          const r = await importCategories(q, catalog);
          assert.equal(r.plan.blocked, true);
          assert.equal(r.plan.categories.at(-1).reason, 'existing_not_active');
          await assert.rejects(
            importCategories(q, catalog, { apply: true }),
            /blocked/,
          );
          assert.deepEqual(await snapshot(q), before);
          cases.push('Closed: blocked, no writes');
        },
      );
      await t.test(
        'real UNIQUE error on third write rolls back the first two inserts',
        async () => {
          const q = clients.rollback;
          const before = await snapshot(q);
          let attempts = 0;
          const failing = q.$extends({
            query: {
              category: {
                async create({ args, query }) {
                  attempts++;
                  if (attempts === 3)
                    args.data = {
                      ...args.data,
                      type: catalog[0].type,
                      name: catalog[0].name,
                    };
                  return query(args);
                },
              },
            },
          });
          await assert.rejects(
            importCategories(failing, catalog, { apply: true }),
            (e) => e.code === 'P2002',
          );
          assert.equal(attempts, 3);
          assert.deepEqual(await snapshot(q), before);
          cases.push('rollback: real P2002 on third create; zero partial rows');
        },
      );
      await t.test(
        'existing migration rejects invalid type; importer does not bypass constraints',
        async () => {
          const q = clients.identity;
          await assert.rejects(
            q.category.create({
              data: { type: 'major', name: catalog[0].name, status: 'Active' },
            }),
          );
          const before = await snapshot(q);
          assert.equal(
            (await importCategories(q, catalog)).plan.blocked,
            false,
          );
          assert.deepEqual(await snapshot(q), before);
          cases.push('invalid type: rejected by existing CHECK; no bypass');
        },
      );
      await t.test(
        'actual CLI defaults to dry-run, applies explicitly, then reuses all rows',
        async () => {
          const command = promisify(execFile);
          const run = async (args) => {
            const { stdout } = await command(
              process.execPath,
              [
                'backend/dist/scripts/opportunities-import.js',
                '--catalog-only',
                ...args,
              ],
              {
                cwd: fileURLToPath(new URL('../..', import.meta.url)),
                env: { ...process.env, DATABASE_URL: config.urls.identity },
                windowsHide: true,
              },
            );
            return JSON.parse(stdout);
          };
          const q = clients.identity;
          const before = await snapshot(q);
          const dry = await run([]);
          assert.equal(dry.mode, 'dry-run');
          assert.equal(dry.writes, 0);
          assert.equal(
            dry.plan.categories.filter((c) => c.action === 'create').length,
            30,
          );
          assert.deepEqual(await snapshot(q), before);
          assert.equal((await run(['--apply'])).created, 30);
          const after = await snapshot(q);
          assert.equal((await run(['--apply'])).created, 0);
          assert(
            (await run(['--dry-run'])).plan.categories.every(
              (c) => c.action === 'reuse',
            ),
          );
          assert.deepEqual(await snapshot(q), after);
          cases.push(
            'CLI: default dry-run, explicit apply, repeat and final dry-run passed',
          );
        },
      );
      report.passed = true;
    } finally {
      await Promise.all(Object.values(clients).map((p) => p.$disconnect()));
      await writeFile(
        config.reportPath,
        JSON.stringify(report, null, 2) + '\n',
      );
    }
  },
);
