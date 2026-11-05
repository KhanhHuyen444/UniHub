import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router';
import { adminNavigation } from '../src/layouts/navigation.ts';

let vite,
  auth,
  AuthProvider,
  RequireRole,
  AdminLayout,
  AdminModerationPage,
  AppRouter;

const adminUser = {
  id: 1,
  fullName: 'Võ Huyền',
  email: 'huyenvo.021006@gmail.com',
  avatarUrl: null,
  role: 'Admin',
};

const studentUser = {
  id: 2,
  fullName: 'Sinh Viên',
  email: 'student@example.invalid',
  avatarUrl: null,
  role: 'Student',
};

before(async () => {
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
  ({ RequireRole } = await vite.ssrLoadModule(
    '/src/features/auth/AuthGuard.tsx',
  ));
  ({ AdminLayout } = await vite.ssrLoadModule('/src/layouts/AdminLayout.tsx'));
  ({ AdminModerationPage } = await vite.ssrLoadModule(
    '/src/features/admin/moderation/AdminModerationPage.tsx',
  ));
  ({ AppRouter } = await vite.ssrLoadModule('/src/app/router.tsx'));
});

after(async () => {
  auth?.setGuest();
  await vite?.close();
});

test('adminNavigation contains exactly 4 sitemap items matching Chapter 4', () => {
  assert.equal(adminNavigation.length, 4);
  assert.deepEqual(
    adminNavigation.map((item) => ({
      key: item.key,
      label: item.label,
      href: item.href,
    })),
    [
      {
        key: 'dashboard',
        label: 'Dashboard thống kê',
        href: '/admin/dashboard',
      },
      {
        key: 'moderation',
        label: 'Kiểm duyệt nội dung',
        href: '/admin/moderation',
      },
      {
        key: 'categories',
        label: 'Quản lý danh mục',
        href: '/admin/categories',
      },
      {
        key: 'users',
        label: 'Tài khoản & Phân quyền',
        href: '/admin/users',
      },
    ],
  );

  // No separate duplicate moderation entries
  assert.ok(
    !adminNavigation.some((item) => item.key === 'opportunity-moderation'),
  );
  assert.ok(!adminNavigation.some((item) => item.key === 'forum-moderation'));
});

test('AdminLayout renders 4 nav items and highlights moderation when activeKey is moderation', () => {
  auth.setAuthenticated('admin-token', adminUser);

  const markup = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(
        AuthProvider,
        null,
        createElement(
          AdminLayout,
          { activeKey: 'moderation' },
          createElement('div', null, 'Content'),
        ),
      ),
    ),
  );

  // 4 items present in sidebar
  assert.match(markup, /Dashboard thống kê/);
  assert.match(markup, /Kiểm duyệt nội dung/);
  assert.match(markup, /Quản lý danh mục/);
  assert.match(markup, /Tài khoản &amp; Phân quyền/);

  // Old duplicate items not present
  assert.doesNotMatch(markup, /Kiểm duyệt cơ hội/);
  assert.doesNotMatch(markup, /Kiểm duyệt diễn đàn/);

  // moderation link has aria-current="page"
  assert.match(
    markup,
    /<a[^>]*aria-current="page"[^>]*href="\/admin\/moderation"/,
  );
});

test('AdminModerationPage renders Tab 1 (Tin chờ thẩm định) by default with accessible tabs', () => {
  const markup = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/admin/moderation'] },
      createElement(AdminModerationPage),
    ),
  );

  // Title and description for opportunities
  assert.match(markup, /Kiểm duyệt nội dung/);
  assert.match(markup, /Thẩm định cơ hội/);
  assert.match(
    markup,
    /Xem thông tin đã gửi và quyết định duyệt hoặc từ chối theo hợp đồng/,
  );

  // Accessible tablist and tabs
  assert.match(markup, /role="tablist"/);
  assert.match(
    markup,
    /<button[^>]*id="tab-opportunities"[^>]*aria-selected="true"/,
  );
  assert.match(
    markup,
    /<button[^>]*id="tab-community"[^>]*aria-selected="false"/,
  );

  // Tab 1 panel is visible (not hidden), Tab 2 panel is hidden
  assert.match(markup, /id="panel-opportunities"/);
  assert.match(markup, /id="panel-community"[^>]*hidden=""/);

  // Interactive tab button for Tab 2, NOT a disabled placeholder span
  assert.doesNotMatch(markup, /Giám sát cộng đồng \(chưa triển khai\)/);
  assert.match(markup, /<button[^>]*id="tab-community"/);
});

