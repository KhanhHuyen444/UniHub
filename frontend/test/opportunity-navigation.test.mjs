import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';

let vite, auth, AuthProvider, OpportunityHubPage, GuidanceRoadmapPage;
const originalFetch = globalThis.fetch;

before(async () => {
  // Mock fetch to avoid real network calls during OpportunityHubPage initial mount
  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url), 'http://127.0.0.1');
    if (parsed.pathname === '/api/categories') {
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (parsed.pathname === '/api/guidance') {
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (parsed.pathname === '/api/opportunities') {
      return new Response(
        JSON.stringify({
          items: [],
          meta: {
            page: 1,
            pageSize: 6,
            total: 0,
            totalPages: 0,
            evaluatedAt: new Date().toISOString(),
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    return new Response(JSON.stringify({ error: 'not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  vite = await createServer({
    configFile: false,
    plugins: [react()],
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true },
    logLevel: 'silent',
  });
  auth = await vite.ssrLoadModule('/src/features/auth/auth-state.ts');
  ({ AuthProvider } = await vite.ssrLoadModule(
    '/src/features/auth/AuthProvider.tsx',
  ));
  ({ OpportunityHubPage } = await vite.ssrLoadModule(
    '/src/features/opportunities/OpportunityHubPage.tsx',
  ));
  ({ GuidanceRoadmapPage } = await vite.ssrLoadModule(
    '/src/features/guidance/GuidanceRoadmapPage.tsx',
  ));
});

after(async () => {
  globalThis.fetch = originalFetch;
  auth?.setGuest();
  await vite?.close();
});

const studentUser = {
  id: 101,
  fullName: 'Nguyễn Văn Sinh Viên',
  email: 'sinhvien@example.invalid',
  avatarUrl: null,
  role: 'Student',
};

const adminUser = {
  id: 102,
  fullName: 'Trần Quản Trị',
  email: 'admin@example.invalid',
  avatarUrl: null,
  role: 'Admin',
};

function renderHub(initialPath = '/opportunities') {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [initialPath] },
      createElement(AuthProvider, null, createElement(OpportunityHubPage)),
    ),
  );
}

function renderRoadmaps(initialPath = '/roadmaps') {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [initialPath] },
      createElement(AuthProvider, null, createElement(GuidanceRoadmapPage)),
    ),
  );
}

test('Guest on /opportunities: renders public navbar with Google sign-in and active Hub tab', () => {
  auth.setGuest();
  const html = renderHub();

  // Active tab must be Hub cơ hội
  assert.match(html, /<a[^>]*aria-current="page"[^>]*>Hub cơ hội<\/a>/);
  assert.match(html, /<a[^>]*aria-current="page"[^>]*href="\/opportunities"/);

  // Other public links present
  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/roadmaps"/);

  // Forum link present without "Sắp ra mắt"
  assert.match(html, /href="\/forum"[^>]*>Diễn đàn<\/a>/);
  assert.ok(!html.includes('Sắp ra mắt'));

  // Student-only links must NOT appear
  assert.ok(!html.includes('href="/recommendations"'));
  assert.ok(!html.includes('href="/calendar"'));

  // Google sign in button present
  assert.match(html, /href="\/login"/);
  assert.match(html, /Đăng nhập với Google/);

  // No student account dropdown
  assert.ok(!html.includes('Tài khoản sinh viên'));
});

