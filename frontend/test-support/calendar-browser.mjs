// Test-only in-memory HTTP fixtures. This never opens a database connection.
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
const require = createRequire(import.meta.url);
export let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  /* Optional local runner. */
}
export async function startCalendarHarness({ browser = true } = {}) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const directory = await mkdtemp(join(tmpdir(), 'unihub-calendar-fr-'));
  let vite, runner;
  const requests = [];
  const now = new Date();
  const date = new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
  let items = [
    'Nộp bài tập lớn Lập trình web',
    'Thi giữa kỳ Cơ sở dữ liệu',
    'Họp nhóm đồ án',
    'Nộp báo cáo thực hành',
    'Đăng ký học phần',
  ].map((title, index) => ({
    id: index + 1,
    title,
    dueDate: new Date(
      Date.parse(`${date}T23:59:00+07:00`) + index * 86400000,
    ).toISOString(),
    remindBefore: 24,
    notes:
      index === 0
        ? 'Nộp mã nguồn qua GitHub và file báo cáo PDF theo mẫu khoa CNTT.'
        : null,
    status: index === 3 ? 'Overdue' : index === 4 ? 'Completed' : 'Upcoming',
    remindedAt: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }));
  let failure = false;
  const close = async () => {
    await runner?.close();
    await vite?.close();
    await rm(directory, { recursive: true, force: true });
  };
  try {
    const entry = join(directory, 'entry.jsx');
    await writeFile(
      entry,
      `
      import React from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter} from 'react-router';
      import {AuthProvider} from ${JSON.stringify(root + '/src/features/auth/AuthProvider.tsx')};
      import {RequireRole} from ${JSON.stringify(root + '/src/features/auth/AuthGuard.tsx')};
      import {CalendarPage} from ${JSON.stringify(root + '/src/features/calendar/CalendarPage.tsx')};
      import {setAuthenticated,setGuest} from ${JSON.stringify(root + '/src/features/auth/auth-state.ts')};
      import ${JSON.stringify(root + '/src/styles/index.css')};
      window.calendarTest={setAuthenticated,setGuest};
      createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><RequireRole role="Student"><CalendarPage /></RequireRole></AuthProvider></BrowserRouter>);
    `,
    );
    vite = await createServer({
      root,
      configFile: false,
      cacheDir: join(directory, 'cache'),
      logLevel: 'silent',
      resolve: { dedupe: ['react', 'react-dom', 'react-router'] },
      plugins: [
        react(),
        {
          name: 'calendar-test-only',
          configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
              const url = new URL(req.url, 'http://test.invalid');
              if (url.pathname === '/calendar-test') {
                res.setHeader('Content-Type', 'text/html');
                res.end(
                  await server.transformIndexHtml(
                    req.url,
                    `<html><head><title>Calendar mocked preview</title></head><body><div id="root"></div><script type="module" src="/@fs/${entry.replaceAll('\\', '/')}"></script></body></html>`,
                  ),
                );
                return;
              }
              if (!url.pathname.startsWith('/api/')) return next();
              let text = '';
              for await (const chunk of req) text += chunk;
              const body = text ? JSON.parse(text) : undefined;
              requests.push({
                path: url.pathname,
                method: req.method,
                body,
                query: url.search,
              });
              const json = (value, status = 200) => {
                res.statusCode = status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(value));
              };
              const user = {
                id: 1,
                fullName: 'Sinh viên kiểm thử',
                email: 'calendar@test.invalid',
                avatarUrl: null,
                role: 'Student',
              };
              if (url.pathname === '/api/auth/refresh') {
                json({
                  user,
                  accessToken: 'calendar-preview-test-token',
                  tokenType: 'Bearer',
                  expiresIn: 900,
                });
                return;
              }
              if (url.pathname === '/api/auth/me') {
                json({ user });
                return;
              }
              if (failure) {
                json(
                  {
                    error: {
                      code: 'SERVICE_UNAVAILABLE',
                      message: 'Không thể lưu sự kiện, vui lòng thử lại.',
                    },
                  },
                  503,
                );
                return;
              }
              if (url.pathname === '/api/events' && req.method === 'GET') {
                json({
                  items: items
                    .filter(
                      (e) =>
                        e.dueDate >= url.searchParams.get('from') &&
                        e.dueDate < url.searchParams.get('to'),
                    )
                    .sort(
                      (a, b) =>
                        a.dueDate.localeCompare(b.dueDate) || a.id - b.id,
                    ),
                });
                return;
              }
              if (url.pathname === '/api/events' && req.method === 'POST') {
                const event = {
                  ...items[0],
                  ...body,
                  id: 100 + requests.length,
                  status: 'Upcoming',
                  remindedAt: null,
                  createdAt: now.toISOString(),
                  updatedAt: now.toISOString(),
                };
                items.push(event);
                json({ event }, 201);
                return;
              }
              const id = Number(url.pathname.split('/')[3]);
              const event = items.find((e) => e.id === id);
              if (!event) {
                json(
                  {
                    error: {
                      code: 'NOT_FOUND',
                      message: 'Không tìm thấy sự kiện.',
                    },
                  },
                  404,
                );
                return;
              }
              if (req.method === 'DELETE') {
                items = items.filter((e) => e.id !== id);
                res.statusCode = 204;
                res.end();
                return;
              }
              if (req.method === 'PATCH')
                Object.assign(event, body, {
                  updatedAt: new Date().toISOString(),
                });
              json({ event });
            });
          },
        },
      ],
      server: { host: '127.0.0.1', port: 0, fs: { allow: [root, directory] } },
    });
    await vite.listen();
    if (browser)
      runner = await chromium.launch({
        headless: true,
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
          : {}),
      });
    return {
      browser: runner,
      base: `http://127.0.0.1:${vite.httpServer.address().port}`,
      requests,
      setEmpty: () => {
        items = [];
      },
      setFailure: (value) => {
        failure = value;
      },
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
