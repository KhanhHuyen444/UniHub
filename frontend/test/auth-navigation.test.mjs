import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router';
import { safeReturnPath } from '../src/features/auth/return-path.ts';
import { roleGateState } from '../src/features/auth/role-access.ts';

let vite,
  auth,
  AuthProvider,
  StudentAccountMenu,
  UserAvatar,
  PendingFeatureNotice,
  PublicLayout,
  HomePage;

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
  ({ StudentAccountMenu } = await vite.ssrLoadModule(
    '/src/features/auth/StudentAccountMenu.tsx',
  ));
  ({ UserAvatar } = await vite.ssrLoadModule(
    '/src/features/auth/UserAvatar.tsx',
  ));
  ({ PendingFeatureNotice } = await vite.ssrLoadModule(
    '/src/features/auth/PendingFeatureNotice.tsx',
  ));
  ({ PublicLayout } = await vite.ssrLoadModule(
    '/src/layouts/PublicLayout.tsx',
  ));
  ({ HomePage } = await vite.ssrLoadModule('/src/features/home/HomePage.tsx'));
});

after(async () => {
  auth?.setGuest();
  await vite?.close();
});

const studentUser = {
  id: 42,
  fullName: 'Nguyễn Thái Bình',
  email: 'student@example.invalid',
  avatarUrl: null,
  role: 'Student',
};

const renderMenu = () =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(AuthProvider, null, createElement(StudentAccountMenu)),
    ),
  );

test('Student account menu renders user info, profile, recommendations, and logout', () => {
  auth.setAuthenticated('fixture-token', studentUser);
  const markup = renderMenu();

  assert.match(markup, /Nguyễn Thái Bình/);
  assert.match(markup, /student@example\.invalid/);
  assert.match(markup, /href="\/profile"/);
  assert.match(markup, /Hồ sơ cá nhân/);
  assert.match(markup, /href="\/recommendations"/);
  assert.match(markup, /Cơ hội dành cho bạn/);
  assert.match(markup, /Đăng xuất/);
  assert.match(markup, /shadow-public-card/);
});

test('Student account menu is hidden for Guest and Admin', () => {
  auth.setGuest();
  assert.equal(renderMenu(), '');

  auth.setAuthenticated('fixture-token', { ...studentUser, role: 'Admin' });
  assert.equal(renderMenu(), '');
});

test('UserAvatar extracts two-letter initials and skips broken img element when url is null', () => {
  const markup = renderToStaticMarkup(
    createElement(UserAvatar, { name: 'Nguyễn Thái Bình', url: null }),
  );
  assert.match(markup, />TB</);
  assert.doesNotMatch(markup, /<img/);
});

test('PendingFeatureNotice renders title, badge, description and back link', () => {
  const markup = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(PendingFeatureNotice, {
        title: 'Hồ sơ sinh viên',
        description: 'Tính năng đang nghiệm thu tích hợp.',
        badgeText: 'Chờ tích hợp PR #36',
        backTo: '/opportunities',
        backLabel: 'Khám phá cơ hội',
      }),
    ),
  );

  assert.match(markup, /Hồ sơ sinh viên/);
  assert.match(markup, /Chờ tích hợp PR #36/);
  assert.match(markup, /Tính năng đang nghiệm thu tích hợp\./);
  assert.match(markup, /href="\/opportunities"/);
  assert.match(markup, /Khám phá cơ hội/);
  assert.match(markup, /href="\/"/);
});

test('Role access gating protects student routes from guest and unauthorized roles', () => {
  // Guest trying to access Student route -> redirects to login
  assert.equal(roleGateState('guest', null, 'Student'), 'login');

  // Authenticated Student -> permitted
  assert.equal(roleGateState('authenticated', 'Student', 'Student'), 'allow');

  // Authenticated Admin trying to access Student route -> forbidden (403)
  assert.equal(roleGateState('authenticated', 'Admin', 'Student'), 'forbidden');

  // Session restoring -> pending
  assert.equal(roleGateState('restoring', null, 'Student'), 'pending');
});

test('Safe return path validation preserves internal params and rejects malicious targets', () => {
  assert.equal(
    safeReturnPath('/recommendations?from=profile'),
    '/recommendations?from=profile',
  );
  assert.equal(safeReturnPath('/profile'), '/profile');
  assert.equal(safeReturnPath('/calendar'), '/calendar');

  for (const badPath of [
    'https://evil.invalid',
    '//evil.invalid',
    '/login',
    '/\\evil.invalid',
    'javascript:alert(1)',
  ]) {
    assert.equal(safeReturnPath(badPath), '/opportunities');
  }
});

test('PublicLayout renders synchronized 6 navigation links and account menu for authenticated Student', () => {
  auth.setAuthenticated('fixture-token', studentUser);
  const markup = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(
        AuthProvider,
        null,
        createElement(
          PublicLayout,
          { activeKey: 'home' },
          createElement('div'),
        ),
      ),
    ),
  );

  assert.match(markup, /Trang chủ/);
  assert.match(markup, /Hub cơ hội/);
  assert.match(markup, /Cơ hội dành cho bạn/);
  assert.match(markup, /Lộ trình kỹ năng/);
  assert.match(markup, /Lịch (&amp;|&) Deadline/);
  assert.match(markup, /Diễn đàn/);
  assert.match(markup, /Nguyễn Thái Bình/);
});

test('PublicLayout renders standard 4 navigation links and Google Login button for Guest', () => {
  auth.setGuest();
  const markup = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(
        AuthProvider,
        null,
        createElement(
          PublicLayout,
          { activeKey: 'home' },
          createElement('div'),
        ),
      ),
    ),
  );

  assert.match(markup, /Trang chủ/);
  assert.match(markup, /Hub cơ hội/);
  assert.match(markup, /Lộ trình kỹ năng/);
  assert.match(markup, /Diễn đàn/);
  assert.doesNotMatch(markup, /Cơ hội dành cho bạn/);
  assert.doesNotMatch(markup, /Lịch & Deadline/);
  assert.match(markup, /Đăng nhập với Google/);
});

test('HomePage renders dynamic opportunity section heading and links correctly', () => {
  auth.setGuest();
  const markup = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(AuthProvider, null, createElement(HomePage)),
    ),
  );

  assert.match(markup, /Học tập, cơ hội và định hướng/);
  assert.match(markup, /Khám phá cơ hội đang mở/);
  assert.match(markup, /Xem tất cả cơ hội/);
  assert.match(markup, /href="\/opportunities"/);
});
