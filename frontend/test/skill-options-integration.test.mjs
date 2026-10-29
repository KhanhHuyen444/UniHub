import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  /* optional runner */
}
const databaseUrl = process.env.TEST_SKILL_OPTIONS_DATABASE_URL;
const root = fileURLToPath(new URL('..', import.meta.url));
test(
  'real FR–BK–MySQL: Student selects Active Skill, Closed omitted, Guest/Admin denied and invalid token handled',
  {
    skip: !databaseUrl
      ? 'TEST_SKILL_OPTIONS_DATABASE_URL is not configured.'
      : !chromium
        ? 'Playwright runner is not installed.'
        : false,
  },
  async () => {
    const url = new URL(databaseUrl);
    assert.ok(
      url.protocol === 'mysql:' &&
        ['127.0.0.1', 'localhost'].includes(url.hostname) &&
        /^unihub_skill_options_test[A-Za-z0-9_]*$/.test(
          decodeURIComponent(url.pathname.slice(1)),
        ),
      'Use only a disposable loopback unihub_skill_options_test* database.',
    );
    const { createApp } = await import('../../backend/dist/app.js');
    const { createPrismaClient } = await import(
      '../../backend/dist/lib/prisma.js'
    );
    const { createAccessTokenService } = await import(
      '../../backend/dist/modules/auth/access-token.js'
    );
    const client = createPrismaClient(databaseUrl);
    const rollback = new Error('Rollback Skill Options fixtures');
    const directory = await mkdtemp(
      join(tmpdir(), 'unihub-skill-options-integration-'),
    );
    let vite, browser, server;
    try {
      await client.$transaction(
        async (tx) => {
          assert.equal(
            await tx.user.count(),
            0,
            'Refuse a populated database.',
          );
          assert.equal(
            await tx.category.count(),
            0,
            'Refuse a populated database.',
          );
          const active = await tx.category.create({
            data: { type: 'Skill', name: 'Active SQL', status: 'Active' },
          });
          await tx.category.create({
            data: { type: 'Skill', name: 'Closed Java', status: 'Closed' },
          });
          await tx.category.create({
            data: { type: 'Major', name: 'Active Major', status: 'Active' },
          });
          const now = new Date('2026-10-29T00:00:00Z');
          const tokens = createAccessTokenService(
            {
              signingSecret: 'skill-options-integration-test-only-secret',
              issuer: 'https://skill-options.test.invalid',
              audience: 'skill-options-test',
            },
            () => now,
          );
          const signed = {};
          for (const [role, sessionId] of [
            ['Student', 'd7f55cee-2d7c-4df9-aece-36b6eb446db5'],
            ['Admin', 'e7f55cee-2d7c-4df9-aece-36b6eb446db5'],
          ]) {
            const user = await tx.user.create({
              data: {
                email: `${role.toLowerCase()}@skill-options.test.invalid`,
                full_name: `Test ${role}`,
                role,
              },
            });
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
          const app = createApp({
            categories: {
              getPrismaClient: () => tx,
              auth: {
                verifyToken: tokens.verify,
                now: () => now,
                getPrismaClient: () => tx,
              },
            },
          });
          server = app.listen(0, '127.0.0.1');
          await once(server, 'listening');
          const backend = `http://127.0.0.1:${server.address().port}`;
          for (const [token, expected, code] of [
            [null, 401, 'UNAUTHORIZED'],
            [signed.Admin, 403, 'FORBIDDEN'],
          ]) {
            const response = await fetch(
              `${backend}/api/categories?type=Skill`,
              token ? { headers: { Authorization: `Bearer ${token}` } } : {},
            );
            assert.equal(response.status, expected);
            assert.equal((await response.json()).error.code, code);
          }
          const studentResponse = await fetch(
            `${backend}/api/categories?type=Skill`,
            { headers: { Authorization: `Bearer ${signed.Student}` } },
          );
          assert.equal(studentResponse.status, 200);
          assert.deepEqual(await studentResponse.json(), {
            items: [
              { id: active.category_id, name: 'Active SQL', type: 'Skill' },
            ],
          });
          const entry = join(directory, 'entry.js');
          await writeFile(
            entry,
            `
        import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
        import {SkillOptionsField} from ${JSON.stringify(root + '/src/features/categories/SkillOptionsField.tsx')};
        const e=React.createElement;
        function Harness() {const [token,setToken]=useState(null);const [ids,setIds]=useState([]);
          window.setSkillTestToken=setToken;
          return e('div',null,e(SkillOptionsField,{accessToken:token,role:token?'Student':null,selectedIds:ids,onChange:setIds}),
            e('output',null,JSON.stringify(ids)));}
        createRoot(document.getElementById('root')).render(e(Harness));
      `,
          );
          vite = await createServer({
            root,
            configFile: false,
            plugins: [
              react(),
              {
                name: 'skill-options-integration-test-only-document',
                configureServer(viteServer) {
                  viteServer.middlewares.use(
                    async (request, response, next) => {
                      if (request.url !== '/skill-options-test') return next();
                      response.setHeader('Content-Type', 'text/html');
                      response.end(
                        await viteServer.transformIndexHtml(
                          request.url,
                          `<div id="root"></div><script type="module" src="/@fs/${entry}"></script>`,
                        ),
                      );
                    },
                  );
                },
              },
            ],
            resolve: { dedupe: ['react', 'react-dom'] },
            server: {
              host: '127.0.0.1',
              port: 0,
              fs: { allow: [root, directory] },
              proxy: { '/api': { target: backend, changeOrigin: true } },
            },
            logLevel: 'silent',
          });
          await vite.listen();
          browser = await chromium.launch({
            headless: true,
            executablePath:
              process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
              (existsSync('/usr/bin/chromium')
                ? '/usr/bin/chromium'
                : chromium.executablePath()),
          });
          const page = await browser.newPage();
          await page.goto(
            `http://127.0.0.1:${vite.httpServer.address().port}/skill-options-test`,
          );
          await page
            .getByText('Cần đăng nhập Student', { exact: true })
            .waitFor();
          await page.evaluate(
            (token) => window.setSkillTestToken(token),
            signed.Student,
          );
          const checkbox = page.getByRole('checkbox', {
            name: 'Active SQL',
            exact: true,
          });
          await checkbox.waitFor();
          assert.equal(await page.getByRole('checkbox').count(), 1);
          assert.equal(
            await page.getByText('Closed Java', { exact: true }).count(),
            0,
          );
          await checkbox.check();
          assert.equal(
            await page.locator('output').textContent(),
            JSON.stringify([active.category_id]),
          );
          await page.evaluate(() => window.setSkillTestToken('invalid-token'));
          await page
            .getByText(
              'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
              { exact: true },
            )
            .waitFor();
          assert.equal(await page.getByRole('checkbox').count(), 0);
          await page.evaluate(
            (token) => window.setSkillTestToken(token),
            signed.Student,
          );
          await checkbox.waitFor();
          assert.equal(await checkbox.isChecked(), true);
          assert.equal(await tx.category.count(), 3);
          assert.equal(await tx.activityLog.count(), 0);
          throw rollback;
        },
        { timeout: 60000 },
      );
      assert.fail('Test fixture transaction must roll back.');
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await browser?.close();
      await vite?.close();
      if (server)
        await new Promise((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      await client.$disconnect();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
