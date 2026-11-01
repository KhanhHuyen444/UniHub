import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, normalizePath } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import tailwindConfig from '../tailwind.config.js';

export let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  /* optional environment runner */
}

export async function startHubBrowser() {
  const root = normalizePath(fileURLToPath(new URL('..', import.meta.url)));
  const directory = await mkdtemp(join(tmpdir(), 'unihub-hub-v2-'));
  let vite, browser;
  const close = async () => {
    await browser?.close();
    await vite?.close();
    await rm(directory, { recursive: true, force: true });
  };
  try {
    vite = await createServer({
      root,
      configFile: false,
      envFile: false,
      cacheDir: join(directory, 'cache'),
      plugins: [react()],
      css: {
        postcss: {
          plugins: [
            tailwind({
              ...tailwindConfig,
              content: [root + 'src/**/*.{ts,tsx}'],
            }),
            autoprefixer(),
          ],
        },
      },
      server: { host: '127.0.0.1', port: 0 },
      logLevel: 'silent',
    });
    await vite.listen();
    browser = await chromium.launch({
      headless: true,
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    });
    return {
      browser,
      base: `http://127.0.0.1:${vite.httpServer.address().port}`,
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

const names = [
  'Frontend Developer Intern (React / Next.js)',
  'Backend Java Developer Intern (Spring Boot)',
  'Data Analyst Intern (Python / BI)',
  'Thực tập sinh UI/UX Design cho Ứng dụng Web',
  'Mobile App Developer Intern (Flutter)',
  'NodeJS / Backend Developer Intern',
];
const fixtureSkills = [
  ['React', 'Next.js', 'Tailwind CSS'],
  ['Java', 'Spring Boot', 'MySQL'],
  ['Python', 'Data Analysis', 'SQL'],
  ['Figma', 'UI/UX Design', 'Wireframing'],
  ['Flutter', 'Dart', 'RESTful API'],
  [],
];
export const hubItems = names.map((title, index) => ({
  id: index + 1,
  type: 'Thực tập',
  title,
  publisher: [
    'Công ty Công nghệ Sao Bắc',
    'Công ty Giải pháp Số Minh An',
    'Công ty Phần mềm Thiên Hà',
    'Trung tâm Công nghệ Hướng Dương',
    'Công ty Viễn thông & Số Ánh Dương',
    'Công ty Phần mềm Sáng Tạo Kim Tín',
  ][index],
  workFormat: ['Hybrid', 'Offline', 'Online'][index % 3],
  location: 'TP. Hồ Chí Minh',
  isVerified: index < 3,
  skills: fixtureSkills[index].map((name, skillIndex) => ({
    id: index * 10 + skillIndex + 1,
    name,
  })),
  deadline: {
    precision: 'date',
    date:
      index === 0 ? '2026-11-15' : index === 3 ? '2026-11-17' : '2026-11-30',
    sourceTimeZone: null,
    instant:
      index === 0
        ? '2026-11-15T17:00:00Z'
        : index === 3
          ? '2026-11-17T17:00:00Z'
          : '2026-11-30T17:00:00Z',
    state: 'open',
  },
}));
export const hubPayload = (url, items = hubItems) => ({
  items,
  meta: {
    page: Number(url.searchParams.get('page') || 1),
    pageSize: Number(url.searchParams.get('pageSize') || 6),
    total: 28,
    totalPages: Math.ceil(28 / Number(url.searchParams.get('pageSize') || 6)),
    evaluatedAt: '2026-11-10T03:00:00Z',
  },
});

export async function hubFixture(harness, run) {
  const page = await harness.browser.newPage({
    viewport: { width: 1440, height: 1000 },
    timezoneId: 'America/Los_Angeles',
  });
  const calls = [],
    errors = [];
  const state = {
    fail: false,
    empty: false,
    invalid: false,
    majorFail: false,
    delay: false,
    items: undefined,
  };
  const pending = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const send = (route, body, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    calls.push(url.pathname + url.search);
    if (url.pathname === '/api/auth/refresh')
      return send(
        route,
        { error: { code: 'UNAUTHORIZED', message: 'Fixture Guest' } },
        401,
      );
    if (url.pathname === '/api/categories')
      return state.majorFail
        ? send(
            route,
            { error: { code: 'SERVICE_UNAVAILABLE', message: 'Fixture' } },
            503,
          )
        : send(route, {
            items: [
              { id: 1, name: 'Công nghệ thông tin', type: 'Major' },
              { id: 2, name: 'Kinh tế', type: 'Major' },
            ],
          });
    if (url.pathname === '/api/opportunities') {
      if (url.searchParams.get('majorId') === '999')
        return send(
          route,
          { error: { code: 'INVALID_FILTER', message: 'Closed Major' } },
          400,
        );
      const payload = hubPayload(url, state.items);
      if (payload.meta.page > payload.meta.totalPages) payload.items = [];
      const fulfill = () =>
        state.fail
          ? send(
              route,
              { error: { code: 'SERVICE_UNAVAILABLE', message: 'Fixture' } },
              503,
            )
          : state.invalid
            ? send(route, { items: [], meta: {} })
            : send(
                route,
                state.empty
                  ? {
                      ...hubPayload(url, []),
                      meta: {
                        ...hubPayload(url).meta,
                        total: 0,
                        totalPages: 0,
                      },
                    }
                  : payload,
              );
      if (state.delay) {
        pending.push(fulfill);
        return;
      }
      return fulfill();
    }
    if (/^\/api\/opportunities\/\d+$/.test(url.pathname))
      return send(route, {
        item: {
          ...hubItems[0],
          descriptionText: '## Mô tả công việc\nNội dung fixture',
          requirementsText: null,
          sourceUrl: null,
          majors: [{ id: 1, name: 'Công nghệ thông tin' }],
          skills: [],
          eligibleAcademicYears: [],
        },
        meta: { evaluatedAt: '2026-11-10T03:00:00Z' },
      });
    return send(route, {});
  });
  try {
    await run({
      page,
      calls,
      errors,
      state,
      release: async () => {
        for (const fulfill of pending.splice(0))
          await fulfill().catch(() => {});
      },
    });
  } finally {
    await page.close();
  }
}