test('Student on /opportunities: renders full student navbar matching /recommendations, active Hub tab, notification and account menu', () => {
  auth.setAuthenticated('student-token', studentUser);
  const html = renderHub();

  // Active tab is Hub cơ hội
  assert.match(html, /<a[^>]*aria-current="page"[^>]*>Hub cơ hội<\/a>/);
  assert.match(html, /<a[^>]*aria-current="page"[^>]*href="\/opportunities"/);

  // All student navigation items present
  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/recommendations"/);
  assert.match(html, /href="\/roadmaps"/);
  assert.match(html, /href="\/calendar"/);

  // Forum link present without "Sắp ra mắt"
  assert.match(html, /href="\/forum"[^>]*>Diễn đàn<\/a>/);
  assert.ok(!html.includes('Sắp ra mắt'));

  // Notification bell present
  assert.match(html, /aria-label="Thông báo"/);

  // Student name & email present
  assert.match(html, /Nguyễn Văn Sinh Viên/);
  assert.match(html, /sinhvien@example\.invalid/);

  // Account menu (<details>) present with links
  assert.match(html, /aria-label="Tài khoản sinh viên"/);
  assert.match(html, /href="\/profile"/);
  assert.match(html, /Hồ sơ cá nhân/);
  assert.match(html, /Cơ hội dành cho bạn/);
  assert.match(html, /Đăng xuất/);

  // No Google sign-in button
  assert.ok(!html.includes('Đăng nhập với Google'));
});

test('Admin on /opportunities: preserves admin public view with admin identity and logout', () => {
  auth.setAuthenticated('admin-token', adminUser);
  const html = renderHub();

  // Active tab is Hub cơ hội
  assert.match(html, /<a[^>]*aria-current="page"[^>]*>Hub cơ hội<\/a>/);
  assert.match(html, /<a[^>]*aria-current="page"[^>]*href="\/opportunities"/);

  // Public links present, but student links NOT present
  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/roadmaps"/);
  assert.ok(!html.includes('href="/recommendations"'));
  assert.ok(!html.includes('href="/calendar"'));

  // Admin identity and logout
  assert.match(html, /Trần Quản Trị/);
  assert.match(html, /Đăng xuất/);

  // No Google login
  assert.ok(!html.includes('Đăng nhập với Google'));
});

test('Student on /roadmaps: renders full student navbar matching /recommendations, active roadmaps tab, notification and account menu', () => {
  auth.setAuthenticated('student-token', studentUser);
  const html = renderRoadmaps();

  // Active tab is Lộ trình kỹ năng
  assert.match(html, /<a[^>]*aria-current="page"[^>]*>Lộ trình kỹ năng<\/a>/);
  assert.match(html, /<a[^>]*aria-current="page"[^>]*href="\/roadmaps"/);

  // All student navigation items present
  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/opportunities"/);
  assert.match(html, /href="\/recommendations"/);
  assert.match(html, /href="\/calendar"/);
  assert.match(html, /href="\/forum"[^>]*>Diễn đàn<\/a>/);

  // Notification bell present
  assert.match(html, /aria-label="Thông báo"/);

  // Student name & email present
  assert.match(html, /Nguyễn Văn Sinh Viên/);
  assert.match(html, /sinhvien@example\.invalid/);

  // Account menu (<details>) present with links
  assert.match(html, /aria-label="Tài khoản sinh viên"/);
  assert.match(html, /href="\/profile"/);
  assert.match(html, /Hồ sơ cá nhân/);
  assert.match(html, /Cơ hội dành cho bạn/);
  assert.match(html, /Đăng xuất/);

  // No Google sign-in button
  assert.ok(!html.includes('Đăng nhập với Google'));
});

test('Guest on /roadmaps: renders public navbar with active roadmaps tab and Google sign-in', () => {
  auth.setGuest();
  const html = renderRoadmaps();

  // Active tab is Lộ trình kỹ năng
  assert.match(html, /<a[^>]*aria-current="page"[^>]*>Lộ trình kỹ năng<\/a>/);
  assert.match(html, /<a[^>]*aria-current="page"[^>]*href="\/roadmaps"/);

  // Other public links present
  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/opportunities"/);
  assert.match(html, /href="\/forum"/);

  // Student-only links must NOT appear
  assert.ok(!html.includes('href="/recommendations"'));
  assert.ok(!html.includes('href="/calendar"'));

  // Google sign in button present
  assert.match(html, /href="\/login"/);
  assert.match(html, /Đăng nhập với Google/);
});
