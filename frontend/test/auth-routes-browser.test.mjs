import assert from 'node:assert/strict';
import { before, after, beforeEach, afterEach, test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  /* optional environment runner */
}
const options = {
  skip:
    !chromium &&
    'Playwright is unavailable; browser route integration was not verified.',
};
let directory, vite, browser, page, base;
const user = (role = 'Student', id = 1) => ({
  id,
  role,
  email: `user${id}@example.invalid`,
  fullName: `User ${id}`,
  avatarUrl: null,
});
const fulfill = (route, body, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
const session = (role = 'Student', id = 1, rotated = false) => ({
  accessToken: rotated ? 'fixture-rotated' : 'fixture-initial',
  tokenType: 'Bearer',
  expiresIn: 900,
  user: user(role, id),
});
const fail = (route, status = 401, code = 'UNAUTHORIZED') =>
  fulfill(route, { error: { code, message: 'Fixture error' } }, status);
const recommendations = (title) => ({
  items: [
    {
      id: 99,
      type: 'Thực tập',
      title,
      publisher: 'Fixture',
      workFormat: 'Hybrid',
      location: 'Hà Nội',
      deadline: null,
      isVerified: true,
      matchScore: 0.75,
    },
  ],
  meta: { evaluatedAt: '2026-11-05T17:00:00Z' },
});
before(async () => {
  if (!chromium) return;
  directory = await mkdtemp(join(tmpdir(), 'unihub-auth-routes-'));
  const root = fileURLToPath(new URL('..', import.meta.url));
  const entry = join(directory, 'entry.jsx');
  await writeFile(
    entry,
    `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {AppRouter} from ${JSON.stringify(root + '/src/app/router.tsx')};
    import {logoutCurrentSession,loginWithGoogleIdToken,protectedApiRequest} from ${JSON.stringify(root + '/src/features/auth/auth-api.ts')};
    window.authRouteTest={logout:logoutCurrentSession,login:()=>loginWithGoogleIdToken('fixture-google'),rotate:()=>protectedApiRequest('/api/auth-probe')};
    createRoot(document.getElementById('root')).render(<AppRouter/>);
  `,
  );
  vite = await createServer({
    root,
    configFile: false,
    cacheDir: join(directory, 'cache'),
    plugins: [
      react(),
      {
        name: 'auth-route-test-document',
        configureServer(server) {
          server.middlewares.use(async (request, response, next) => {
            if (!request.headers.accept?.includes('text/html')) return next();
            response.setHeader('Content-Type', 'text/html');
            response.end(
              await server.transformIndexHtml(
                request.url,
                `<div id="root"></div><script type="module" src="/@fs/${entry}"></script>`,
              ),
            );
          });
        },
      },
    ],
    resolve: { dedupe: ['react', 'react-dom', 'react-router'] },
    server: { host: '127.0.0.1', port: 0, fs: { allow: [root, directory] } },
    logLevel: 'silent',
  });
  await vite.listen();
  base = `http://127.0.0.1:${vite.httpServer.address().port}`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
});
beforeEach(async () => {
  if (browser) page = await browser.newPage();
});
afterEach(async () => {
  await page?.close();
});
after(async () => {
  await browser?.close();
  await vite?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function auth(role = 'Student', id = 1) {
  await page.route('**/api/auth/refresh', (route) =>
    fulfill(route, session(role, id)),
  );
  await page.route('**/api/auth/me', (route) =>
    fulfill(route, { user: user(role, id) }),
  );
  await page.route('**/api/auth/logout', (route) =>
    route.fulfill({ status: 204 }),
  );
}
const visible = (text) =>
  page.getByText(text, { exact: true }).first().waitFor();
for (const path of [
  '/recommendations?from=nav#saved',
  '/admin/categories?type=Major#table',
]) {
  test(
    `Guest redirects with exact safe return path: ${path}`,
    options,
    async () => {
      await page.route('**/api/auth/refresh', (route) => fail(route));
      let privateRequests = 0;
      await page.route('**/api/recommendations', (route) => {
        privateRequests += 1;
        return fulfill(route, recommendations('Forbidden'));
      });
      await page.route('**/api/admin/categories*', (route) => {
        privateRequests += 1;
        return fulfill(route, { items: [] });
      });
      await page.goto(base + path);
      await page.waitForURL((url) => url.pathname === '/login');
      assert.equal(new URL(page.url()).searchParams.get('returnTo'), path);
      assert.equal(privateRequests, 0);
    },
  );
}
for (const [path, role] of [
  ['/recommendations', 'Admin'],
  ['/admin/categories', 'Student'],
  ['/admin/opportunities', 'Student'],
]) {
  test(`wrong role redirects ${path} to /403`, options, async () => {
    await auth(role);
    await page.goto(base + path);
    await page.waitForURL('**/403');
    await visible('Bạn không có quyền truy cập');
  });
}
test(
  'restore blocks content; Student sees Recommendations and honest Profile dependency',
  options,
  async () => {
    let release;
    await page.route('**/api/auth/refresh', (route) => {
      release = () => fulfill(route, session());
    });
    await page.route('**/api/auth/me', (route) =>
      fulfill(route, { user: user() }),
    );
    let requests = 0;
    await page.route('**/api/recommendations', (route) => {
      requests += 1;
      return fail(route, 409, 'PROFILE_INCOMPLETE');
    });
    await page.goto(base + '/recommendations');
    await visible('Đang khôi phục phiên…');
    assert.equal(requests, 0);
    await release();
    await visible('Cần hoàn thiện hồ sơ');
    assert.equal(
      await page
        .getByRole('button', { name: 'Hoàn thiện hồ sơ', exact: true })
        .count(),
      0,
    );
    assert.equal(await page.locator('a[href="/profile"]').count(), 0);
  },
);
test(
  'Admin Categories uses real shell and logout clears content and returns to login',
  options,
  async () => {
    await auth('Admin');
    await page.route('**/api/admin/categories*', (route) =>
      fulfill(route, {
        items: [
          { id: 1, name: 'Old Category', type: 'Major', status: 'Active' },
        ],
      }),
    );
    await page.goto(base + '/admin/categories');
    await visible('Old Category');
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/login');
    assert.equal(
      await page.getByText('Old Category', { exact: true }).count(),
      0,
    );
  },
);
test(
  'token rotation reloads Recommendations; consumer 401 does not secretly refresh',
  options,
  async () => {
    await auth();
    let rotated = false;
    await page.route('**/api/auth/refresh', (route) =>
      fulfill(route, session('Student', 1, rotated)),
    );
    await page.route('**/api/auth-probe', (route) =>
      rotated ? fulfill(route, { ok: true }) : ((rotated = true), fail(route)),
    );
    await page.route('**/api/recommendations', (route) =>
      fulfill(route, recommendations(rotated ? 'New Result' : 'Old Result')),
    );
    await page.goto(base + '/recommendations');
    await visible('Old Result');
    await page.evaluate(() => window.authRouteTest.rotate());
    await visible('New Result');
    assert.equal(
      await page.getByText('Old Result', { exact: true }).count(),
      0,
    );
    let refreshes = 0;
    await page.route('**/api/auth/refresh', (route) => {
      refreshes += 1;
      return fulfill(route, session());
    });
    await page.route('**/api/recommendations', (route) => fail(route));
    await page.reload(); // one startup restore, no automatic consumer refresh
    await visible('Phiên đăng nhập không hợp lệ');
    assert.equal(refreshes, 1);
  },
);
test(
  'switching user discards late response from old account',
  options,
  async () => {
    await auth();
    let oldRoute;
    let count = 0;
    await page.route('**/api/recommendations', (route) =>
      ++count === 1
        ? ((oldRoute = route), undefined)
        : fulfill(route, recommendations('User Two Result')),
    );
    await page.goto(base + '/recommendations');
    await visible('Đang tải cơ hội phù hợp');
    await page.waitForFunction(() => Boolean(window.authRouteTest));
    await page.route('**/api/auth/google', (route) =>
      fulfill(route, session('Student', 2, true)),
    );
    await page.route('**/api/auth/me', (route) =>
      fulfill(route, { user: user('Student', 2) }),
    );
    await page.evaluate(() => window.authRouteTest.login());
    await visible('User Two Result');
    await fulfill(oldRoute, recommendations('Old Private Result')).catch(
      () => undefined,
    );
    assert.equal(
      await page.getByText('Old Private Result', { exact: true }).count(),
      0,
    );
  },
);

for (const serverStatus of [204, 503]) {
  test(
    `Student logout clears data immediately; server ${serverStatus} is reported honestly`,
    options,
    async () => {
      await auth();
      await page.route('**/api/recommendations', (route) =>
        fulfill(route, recommendations('Private Student Result')),
      );
      let pending;
      let started;
      const requestStarted = new Promise((resolve) => {
        started = resolve;
      });
      let calls = 0;
      await page.route('**/api/auth/logout', (route) => {
        calls += 1;
        pending = route;
        started();
      });
      await page.goto(base + '/recommendations');
      await visible('Private Student Result');
      await page.evaluate(() => {
        const button = document.querySelector('button[aria-label="Đăng xuất"]');
        button.click();
        button.click();
      });
      await requestStarted;
      await page.waitForURL((url) => url.pathname === '/login');
      assert.equal(
        await page.getByText('Private Student Result', { exact: true }).count(),
        0,
      );
      assert.equal(await page.getByText('User 1', { exact: true }).count(), 0);
      assert.equal(calls, 1);
      if (serverStatus === 204) {
        await pending.fulfill({ status: 204 });
      } else {
        await fail(pending, 503, 'SERVICE_UNAVAILABLE');
        await page
          .getByText(
            'Đã đăng xuất trên thiết bị này; máy chủ chưa xác nhận thu hồi phiên.',
            { exact: true },
          )
          .waitFor();
      }
      assert.equal(
        await page.getByText('Private Student Result', { exact: true }).count(),
        0,
      );
    },
  );
}
