import assert from 'node:assert/strict';
import { before, after, beforeEach, afterEach, test } from 'node:test';
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
  /* optional browser runner */
}
const options = { skip: !chromium && 'Playwright runner is not installed.' };
const root = fileURLToPath(new URL('..', import.meta.url));
let directory, vite, browser, page, base;
const active = {
  items: [
    { id: 31, name: 'SQL', type: 'Skill' },
    { id: 32, name: 'TypeScript', type: 'Skill' },
  ],
};
const fulfill = (route, body = active, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
before(async () => {
  if (!chromium) return;
  directory = await mkdtemp(join(tmpdir(), 'unihub-skill-options-'));
  const entry = join(directory, 'entry.js');
  await writeFile(
    entry,
    `
    import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
    import {setAccessToken} from ${JSON.stringify(root + '/src/features/auth/auth-state.ts')};
    import {SkillOptionsField} from ${JSON.stringify(root + '/src/features/categories/SkillOptionsField.tsx')};
    const e=React.createElement;
    function Harness() {
      const [token,setToken]=useState('student-test-token'); const [role,setRole]=useState('Student');
      const [ids,setIds]=useState([99]); const [visible,setVisible]=useState(true); const [disabled,setDisabled]=useState(false);
      setAccessToken(token);
      window.skillTest={setToken,setRole,setVisible,setDisabled};
      return e('form',{onSubmit:(event)=>{event.preventDefault();window.submitted=true;}},
        visible ? e(SkillOptionsField,{accessToken:token,role,selectedIds:ids,onChange:setIds,disabled}) : e('p',null,'Unmounted'),
        e('output',{'aria-label':'Selected IDs'},JSON.stringify(ids)));
    } createRoot(document.getElementById('root')).render(e(Harness));
  `,
  );
  vite = await createServer({
    root,
    configFile: false,
    plugins: [
      react(),
      {
        name: 'skill-options-test-only-harness',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url !== '/skill-options-test') return next();
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
    resolve: { dedupe: ['react', 'react-dom'] },
    server: { host: '127.0.0.1', port: 0, fs: { allow: [root, directory] } },
    logLevel: 'silent',
  });
  await vite.listen();
  base = `http://127.0.0.1:${vite.httpServer.address().port}`;
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
      (existsSync('/usr/bin/chromium')
        ? '/usr/bin/chromium'
        : chromium.executablePath()),
  });
});
beforeEach(async () => {
  if (!browser) return;
  page = await browser.newPage();
  await page.route('**/api/auth/refresh', (route) =>
    fulfill(
      route,
      { error: { code: 'UNAUTHORIZED', message: 'Expired fixture session' } },
      401,
    ),
  );
  await page.addInitScript(() => {
    window.skillRequests = [];
    const original = window.fetch;
    window.fetch = (input, init) => {
      if (String(input).startsWith('/api/'))
        window.skillRequests.push({ signal: init?.signal });
      return original(input, init);
    };
  });
});
afterEach(async () => {
  await page?.close();
});
after(async () => {
  await browser?.close();
  await vite?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});
const visible = (text) => page.getByText(text, { exact: true }).waitFor();

test(
  'loading then Active choices, controlled selection/deselection, preserve unlisted existing Profile IDs',
  options,
  async () => {
    let pending;
    await page.route('**/api/categories?type=Skill', (route) => {
      pending = route;
    });
    await page.goto(base + '/skill-options-test');
    await visible('Đang tải kỹ năng');
    await page.waitForFunction(() => window.skillRequests.length === 1);
    assert.equal(
      pending.request().headers().authorization,
      'Bearer student-test-token',
    );
    await fulfill(pending);
    await visible('SQL');
    await page.getByRole('checkbox', { name: 'SQL', exact: true }).check();
    assert.equal(
      await page.getByRole('status', { name: 'Selected IDs' }).textContent(),
      '[99,31]',
    );
    await page
      .getByRole('checkbox', { name: 'TypeScript', exact: true })
      .check();
    await page.getByRole('checkbox', { name: 'SQL', exact: true }).uncheck();
    assert.equal(await page.locator('output').textContent(), '[99,32]');
    await page.evaluate(() => window.skillTest.setDisabled(true));
    assert.equal(
      await page
        .getByRole('checkbox', { name: 'TypeScript', exact: true })
        .isDisabled(),
      true,
    );
  },
);

