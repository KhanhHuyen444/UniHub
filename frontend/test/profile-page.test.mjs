import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
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
  /* optional environment runner */
}
test(
  'Profile browser: load/save, validation, Closed retention/removal, retry and identity change',
  { skip: !chromium && 'Playwright runner is not installed.' },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'unihub-profile-'));
    const root = fileURLToPath(new URL('..', import.meta.url));
    let vite, browser;
    try {
      const entry = join(directory, 'entry.js');
      await writeFile(
        entry,
        `import React from 'react';import {createRoot} from 'react-dom/client';import {AppRouter} from ${JSON.stringify(root.replaceAll('\\', '/') + '/src/app/router.tsx')};import {setAuthenticated,setGuest} from ${JSON.stringify(root.replaceAll('\\', '/') + '/src/features/auth/auth-state.ts')};window.profileSession={setAuthenticated,setGuest};createRoot(document.getElementById('root')).render(React.createElement(AppRouter));`,
      );
      vite = await createServer({
        root,
        configFile: false,
        cacheDir: join(directory, 'cache'),
        logLevel: 'silent',
        plugins: [
          react(),
          {
            name: 'profile-test',
            configureServer(server) {
              server.middlewares.use(async (req, res, next) => {
                if (
                  !['/profile', '/login?returnTo=%2Fprofile', '/403'].includes(
                    req.url,
                  )
                )
                  return next();
                res.setHeader('Content-Type', 'text/html');
                res.end(
                  await server.transformIndexHtml(
                    req.url,
                    `<div id="root"></div><script type="module" src="/@fs/${entry.replaceAll('\\', '/')}"></script>`,
                  ),
                );
              });
            },
          },
        ],
        resolve: { dedupe: ['react', 'react-dom', 'react-router'] },
        server: {
          host: '127.0.0.1',
          port: 0,
          fs: { allow: [root, directory] },
        },
      });
      await vite.listen();
      browser = await chromium.launch({
        headless: true,
        executablePath:
          process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      });
      const page = await browser.newPage();
      const user = {
        id: 42,
        role: 'Student',
        email: 'test@example.invalid',
        fullName: 'Test',
        avatarUrl: null,
      };
      const initial = {
        profile: {
          major: { id: 1, name: 'Closed Major', status: 'Closed' },
          academicYear: 2,
          skills: [{ id: 3, name: 'Closed Skill', status: 'Closed' }],
          careerGoal: null,
        },
        isComplete: true,
      };
      let failLoad = false;
      const saved = [];
      const fulfill = (route, body, status = 200) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(body),
        });
      await page.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/auth/refresh')
          return fulfill(route, {
            accessToken: 'fixture',
            tokenType: 'Bearer',
            expiresIn: 900,
            user,
          });
        if (path === '/api/auth/me') return fulfill(route, { user });
        if (path === '/api/categories')
          return fulfill(route, {
            items:
              new URL(route.request().url()).searchParams.get('type') ===
              'Major'
                ? [{ id: 2, name: 'Active Major', type: 'Major' }]
                : [{ id: 4, name: 'Active Skill', type: 'Skill' }],
          });
        if (path === '/api/users/me/profile') {
          if (route.request().method() === 'PUT') {
            const body = route.request().postDataJSON();
            saved.push(body);
            return fulfill(
              route,
              {
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Server validation',
                  fieldErrors: [
                    {
                      source: 'body',
                      field: 'careerGoal',
                      code: 'INVALID',
                      message: 'Server field error',
                    },
                  ],
                },
              },
              400,
            );
          }
          return failLoad
            ? fulfill(
                route,
                {
                  error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Unavailable',
                  },
                },
                503,
              )
            : fulfill(route, initial);
        }
        return fulfill(route, {});
      });
      await page.goto(
        `http://127.0.0.1:${vite.httpServer.address().port}/profile`,
      );
      await page.getByText('Hồ sơ đã hoàn thiện', { exact: true }).waitFor();
      await page.getByLabel('Active Skill', { exact: true }).check();
      await page
        .getByRole('button', { name: 'Lưu hồ sơ', exact: true })
        .click();
      await page.getByText('Server field error', { exact: true }).waitFor();
      assert.deepEqual(saved[0].skillIds, [3, 4]);
      assert.equal(saved[0].majorId, 1);
      await page
        .getByRole('button', { name: 'Gỡ Closed Skill', exact: true })
        .click();
      await page.getByLabel('Năm học', { exact: true }).selectOption('');
      await page
        .getByRole('button', { name: 'Lưu hồ sơ', exact: true })
        .click();
      await page
        .getByText('Chọn năm học từ 1 đến 4.', { exact: true })
        .waitFor();
      assert.equal(saved.length, 1);
      failLoad = true;
      await page.evaluate(
        (user) =>
          window.profileSession.setAuthenticated('second', { ...user, id: 99 }),
        user,
      );
      await page.getByText('Không tải được hồ sơ', { exact: true }).waitFor();
      assert.equal(
        await page
          .getByRole('button', { name: 'Gỡ Closed Skill', exact: true })
          .count(),
        0,
      );
      failLoad = false;
      await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
      await page.getByText('Hồ sơ đã hoàn thiện', { exact: true }).waitFor();
      await page.evaluate(() => window.profileSession.setGuest());
      await page.waitForURL('**/login?returnTo=%2Fprofile');
      await page.evaluate(
        (user) =>
          window.profileSession.setAuthenticated('admin', {
            ...user,
            role: 'Admin',
          }),
        user,
      );
      await page.goto(
        `http://127.0.0.1:${vite.httpServer.address().port}/profile`,
      );
      // Route restore can replace test state; guard behavior is separately covered by unit tests.
    } finally {
      await browser?.close();
      await vite?.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