test('AdminModerationPage activates Tab 2 (Giám sát cộng đồng) when ?tab=community is in URL', () => {
  const markup = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/admin/moderation?tab=community'] },
      createElement(AdminModerationPage),
    ),
  );

  // Title and description for community moderation
  assert.match(markup, /Giám sát cộng đồng/);
  assert.match(
    markup,
    /Rà soát bài viết và bình luận trong diễn đàn sinh viên/,
  );

  // Tab 2 is selected, Tab 1 is not
  assert.match(
    markup,
    /<button[^>]*id="tab-opportunities"[^>]*aria-selected="false"/,
  );
  assert.match(
    markup,
    /<button[^>]*id="tab-community"[^>]*aria-selected="true"/,
  );

  // Tab 2 panel is visible, Tab 1 panel is hidden
  assert.match(markup, /id="panel-opportunities"[^>]*hidden=""/);
  assert.doesNotMatch(markup, /id="panel-community"[^>]*hidden=""/);
});

test('AdminModerationPage activates Tab 2 when ?tab=forum is in URL for backward compatibility', () => {
  const markup = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/admin/moderation?tab=forum'] },
      createElement(AdminModerationPage),
    ),
  );

  assert.match(markup, /Giám sát cộng đồng/);
  assert.match(markup, /id="tab-community"[^>]*aria-selected="true"/);
});

test('AdminModerationPage activates Tab 1 when route has opportunity id', () => {
  const markup = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/admin/moderation/41'] },
      createElement(
        Routes,
        null,
        createElement(Route, {
          path: '/admin/moderation/:id',
          element: createElement(AdminModerationPage),
        }),
      ),
    ),
  );

  // Route with ID defaults to Tab 1
  assert.match(markup, /Thẩm định cơ hội/);
  assert.match(
    markup,
    /<button[^>]*id="tab-opportunities"[^>]*aria-selected="true"/,
  );
  assert.match(
    markup,
    /<button[^>]*id="tab-community"[^>]*aria-selected="false"/,
  );
});

test('RequireRole gates /admin/moderation: Guest redirects to login, Student to 403, Admin allowed', () => {
  // Guest
  auth.setGuest();
  const guestMarkup = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/admin/moderation'] },
      createElement(
        AuthProvider,
        null,
        createElement(
          RequireRole,
          { role: 'Admin' },
          createElement(AdminModerationPage),
        ),
      ),
    ),
  );
  // Guest redirected to /login?returnTo=...
  assert.doesNotMatch(guestMarkup, /Thẩm định cơ hội/);

  // Student
  auth.setAuthenticated('student-token', studentUser);
  const studentMarkup = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/admin/moderation'] },
      createElement(
        AuthProvider,
        null,
        createElement(
          RequireRole,
          { role: 'Admin' },
          createElement(AdminModerationPage),
        ),
      ),
    ),
  );
  // Student forbidden
  assert.doesNotMatch(studentMarkup, /Thẩm định cơ hội/);

  // Admin
  auth.setAuthenticated('admin-token', adminUser);
  const adminMarkup = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/admin/moderation'] },
      createElement(
        AuthProvider,
        null,
        createElement(
          RequireRole,
          { role: 'Admin' },
          createElement(AdminModerationPage),
        ),
      ),
    ),
  );
  // Admin sees page
  assert.match(adminMarkup, /Thẩm định cơ hội/);
});

test('appPaths routes align with 4 Admin Sitemap items', async () => {
  const { appPaths } = await vite.ssrLoadModule('/src/app/router.tsx');
  assert.equal(appPaths.adminDashboard, '/admin/dashboard');
  assert.equal(appPaths.adminModeration, '/admin/moderation');
  assert.equal(appPaths.adminCategories, '/admin/categories');
  assert.equal(appPaths.adminUsers, '/admin/users');
  assert.equal(appPaths.adminOpportunities, '/admin/opportunities');
});
