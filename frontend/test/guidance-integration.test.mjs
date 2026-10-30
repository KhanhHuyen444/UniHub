import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  /* environment-provided optional runner */
}
const databaseUrl = process.env.TEST_GUIDANCE_FRONTEND_DATABASE_URL;
const root = fileURLToPath(new URL('..', import.meta.url));

test(
  'Guidance public browser -> Express -> isolated MySQL, without API mocks',
  {
    skip: !databaseUrl
      ? 'TEST_GUIDANCE_FRONTEND_DATABASE_URL is not configured.'
      : !chromium
        ? 'Playwright runner is unavailable.'
        : false,
    timeout: 180000,
  },
  async (t) => {
    const url = new URL(databaseUrl);
    assert.ok(
      url.protocol === 'mysql:' &&
        ['127.0.0.1', 'localhost'].includes(url.hostname) &&
        /^unihub_guidance_frontend_test[A-Za-z0-9_]*$/.test(
          decodeURIComponent(url.pathname.slice(1)),
        ),
      'Use only an isolated loopback unihub_guidance_frontend_test* database.',
    );
    const { createApp } = await import('../../backend/dist/app.js');
    const { createPrismaClient } = await import(
      '../../backend/dist/lib/prisma.js'
    );
    const client = createPrismaClient(databaseUrl);
    const authEnvironment = {
      JWT_SIGNING_SECRET: randomBytes(48).toString('hex'),
      JWT_ISSUER: 'guidance-integration',
      JWT_AUDIENCE: 'guidance-browser',
    };
    const previousAuthEnvironment = Object.fromEntries(
      Object.keys(authEnvironment).map((key) => [key, process.env[key]]),
    );
    Object.assign(process.env, authEnvironment);
    // Error scenarios still use real Prisma/MySQL: rejected authentication to the
    // disposable DB, never fabricated API responses or an injected query error.
    const deniedUrl = new URL(databaseUrl);
    deniedUrl.password = randomBytes(32).toString('hex');
    const deniedClient = createPrismaClient(deniedUrl.toString());
    const rollback = new Error('Rollback Guidance browser fixtures');
    const directory = await mkdtemp(
      join(tmpdir(), 'unihub-guidance-integration-'),
    );
    let backend, vite, browser, runDatabaseErrorScenario, base;
    let readClient = client;
    let databaseFailure;
    const captureFailure = (promise) =>
      promise.catch((error) => {
        databaseFailure = {
          code: error.code,
          metaCode: error.meta?.code,
          kind: error.meta?.driverAdapterError?.cause?.kind,
          originalCode: error.meta?.driverAdapterError?.cause?.originalCode,
        };
        throw error;
      });
    const failedReads = {
      category: {
        findMany: (args) =>
          captureFailure(deniedClient.category.findMany(args)),
        findFirst: (args) =>
          captureFailure(deniedClient.category.findFirst(args)),
      },
    };
    try {
      await client.$transaction(
        async (tx) => {
          assert.equal(
            await tx.category.count(),
            0,
            'Refuse a populated test database.',
          );
          assert.equal(
            await tx.opportunity.count(),
            0,
            'Refuse a populated test database.',
          );
          const category = (type, name, status = 'Active') =>
            tx.category.create({ data: { type, name, status } });
          const alpha = await category('Major', 'Alpha Major');
          const beta = await category('Major', 'Beta Major');
          const empty = await category('Major', 'Empty Major');
          const closed = await category('Major', 'Legacy Major', 'Closed');
          const skill = await category('Skill', 'Legacy Skill', 'Closed');
          const article = (title, majorIds, years, overrides = {}) =>
            tx.opportunity.create({
              data: {
                opportunity_type: 'Bài viết định hướng',
                status: 'Approved',
                title,
                publisher: 'Guidance integration test',
                description: '<b>Plain Guidance content</b>',
                requirements: null,
                majors: { create: majorIds.map((major_id) => ({ major_id })) },
                ...(years.length
                  ? {
                      years: {
                        create: years.map((academic_year) => ({
                          academic_year,
                        })),
                      },
                    }
                  : {}),
                skills: { create: { skill_id: skill.category_id } },
                ...overrides,
              },
            });
          const alphaArticle = await article(
            'Alpha guidance',
            [alpha.category_id],
            [2],
          );
          const betaArticle = await article(
            'Beta guidance',
            [beta.category_id, closed.category_id],
            [1, 3],
          );
          const noYear = await article(
            'Guidance without a year',
            [beta.category_id],
            [],
          );
          const wrongType = await article(
            'Scholarship is not Guidance',
            [beta.category_id],
            [1],
            { opportunity_type: 'Học bổng' },
          );
          await article('Pending must stay hidden', [beta.category_id], [1], {
            status: 'Pending',
          });
          await article('Rejected must stay hidden', [beta.category_id], [1], {
            status: 'Rejected',
          });
          let majorUnavailable = false,
            guidanceUnavailable = false;
          readClient = tx;
          const app = createApp({
            // Real Auth refresh returns 401 for a fresh browser without a cookie.
            // Use the official dependency for the temporary browser origin;
            // JWT configuration remains validated by the real Auth implementation.
            auth: { getAllowedOrigins: () => [base] },
            categories: {
              getPrismaClient: () =>
                majorUnavailable ? failedReads : readClient,
            },
            guidance: {
              getPrismaClient: () =>
                guidanceUnavailable ? failedReads : readClient,
            },
          });
          backend = app.listen(0, '127.0.0.1');
          await once(backend, 'listening');
          const target = `http://127.0.0.1:${backend.address().port}`;
          const entry = join(directory, 'entry.js');
          await writeFile(
            entry,
            `
        import React from 'react'; import {createRoot} from 'react-dom/client';
        import {BrowserRouter,Routes,Route} from 'react-router';
        import {AuthProvider,useAuth} from ${JSON.stringify(root + '/src/features/auth/AuthProvider.tsx')};
        import {GuidanceRoadmapPage} from ${JSON.stringify(root + '/src/features/guidance/GuidanceRoadmapPage.tsx')};
        import {GuidanceDetailPage} from ${JSON.stringify(root + '/src/features/guidance/GuidanceDetailPage.tsx')};
        const e=React.createElement;
        function AuthStatus(){return e('output',{'data-testid':'auth-status',hidden:true},useAuth().status);}
        createRoot(document.getElementById('root')).render(e(BrowserRouter,null,e(AuthProvider,null,
          e(AuthStatus),e(Routes,null,
          e(Route,{path:'/roadmaps',element:e(GuidanceRoadmapPage)}),
          e(Route,{path:'/roadmaps/:id',element:e(GuidanceDetailPage)})))));
      `,
          );
          vite = await createServer({
            root,
            cacheDir: join(directory, 'vite-cache'),
            configFile: false,
            plugins: [
              react(),
              {
                name: 'guidance-integration-test-document',
                configureServer(server) {
                  server.middlewares.use(async (request, response, next) => {
                    if (!/^\/roadmaps(?:\/\d+)?(?:\?|$)/.test(request.url))
                      return next();
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
            server: {
              host: '127.0.0.1',
              port: 0,
              fs: { allow: [root, directory] },
              proxy: { '/api': { target, changeOrigin: true } },
            },
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
          const withPage = async (callback) => {
            const page = await browser.newPage();
            let rejectPageError;
            const renderFailure = new Promise((_, reject) => {
              rejectPageError = reject;
            });
            const onPageError = (error) => {
              rejectPageError(
                new Error(`Guidance browser pageerror: ${error.message}`, {
                  cause: error,
                }),
              );
            };
            page.on('pageerror', onPageError);
            try {
              await Promise.race([
                (async () => {
                  await callback(page);
                  await page.waitForFunction(
                    () =>
                      document.querySelector('[data-testid="auth-status"]')
                        ?.textContent === 'guest',
                  );
                })(),
                renderFailure,
              ]);
            } finally {
              page.off('pageerror', onPageError);
              await page.close();
            }
          };
          const responseFor = (page, path) =>
            page.waitForResponse(
              (response) =>
                new URL(response.url()).pathname +
                  new URL(response.url()).search ===
                path,
            );

          await t.test(
            'real Major options, selection, year grouping, detail navigation and Closed links',
            async () => {
              await withPage(async (page) => {
                const optionsResponse = responseFor(
                  page,
                  '/api/categories?type=Major',
                );
                await page.goto(base + '/roadmaps');
                const options = await optionsResponse;
                assert.equal(options.status(), 200);
                assert.equal(
                  options.request().headers().authorization,
                  undefined,
                  'Existing Guidance UI is a public flow.',
                );
                assert.deepEqual(
                  (await options.json()).items.map((item) => item.name),
                  ['Alpha Major', 'Beta Major', 'Empty Major'],
                );
                const select = page.getByLabel('Chuyên ngành', { exact: true });
                await select
                  .locator(`option[value="${beta.category_id}"]`)
                  .waitFor({ state: 'attached' });
                assert.equal(
                  await select
                    .locator(`option[value="${closed.category_id}"]`)
                    .count(),
                  0,
                );
                const listResponse = responseFor(
                  page,
                  `/api/guidance?majorId=${beta.category_id}`,
                );
                await select.selectOption(String(beta.category_id));
                const roadmap = await listResponse;
                assert.equal(roadmap.status(), 200);
                const body = await roadmap.json();
                assert.deepEqual(
                  body.stages.map((stage) => [
                    stage.academicYear,
                    stage.items.map((item) => item.id),
                  ]),
                  [
                    [1, [betaArticle.item_id]],
                    [3, [betaArticle.item_id]],
                  ],
                );
                await page
                  .getByRole('link', { name: 'Beta guidance', exact: true })
                  .first()
                  .waitFor();
                assert.equal(
                  await page
                    .getByText('Guidance without a year', { exact: true })
                    .count(),
                  0,
                );
                assert.equal(
                  await page
                    .getByText('Scholarship is not Guidance', { exact: true })
                    .count(),
                  0,
                );
                const detailResponse = responseFor(
                  page,
                  `/api/guidance/${betaArticle.item_id}`,
                );
                await page
                  .getByRole('link', { name: 'Beta guidance', exact: true })
                  .first()
                  .click();
                assert.equal((await detailResponse).status(), 200);
                await page
                  .getByRole('heading', { name: 'Beta guidance', exact: true })
                  .waitFor();
                await page
                  .getByText('Legacy Major (Đã đóng)', { exact: true })
                  .waitFor();
                await page
                  .getByText('Legacy Skill (Đã đóng)', { exact: true })
                  .waitFor();
                await page
                  .getByText('<b>Plain Guidance content</b>', { exact: true })
                  .waitFor();
                assert.equal(await page.locator('main b').count(), 0);
                await page
                  .getByRole('link', { name: 'Quay lại lộ trình', exact: true })
                  .click();
                await page
                  .getByRole('link', { name: 'Beta guidance', exact: true })
                  .first()
                  .waitFor();
                assert.equal(
                  new URL(page.url()).searchParams.get('majorId'),
                  String(beta.category_id),
                );
              });
            },
          );

          await t.test(
            'selected Major with no articles differs from no-year public detail',
            async () => {
              await withPage(async (page) => {
                const listResponse = responseFor(
                  page,
                  `/api/guidance?majorId=${empty.category_id}`,
                );
                await page.goto(
                  `${base}/roadmaps?majorId=${empty.category_id}`,
                );
                const response = await listResponse;
                assert.equal(response.status(), 200);
                assert.deepEqual(await response.json(), {
                  selectedMajor: {
                    id: empty.category_id,
                    name: empty.name,
                    type: 'Major',
                  },
                  stages: [],
                });
                await page
                  .getByText(
                    'Lộ trình cho chuyên ngành này đang được biên soạn',
                    { exact: true },
                  )
                  .waitFor();
                await page.goto(`${base}/roadmaps/${noYear.item_id}`);
                await page
                  .getByRole('heading', { name: noYear.title, exact: true })
                  .waitFor();
                await page
                  .getByText('Bài viết chưa gắn năm học.', { exact: true })
                  .waitFor();
              });
            },
          );

          await t.test(
            'existing wrong-type opportunity returns actual Guidance 404 in browser',
            async () => {
              assert.equal(
                (
                  await tx.opportunity.findUnique({
                    where: { item_id: wrongType.item_id },
                  })
                ).opportunity_type,
                'Học bổng',
              );
              await withPage(async (page) => {
                const detailResponse = responseFor(
                  page,
                  `/api/guidance/${wrongType.item_id}`,
                );
                await page.goto(`${base}/roadmaps/${wrongType.item_id}`);
                const response = await detailResponse;
                assert.equal(response.status(), 404);
                assert.equal((await response.json()).error.code, 'NOT_FOUND');
                await page
                  .getByText('Không tìm thấy bài định hướng', { exact: true })
                  .waitFor();
              });
            },
          );

          await t.test(
            'Closed selection returns INVALID_FILTER, keeps URL and requires explicit clear',
            async () => {
              await withPage(async (page) => {
                const listResponse = responseFor(
                  page,
                  `/api/guidance?majorId=${closed.category_id}`,
                );
                await page.goto(
                  `${base}/roadmaps?majorId=${closed.category_id}`,
                );
                const response = await listResponse;
                assert.equal(response.status(), 400);
                assert.equal(
                  (await response.json()).error.code,
                  'INVALID_FILTER',
                );
                await page
                  .getByText('Chuyên ngành không còn khả dụng', { exact: true })
                  .waitFor();
                assert.equal(
                  new URL(page.url()).searchParams.get('majorId'),
                  String(closed.category_id),
                );
                const select = page.getByLabel('Chuyên ngành', { exact: true });
                await select
                  .locator(`option[value="${closed.category_id}"]`)
                  .waitFor({ state: 'attached' });
                assert.equal(
                  await select
                    .locator(`option[value="${closed.category_id}"]`)
                    .isDisabled(),
                  true,
                );
                await page
                  .getByRole('button', { name: 'Xóa lựa chọn', exact: true })
                  .click();
                await page
                  .getByRole('link', { name: alphaArticle.title, exact: true })
                  .waitFor();
                assert.equal(new URL(page.url()).search, '');
              });
            },
          );

          // Run real connection-failure checks only after fixture rollback: the
          // production adapter's socket timeout must not kill an idle fixture
          // transaction while the denied pool is waiting for a connection.
          runDatabaseErrorScenario = async () => {
            const results = [];
            try {
              await withPage(async (page) => {
                majorUnavailable = true;
                const optionsResponse = responseFor(
                  page,
                  '/api/categories?type=Major',
                );
                await page.goto(base + '/roadmaps');
                const failedOptions = await optionsResponse;
                const optionsBody = await failedOptions.json();
                results.push({
                  api: 'Major',
                  status: failedOptions.status(),
                  code: optionsBody.error?.code,
                });
                assert.notEqual(
                  failedOptions.status(),
                  200,
                  'DB failure must not become an empty success.',
                );
                assert.equal(
                  JSON.stringify(optionsBody).includes(deniedUrl.password),
                  false,
                );
                await page
                  .getByText('Không thể tải chuyên ngành', { exact: true })
                  .waitFor();
                await page
                  .getByText('Chưa có chuyên ngành khả dụng', { exact: true })
                  .waitFor();
                majorUnavailable = false;
                const retryOptions = responseFor(
                  page,
                  '/api/categories?type=Major',
                );
                await page
                  .getByRole('alert')
                  .filter({ hasText: 'Không thể tải chuyên ngành' })
                  .getByRole('button', { name: 'Thử lại', exact: true })
                  .click();
                assert.equal((await retryOptions).status(), 200);
                await page
                  .getByText('Chưa có chuyên ngành Active để lựa chọn.', {
                    exact: true,
                  })
                  .waitFor();
                guidanceUnavailable = true;
                const listResponse = responseFor(page, '/api/guidance');
                await page.reload();
                const failure = await listResponse;
                const failureBody = await failure.json();
                results.push({
                  api: 'Guidance',
                  status: failure.status(),
                  code: failureBody.error?.code,
                });
                assert.notEqual(failure.status(), 200);
                assert.equal(
                  JSON.stringify(failureBody).includes(deniedUrl.password),
                  false,
                );
                await page
                  .getByText('Không thể tải dữ liệu lộ trình', { exact: true })
                  .waitFor();
                guidanceUnavailable = false;
                const retryRoadmap = responseFor(page, '/api/guidance');
                await page
                  .getByRole('alert')
                  .filter({ hasText: 'Không thể tải dữ liệu lộ trình' })
                  .getByRole('button', { name: 'Thử lại', exact: true })
                  .click();
                assert.equal((await retryRoadmap).status(), 200);
                await page
                  .getByText('Chưa có chuyên ngành khả dụng', { exact: true })
                  .waitFor();
              });
            } finally {
              majorUnavailable = false;
              guidanceUnavailable = false;
            }
            // Keep the contractual expectation even if UI recovery works for a
            // generic 500. A wrong server error mapping must remain a failing test.
            assert.deepEqual(
              results,
              [
                { api: 'Major', status: 503, code: 'SERVICE_UNAVAILABLE' },
                { api: 'Guidance', status: 503, code: 'SERVICE_UNAVAILABLE' },
              ],
              `Database failure classification (safe driver codes): ${JSON.stringify(databaseFailure)}`,
            );
          };

          await t.test(
            'no Active Major returns the exact default empty response through real API',
            async () => {
              await tx.category.updateMany({
                where: {
                  category_id: {
                    in: [
                      alpha.category_id,
                      beta.category_id,
                      empty.category_id,
                    ],
                  },
                },
                data: { status: 'Closed' },
              });
              await withPage(async (page) => {
                const listResponse = responseFor(page, '/api/guidance');
                await page.goto(base + '/roadmaps');
                const response = await listResponse;
                assert.equal(response.status(), 200);
                assert.deepEqual(await response.json(), {
                  selectedMajor: null,
                  stages: [],
                });
                await page
                  .getByText('Chưa có chuyên ngành khả dụng', { exact: true })
                  .waitFor();
                assert.equal(
                  await page
                    .getByLabel('Chuyên ngành', { exact: true })
                    .isDisabled(),
                  true,
                );
              });
            },
          );
          assert.equal(
            await tx.activityLog.count(),
            0,
            'Public Guidance must not write audit logs.',
          );
          throw rollback;
        },
        { isolationLevel: 'RepeatableRead', timeout: 120000 },
      );
      assert.fail('Fixture transaction must roll back.');
    } catch (error) {
      if (error !== rollback) throw error;
      readClient = client;
      assert.equal(
        await client.category.count(),
        0,
        'All category fixtures must be rolled back before error checks.',
      );
      assert.equal(
        await client.opportunity.count(),
        0,
        'All opportunity fixtures must be rolled back before error checks.',
      );
      await t.test(
        'actual database failure maps to 503; Major and Roadmap retry independently',
        runDatabaseErrorScenario,
      );
    } finally {
      await browser?.close();
      await vite?.close();
      if (backend)
        await new Promise((resolve, reject) =>
          backend.close((error) => (error ? reject(error) : resolve())),
        );
      await client.$disconnect();
      await deniedClient.$disconnect();
      await rm(directory, { recursive: true, force: true });
      for (const [key, value] of Object.entries(previousAuthEnvironment)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  },
);
