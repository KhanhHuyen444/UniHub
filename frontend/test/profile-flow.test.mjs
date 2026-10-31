import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
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
  /* optional test runner */
}
const options = { skip: !chromium && 'Playwright runner is unavailable.' };
let vite, browser, directory, base;
before(async () => {
  if (!chromium) return;
  const root = fileURLToPath(new URL('..', import.meta.url)).replaceAll(
    '\\',
    '/',
  );
  directory = await mkdtemp(join(tmpdir(), 'unihub-profile-flow-'));
  const entry = join(directory, 'entry.js').replaceAll('\\', '/');
  await writeFile(
    entry,
    `import React from 'react';import {createRoot} from 'react-dom/client';import {AppRouter} from ${JSON.stringify(root + '/src/app/router.tsx')};createRoot(document.getElementById('root')).render(React.createElement(AppRouter));`,
  );
  vite = await createServer({
    root,
    configFile: false,
    envFile: false,
    cacheDir: join(directory, 'cache'),
    define: {
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(
        'fixture.apps.googleusercontent.com',
      ),
    },
    plugins: [
      react(),
      {
        name: 'profile-flow-document',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const path = new URL(req.url, 'http://fixture.invalid').pathname;
            if (
              ![
                '/',
                '/login',
                '/profile',
                '/recommendations',
                '/opportunities',
                '/_dev/health',
                '/admin/opportunities',
                '/403',
              ].includes(path)
            )
              return next();
            res.setHeader('Content-Type', 'text/html');
            res.end(
              await server.transformIndexHtml(
                req.url,
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
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });
  base = `http://127.0.0.1:${vite.httpServer.address().port}`;
});
after(async () => {
  await browser?.close();
  await vite?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});
const complete = {
  profile: {
    major: { id: 1, name: 'Major', status: 'Active' },
    academicYear: 2,
    skills: [{ id: 2, name: 'Skill', status: 'Active' }],
    careerGoal: null,
  },
  isComplete: true,
};
const incomplete = {
  profile: { major: null, academicYear: null, skills: [], careerGoal: null },
  isComplete: false,
};
async function fixture(
  {
    profile = incomplete,
    loggedIn = false,
    role = 'Student',
    profileFailure = false,
    saveFailure = false,
    expireRecommendations = false,
    rejectRefresh = false,
  } = {},
  run,
) {
  const page = await browser.newPage();
  const calls = [];
  let refreshes = 0;
  const user = {
    id: 42,
    fullName: 'Fixture Student',
    email: 'fixture@example.invalid',
    avatarUrl: null,
    role,
  };
  const token = {
    accessToken: 'fixture-token',
    tokenType: 'Bearer',
    expiresIn: 900,
    user,
  };
  await page.addInitScript(() => {
    window.google = {
      accounts: {
        id: {
          initialize({ callback }) {
            window.fixtureGoogleLogin = callback;
          },
          renderButton(parent) {
            const button = document.createElement('button');
            button.textContent = 'Fixture Google';
            button.onclick = () =>
              window.fixtureGoogleLogin({ credential: 'fixture-id-token' });
            parent.append(button);
          },
        },
      },
    };
  });
  const send = (route, body, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  const error = (route, code, status) =>
    send(route, { error: { code, message: 'Fixture failure' } }, status);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    calls.push([path, route.request().method()]);
    if (path === '/api/auth/refresh') {
      refreshes++;
      if (!loggedIn || (rejectRefresh && refreshes > 1))
        return error(route, 'UNAUTHORIZED', 401);
      return send(route, {
        ...token,
        accessToken: refreshes > 1 ? 'rotated-token' : token.accessToken,
      });
    }
    if (path === '/api/auth/google') {
      loggedIn = true;
      return send(route, token);
    }
    if (path === '/api/auth/me') return send(route, { user });
    if (path === '/api/users/me/profile') {
      if (route.request().method() === 'PUT')
        return saveFailure
          ? error(route, 'SERVICE_UNAVAILABLE', 503)
          : send(route, complete);
      return profileFailure
        ? error(route, 'SERVICE_UNAVAILABLE', 503)
        : send(route, profile);
    }
    if (path === '/api/categories')
      return send(route, {
        items: [
          {
            id:
              new URL(route.request().url()).searchParams.get('type') ===
              'Major'
                ? 1
                : 2,
            name:
              new URL(route.request().url()).searchParams.get('type') ===
              'Major'
                ? 'Major'
                : 'Skill',
            type: new URL(route.request().url()).searchParams.get('type'),
          },
        ],
      });
    if (path === '/api/recommendations') {
      if (
        expireRecommendations &&
        route.request().headers().authorization !== 'Bearer rotated-token'
      )
        return error(route, 'UNAUTHORIZED', 401);
      return send(route, {
        items: [],
        meta: { evaluatedAt: '2026-10-31T00:00:00Z' },
      });
    }
    return send(route, {});
  });
  try {
    await run({
      page,
      calls,
      recover: () => {
        profileFailure = false;
      },
    });
  } finally {
    await page.close();
  }
}
const login = async (page, suffix = '') => {
  await page.goto(base + '/login' + suffix);
  await page
    .getByRole('button', { name: 'Fixture Google', exact: true })
    .click();
};
test(
  'Google Login: incomplete Student overrides returnTo; defer goes home without PUT or a Profile loop',
  options,
  async () => {
    await fixture({}, async ({ page, calls }) => {
      await login(page, '?returnTo=%2Frecommendations');
      await page.waitForURL(base + '/profile');
      await page.getByRole('link', { name: 'Để sau', exact: true }).click();
      await page.waitForURL(base + '/_dev/health');
      assert.equal(calls.filter(([, method]) => method === 'PUT').length, 0);
      await page.goto(base + '/opportunities');
      await page
        .getByRole('heading', { name: 'Khám phá Cơ hội', exact: true })
        .waitFor();
      assert.equal(new URL(page.url()).pathname, '/opportunities');
    });
  },
);
test(
  'Google Login: complete Student goes home by default',
  options,
  async () => {
    await fixture({ profile: complete }, async ({ page }) => {
      await login(page);
      await page.waitForURL(base + '/_dev/health');
    });
  },
);
test('complete Student retains a safe explicit returnTo', options, async () => {
  await fixture({ profile: complete }, async ({ page }) => {
    await login(page, '?returnTo=%2Frecommendations');
    await page.waitForURL(base + '/recommendations');
    await page.getByText('Chưa có cơ hội phù hợp', { exact: true }).waitFor();
  });
});
test(
  'profile check error stays on Login with retry, never assumes complete',
  options,
  async () => {
    await fixture({ profileFailure: true }, async ({ page, recover }) => {
      await login(page);
      await page
        .getByText('Không kiểm tra được hồ sơ', { exact: true })
        .waitFor();
      assert.equal(new URL(page.url()).pathname, '/login');
      recover();
      await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
      await page.waitForURL(base + '/profile');
    });
  },
);
test(
  'successful Profile PUT goes home and shows confirmation despite returnTo',
  options,
  async () => {
    await fixture(
      { profile: complete, loggedIn: true },
      async ({ page, calls }) => {
        await page.goto(base + '/profile?returnTo=%2Frecommendations');
        await page
          .getByRole('button', { name: 'Lưu hồ sơ', exact: true })
          .click();
        await page.waitForURL(base + '/_dev/health');
        await page
          .getByText('Cập nhật hồ sơ thành công', { exact: true })
          .waitFor();
        assert.equal(calls.filter(([, method]) => method === 'PUT').length, 1);
      },
    );
  },
);
test(
  'failed Profile PUT keeps inputs and does not navigate',
  options,
  async () => {
    await fixture(
      { profile: complete, loggedIn: true, saveFailure: true },
      async ({ page }) => {
        await page.goto(base + '/profile');
        await page
          .getByLabel('Vị trí nghề nghiệp mục tiêu', { exact: true })
          .fill('Keep this goal');
        await page
          .getByRole('button', { name: 'Lưu hồ sơ', exact: true })
          .click();
        await page
          .getByText('Fixture failure (SERVICE_UNAVAILABLE)', { exact: true })
          .waitFor();
        assert.equal(new URL(page.url()).pathname, '/profile');
        assert.equal(
          await page
            .getByLabel('Vị trí nghề nghiệp mục tiêu', { exact: true })
            .inputValue(),
          'Keep this goal',
        );
      },
    );
  },
);
test(
  'Admin login never requests Student Profile; Student guard still forbids Admin',
  options,
  async () => {
    await fixture({ role: 'Admin' }, async ({ page, calls }) => {
      await login(page);
      await page.waitForURL(base + '/admin/dashboard');
      await page.goto(base + '/profile');
      await page.waitForURL(base + '/403');
      assert.equal(
        calls.filter(([path]) => path === '/api/users/me/profile').length,
        0,
      );
    });
  },
);

test(
  'Recommendations expired token refreshes in the browser and renders without login navigation',
  options,
  async () => {
    await fixture(
      { loggedIn: true, profile: complete, expireRecommendations: true },
      async ({ page, calls }) => {
        await page.goto(base + '/recommendations');
        await page
          .getByText('Chưa có cơ hội phù hợp', { exact: true })
          .waitFor();
        assert.equal(new URL(page.url()).pathname, '/recommendations');
        assert.equal(
          calls.filter(([path]) => path === '/api/auth/refresh').length,
          2,
        );
        assert.ok(
          calls.filter(([path]) => path === '/api/recommendations').length <= 3,
        );
      },
    );
  },
);

test(
  'Recommendations refresh rejection shows Login and stays there without a redirect loop',
  options,
  async () => {
    await fixture(
      { loggedIn: true, expireRecommendations: true, rejectRefresh: true },
      async ({ page, calls }) => {
        await page.goto(base + '/recommendations');
        await page.waitForURL(base + '/login?returnTo=%2Frecommendations');
        await page
          .getByRole('button', { name: 'Fixture Google', exact: true })
          .waitFor();
        assert.equal(new URL(page.url()).pathname, '/login');
        assert.equal(
          calls.filter(([path]) => path === '/api/auth/refresh').length,
          2,
        );
        assert.equal(
          calls.filter(([path]) => path === '/api/recommendations').length,
          1,
        );
      },
    );
  },
);
