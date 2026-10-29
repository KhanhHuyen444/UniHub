import assert from 'node:assert/strict';
import { before, after, beforeEach, afterEach, test } from 'node:test';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

// Optional browser runner provided by the execution environment, not an app dependency.
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  /* See README for browser prerequisite. */
}
const options = {
  skip:
    !chromium &&
    'Playwright browser runner is not installed in this environment.',
};
const root = fileURLToPath(new URL('..', import.meta.url));
let directory, vite, browser, page, base;
const majors = {
  items: [
    { id: 4, name: 'Major A', type: 'Major' },
    { id: 7, name: 'Major B', type: 'Major' },
  ],
};
const roadmap = (id = 4, title = 'First article') => ({
  selectedMajor: { id, name: id === 4 ? 'Major A' : 'Major B', type: 'Major' },
  stages: [
    {
      academicYear: 1,
      items: [
        {
          id: 81,
          title,
          requiredSkills: [{ id: 31, name: 'SQL' }],
          createdAt: '2026-10-01T00:00:00Z',
        },
      ],
    },
    {
      academicYear: 4,
      items: [
        {
          id: 82,
          title: 'Second article',
          requiredSkills: [],
          createdAt: '2026-10-01T00:00:00Z',
        },
      ],
    },
  ],
});
const detail = {
  item: {
    id: 81,
    title: 'Article detail',
    publisher: 'Test publisher',
    descriptionText: '<img src=x onerror="window.compromised=true">',
    requirementsText: 'Plain requirements',
    majors: [{ id: 4, name: 'Old Major', status: 'Closed' }],
    skills: [{ id: 31, name: 'Old Skill', status: 'Closed' }],
    academicYears: [],
    createdAt: '2026-10-01T00:00:00Z',
  },
};
const fulfill = (route, body, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

before(async () => {
  if (!chromium) return;
  directory = await mkdtemp(join(tmpdir(), 'unihub-guidance-pages-'));
  const entry = join(directory, 'entry.js');
  await writeFile(
    entry,
    `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {BrowserRouter, Routes, Route, Link} from 'react-router';
    import {GuidanceRoadmapPage} from ${JSON.stringify(root + '/src/features/guidance/GuidanceRoadmapPage.tsx')};
    import {GuidanceDetailPage} from ${JSON.stringify(root + '/src/features/guidance/GuidanceDetailPage.tsx')};
    const e = React.createElement;
    createRoot(document.getElementById('root')).render(e(BrowserRouter, null,
      e(Link, {to:'/off'}, 'Unmount test page'),
      e(Link, {to:'/roadmaps/82'}, 'Switch detail test page'),
      e(Routes,null,
        e(Route,{path:'/roadmaps',element:e(GuidanceRoadmapPage)}),
        e(Route,{path:'/roadmaps/:id',element:e(GuidanceDetailPage)}),
        e(Route,{path:'/off',element:e('p',null,'Unmounted')})
      )
    ));
  `,
  );
  vite = await createServer({
    root,
    configFile: false,
    plugins: [
      react(),
      {
        name: 'guidance-test-only-document',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.url.startsWith('/roadmaps') && req.url !== '/off')
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
  await page.addInitScript(() => {
    window.guidanceSignals = [];
    const original = window.fetch;
    window.fetch = (input, init) => {
      if (String(input).startsWith('/api/'))
        window.guidanceSignals.push({
          path: String(input),
          signal: init?.signal,
        });
      return original(input, init);
    };
  });
  await page.route('**/api/categories?type=Major', (route) =>
    fulfill(route, majors),
  );
});
afterEach(async () => {
  await page?.close();
});
after(async () => {
  await browser?.close();
  await vite?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function visible(text) {
  await page.getByText(text, { exact: true }).waitFor();
}

test(
  'roadmap loading, backend stage/item order, skills and detail navigation',
  options,
  async () => {
    let pending;
    await page.route('**/api/guidance', (route) => {
      pending = route;
    });
    await page.route('**/api/guidance/81', (route) => fulfill(route, detail));
    await page.goto(base + '/roadmaps');
    await visible('Đang tải lộ trình');
    await page.waitForFunction(() =>
      window.guidanceSignals.some((r) => r.path === '/api/guidance'),
    );
    await fulfill(pending, roadmap());
    await visible('First article');
    assert.deepEqual(await page.locator('main h2').allTextContents(), [
      'Major A',
      'Năm 1',
      'Năm 4',
    ]);
    assert.deepEqual(await page.locator('main a').allTextContents(), [
      'First article',
      'Second article',
    ]);
    await visible('SQL');
    await page.getByRole('link', { name: 'First article' }).click();
    await visible('Article detail');
    assert.ok(page.url().endsWith('/roadmaps/81'));
  },
);

test(
  'select Active Major updates query; history navigation reloads the previous selection',
  options,
  async () => {
    await page.route('**/api/guidance*', (route) =>
      fulfill(
        route,
        roadmap(
          new URL(route.request().url()).searchParams.get('majorId') === '7'
            ? 7
            : 4,
        ),
      ),
    );
    await page.goto(base + '/roadmaps?majorId=4');
    await visible('First article');
    await page.locator('#guidance-major').selectOption('7');
    await page.waitForURL('**/roadmaps?majorId=7');
    await page.waitForFunction(
      () => document.querySelector('#guidance-major').value === '7',
    );
    await page.goBack();
    await page.waitForURL('**/roadmaps?majorId=4');
    await page.waitForFunction(
      () => document.querySelector('#guidance-major').value === '4',
    );
  },
);

test(
  'no Major and no roadmap are empty states without fabricated years/articles',
  options,
  async () => {
    for (const response of [
      { selectedMajor: null, stages: [] },
      { selectedMajor: { id: 4, name: 'Major A', type: 'Major' }, stages: [] },
    ]) {
      await page.route('**/api/guidance', (route) => fulfill(route, response));
      await page.goto(base + '/roadmaps');
      await visible(
        response.selectedMajor
          ? 'Lộ trình cho chuyên ngành này đang được biên soạn'
          : 'Chưa có chuyên ngành khả dụng',
      );
      assert.equal(await page.locator('main a[href^="/roadmaps/"]').count(), 0);
      assert.equal(await page.locator('main h2').count(), 0);
      await page.unroute('**/api/guidance');
    }
  },
);

test(
  '400/500/503 list errors stay errors; Retry succeeds and invalid filter can be cleared',
  options,
  async () => {
    for (const [status, code] of [
      [400, 'INVALID_FILTER'],
      [500, 'INTERNAL_ERROR'],
      [503, 'SERVICE_UNAVAILABLE'],
    ]) {
      let requests = 0;
      await page.route('**/api/guidance*', (route) =>
        fulfill(
          route,
          ++requests === 1
            ? { error: { code, message: 'Test failure' } }
            : roadmap(),
          requests === 1 ? status : 200,
        ),
      );
      await page.goto(base + '/roadmaps?majorId=4');
      await page.getByRole('alert').waitFor();
      assert.ok((await page.getByRole('alert').innerText()).includes(code));
      assert.equal(
        await page
          .getByText('Lộ trình cho chuyên ngành này đang được biên soạn', {
            exact: true,
          })
          .count(),
        0,
      );
      await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
      await visible('First article');
      await page.unroute('**/api/guidance*');
    }
    await page.route('**/api/guidance*', (route) =>
      new URL(route.request().url()).search
        ? fulfill(
            route,
            { error: { code: 'INVALID_FILTER', message: 'Closed' } },
            400,
          )
        : fulfill(route, roadmap()),
    );
    await page.goto(base + '/roadmaps?majorId=99');
    await visible('Chuyên ngành không còn khả dụng');
    await page.getByRole('button', { name: 'Xóa lựa chọn' }).click();
    await page.waitForURL('**/roadmaps');
    await visible('First article');
  },
);

test(
  'Categories error has independent retry and does not hide successful roadmap',
  options,
  async () => {
    let count = 0;
    await page.route('**/api/categories?type=Major', (route) =>
      fulfill(
        route,
        ++count === 1
          ? { error: { code: 'SERVICE_UNAVAILABLE', message: 'Unavailable' } }
          : majors,
        count === 1 ? 503 : 200,
      ),
    );
    await page.route('**/api/guidance', (route) => fulfill(route, roadmap()));
    await page.goto(base + '/roadmaps');
    await visible('First article');
    await visible('Không thể tải chuyên ngành');
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await page.waitForFunction(
      () => !document.querySelector('#guidance-major').disabled,
    );
  },
);

test(
  'invalid/duplicate majorId stays visible in URL and is not silently converted to default',
  options,
  async () => {
    await page.goto(base + '/roadmaps?majorId=4&majorId=7');
    await page.getByRole('alert').waitFor();
    assert.ok(
      (await page.getByRole('alert').innerText()).includes('INVALID_QUERY'),
    );
    assert.equal(new URL(page.url()).searchParams.getAll('majorId').length, 2);
    assert.equal(
      await page.evaluate(
        () =>
          window.guidanceSignals.filter((r) =>
            r.path.startsWith('/api/guidance'),
          ).length,
      ),
      0,
    );
  },
);

test(
  'detail loading/Closed links/no-year and plain text render without executable markup',
  options,
  async () => {
    let pending;
    await page.route('**/api/guidance/81', (route) => {
      pending = route;
    });
    await page.goto(base + '/roadmaps/81');
    await visible('Đang tải bài định hướng');
    await fulfill(pending, detail);
    await visible('Old Major (Đã đóng)');
    await visible('Old Skill (Đã đóng)');
    await visible('Bài viết chưa gắn năm học.');
    await visible('Plain requirements');
    await visible(detail.item.descriptionText);
    assert.equal(await page.locator('main img').count(), 0);
    assert.equal(await page.evaluate(() => window.compromised), undefined);
  },
);

test(
  'detail 404/400/500/503 are errors with Retry; invalid ID makes no request',
  options,
  async () => {
    for (const status of [404, 400, 500, 503]) {
      let count = 0;
      await page.route('**/api/guidance/81', (route) =>
        fulfill(
          route,
          ++count === 1
            ? {
                error: {
                  code: status === 404 ? 'NOT_FOUND' : 'TEST_ERROR',
                  message: 'Test failure',
                },
              }
            : detail,
          count === 1 ? status : 200,
        ),
      );
      await page.goto(base + '/roadmaps/81');
      await page.getByRole('alert').waitFor();
      assert.ok(
        (await page.getByRole('alert').innerText()).includes(`HTTP ${status}`),
      );
      await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
      await visible('Article detail');
      await page.unroute('**/api/guidance/81');
    }
    await page.goto(base + '/roadmaps/not-an-id');
    await page.getByRole('alert').waitFor();
    assert.ok(
      (await page.getByRole('alert').innerText()).includes('INVALID_ID'),
    );
    assert.equal(await page.evaluate(() => window.guidanceSignals.length), 0);
  },
);

test(
  'query change aborts old request; late result cannot overwrite latest data; unmount aborts',
  options,
  async () => {
    let old;
    await page.route('**/api/guidance*', (route) => {
      if (new URL(route.request().url()).searchParams.get('majorId') === '7')
        return fulfill(route, roadmap(7, 'New result'));
      old = route;
    });
    await page.goto(base + '/roadmaps?majorId=4');
    await page.waitForFunction(() =>
      window.guidanceSignals.some((r) => r.path === '/api/guidance?majorId=4'),
    );
    await page.locator('#guidance-major').selectOption('7');
    await visible('New result');
    assert.equal(
      await page.evaluate(
        () =>
          window.guidanceSignals.find(
            (r) => r.path === '/api/guidance?majorId=4',
          ).signal.aborted,
      ),
      true,
    );
    await fulfill(old, roadmap(4, 'Stale result')).catch(() => {});
    assert.equal(
      await page.getByText('Stale result', { exact: true }).count(),
      0,
    );
    await page.locator('#guidance-major').selectOption('4');
    await visible('Đang tải lộ trình');
    await page.getByRole('link', { name: 'Unmount test page' }).click();
    await visible('Unmounted');
    assert.equal(
      await page.evaluate(() =>
        window.guidanceSignals
          .filter((r) => r.path.startsWith('/api/guidance'))
          .every((r) => r.signal.aborted),
      ),
      true,
    );
  },
);

test(
  'detail ID change/unmount aborts pending requests and prevents stale rendering',
  options,
  async () => {
    const pending = new Map();
    await page.route('**/api/guidance/*', (route) => {
      pending.set(new URL(route.request().url()).pathname, route);
    });
    await page.goto(base + '/roadmaps/81');
    await visible('Đang tải bài định hướng');
    await page.getByRole('link', { name: 'Switch detail test page' }).click();
    await page.waitForFunction(() =>
      window.guidanceSignals.some((r) => r.path === '/api/guidance/82'),
    );
    assert.equal(
      await page.evaluate(
        () =>
          window.guidanceSignals.find((r) => r.path === '/api/guidance/81')
            .signal.aborted,
      ),
      true,
    );
    await fulfill(pending.get('/api/guidance/81'), detail).catch(() => {});
    assert.equal(
      await page.getByText('Article detail', { exact: true }).count(),
      0,
    );
    await page.getByRole('link', { name: 'Unmount test page' }).click();
    await visible('Unmounted');
    assert.equal(
      await page.evaluate(
        () =>
          window.guidanceSignals.find((r) => r.path === '/api/guidance/82')
            .signal.aborted,
      ),
      true,
    );
  },
);

test(
  'valid zero-padded majorId displays the selected Active Major without rewriting URL',
  options,
  async () => {
    await page.route('**/api/guidance?majorId=4', (route) =>
      fulfill(route, roadmap()),
    );
    await page.goto(base + '/roadmaps?majorId=0004');
    await visible('First article');
    assert.equal(await page.locator('#guidance-major').inputValue(), '4');
    assert.equal(new URL(page.url()).searchParams.get('majorId'), '0004');
  },
);