test(
  'server errors stay errors; retry succeeds without submitting the Profile form',
  options,
  async () => {
    let attempts = 0;
    await page.route('**/api/categories?type=Skill', (route) =>
      ++attempts === 1
        ? fulfill(
            route,
            { error: { code: 'SERVICE_UNAVAILABLE', message: 'Unavailable' } },
            503,
          )
        : fulfill(route),
    );
    await page.goto(base + '/skill-options-test');
    await visible('Không tải được kỹ năng');
    assert.equal(await page.getByRole('checkbox').count(), 0);
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await visible('SQL');
    assert.equal(attempts, 2);
    assert.equal(await page.evaluate(() => Boolean(window.submitted)), false);
  },
);

test(
  'empty is a distinct success; status-bearing Closed payload is rejected, never displayed',
  options,
  async () => {
    await page.route('**/api/categories?type=Skill', (route) =>
      fulfill(route, { items: [] }),
    );
    await page.goto(base + '/skill-options-test');
    await visible('Chưa có kỹ năng khả dụng');
    assert.equal(await page.getByRole('checkbox').count(), 0);
    await page.unroute('**/api/categories?type=Skill');
    await page.route('**/api/categories?type=Skill', (route) =>
      fulfill(route, {
        items: [
          {
            id: 99,
            name: 'Closed skill must not render',
            type: 'Skill',
            status: 'Closed',
          },
        ],
      }),
    );
    await page.evaluate(() => window.skillTest.setToken('new-token'));
    await visible('Không tải được kỹ năng');
    assert.equal(
      await page.getByText('Closed skill must not render').count(),
      0,
    );
  },
);

test(
  '401/403 hide choices, expose auth guidance and recover only when parent supplies a new token',
  options,
  async () => {
    await page.route('**/api/categories?type=Skill', (route) => {
      const auth = route.request().headers().authorization;
      return auth === 'Bearer refreshed-token'
        ? fulfill(route)
        : fulfill(
            route,
            {
              error: {
                code:
                  auth === 'Bearer admin-token' ? 'FORBIDDEN' : 'UNAUTHORIZED',
                message: 'Denied',
              },
            },
            auth === 'Bearer admin-token' ? 403 : 401,
          );
    });
    await page.goto(base + '/skill-options-test');
    await visible(
      'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
    );
    assert.equal(await page.getByRole('checkbox').count(), 0);
    await page.evaluate(() => window.skillTest.setToken('admin-token'));
    await visible('Tài khoản không có quyền truy cập Skill Options.');
    await page.evaluate(() => window.skillTest.setToken('refreshed-token'));
    await visible('SQL');
    await page.evaluate(() => {
      window.skillTest.setToken(null);
      window.skillTest.setRole(null);
    });
    await visible('Cần đăng nhập Student');
    assert.equal(await page.getByRole('checkbox').count(), 0);
  },
);

test(
  'Guest/Admin props make no additional requests; token change/unmount abort and ignore late data',
  options,
  async () => {
    const pending = [];
    await page.route('**/api/categories?type=Skill', (route) => {
      pending.push(route);
    });
    await page.goto(base + '/skill-options-test');
    await visible('Đang tải kỹ năng');
    await page.evaluate(() => window.skillTest.setToken('second-token'));
    await page.waitForFunction(
      () =>
        window.skillRequests.length === 2 &&
        window.skillRequests[0].signal.aborted,
    );
    await fulfill(pending[1]);
    await visible('SQL');
    await fulfill(pending[0], {
      items: [{ id: 88, name: 'Stale skill', type: 'Skill' }],
    }).catch(() => {});
    assert.equal(await page.getByText('Stale skill').count(), 0);
    await page.evaluate(() => window.skillTest.setRole('Admin'));
    await visible('Không có quyền chọn kỹ năng');
    assert.equal(await page.evaluate(() => window.skillRequests.length), 2);
    await page.evaluate(() => {
      window.skillTest.setToken(null);
      window.skillTest.setRole(null);
    });
    await visible('Cần đăng nhập Student');
    assert.equal(await page.evaluate(() => window.skillRequests.length), 2);
    await page.evaluate(() => {
      window.skillTest.setToken('third-token');
      window.skillTest.setRole('Student');
    });
    await page.waitForFunction(() => window.skillRequests.length === 3);
    await page.evaluate(() => window.skillTest.setVisible(false));
    await visible('Unmounted');
    await page.waitForFunction(() => window.skillRequests[2].signal.aborted);
  },
);
