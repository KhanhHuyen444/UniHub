import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createElement as e } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
let vite, state, AuthProvider, AppRoutes, StudentLayout, SessionRoutes;
const student = {
  id: 1,
  email: 'student@example.invalid',
  fullName: 'Student One',
  avatarUrl: null,
  role: 'Student',
};
before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
  state = await vite.ssrLoadModule('/src/features/auth/auth-state.ts');
  ({ AuthProvider } = await vite.ssrLoadModule(
    '/src/features/auth/AuthProvider.tsx',
  ));
  ({ AppRoutes } = await vite.ssrLoadModule('/src/app/router.tsx'));
  ({ StudentLayout } = await vite.ssrLoadModule(
    '/src/layouts/StudentLayout.tsx',
  ));
  SessionRoutes = await vite.ssrLoadModule(
    '/src/features/auth/SessionRoutes.tsx',
  );
});
after(async () => {
  state?.setGuest();
  await vite?.close();
});
const render = (path) =>
  renderToStaticMarkup(
    e(
      MemoryRouter,
      { initialEntries: [path] },
      e(AuthProvider, null, e(AppRoutes)),
    ),
  );
for (const [path, role, marker] of [
  ['/recommendations', 'Student', 'Điều hướng sinh viên'],
  ['/admin/categories', 'Admin', 'Quản lý danh mục'],
  ['/admin/opportunities', 'Admin', 'Điều hướng quản trị'],
  ['/admin/opportunities/41', 'Admin', 'Điều hướng quản trị'],
]) {
  test(`matching role mounts real guarded route ${path}`, () => {
    state.setAuthenticated('fixture-access', { ...student, role });
    const html = render(path);
    assert.ok(html.includes(marker));
    assert.ok(!html.includes('Không tìm thấy trang'));
    assert.ok(!html.includes('fixture-access'));
  });
  test(`Guest never renders content of ${path}`, () => {
    state.setGuest();
    assert.equal(render(path), ''); // Navigate redirects on the client, not during SSR.
  });
  test(`wrong role never renders content of ${path}`, () => {
    state.setAuthenticated('fixture-access', {
      ...student,
      role: role === 'Student' ? 'Admin' : 'Student',
    });
    assert.equal(render(path), '');
  });
  test(`restore hides protected content of ${path}`, () => {
    state.setAuthRestoring();
    const html = render(path);
    assert.ok(html.includes('Đang khôi phục phiên'));
    assert.ok(!html.includes(marker));
  });
}
test('unavailable session renders retry instead of private content', () => {
  state.setAuthUnavailable('Fixture unavailable');
  for (const path of ['/recommendations', '/admin/categories']) {
    assert.ok(render(path).includes('Chưa kiểm tra được quyền truy cập'));
  }
});
test('existing public, technical, forbidden and not-found routes remain reachable', () => {
  state.setGuest();
  for (const [path, marker] of [
    ['/_dev/health', 'Kiểm tra bộ khung dự án'],
    ['/opportunities', 'Hub cơ hội'],
    ['/opportunities/41', 'Đang tải'],
    ['/roadmaps', 'Lộ trình'],
    ['/roadmaps/41', 'Đang tải'],
    ['/403', 'Bạn không có quyền truy cập'],
    ['/404', 'Không tìm thấy trang'],
    ['/profile', 'Không tìm thấy trang'],
  ])
    assert.ok(render(path).includes(marker), path);
});

test('rotation, changing user and logout render only the current session', () => {
  state.setAuthenticated('fixture-initial', student);
  assert.ok(render('/recommendations').includes('Student One'));
  state.setAuthenticated('fixture-rotated', student);
  const rotated = render('/recommendations');
  assert.ok(rotated.includes('Student One'));
  assert.ok(!rotated.includes('fixture-rotated'));
  state.setAuthRestoring();
  assert.ok(!render('/recommendations').includes('Student One'));
  state.setAuthenticated('fixture-other', {
    ...student,
    id: 2,
    fullName: 'Student Two',
    email: 'two@example.invalid',
  });
  const switched = render('/recommendations');
  assert.ok(switched.includes('Student Two'));
  assert.ok(!switched.includes('Student One'));
  state.setGuest();
  assert.equal(render('/recommendations'), '');
});

test('Student logout uses a compact shared button and is disabled for restore/preview/Guest', () => {
  const shell = (previewNavigation = false) =>
    renderToStaticMarkup(
      e(
        MemoryRouter,
        null,
        e(
          AuthProvider,
          null,
          e(StudentLayout, { previewNavigation }, 'Content'),
        ),
      ),
    );
  state.setAuthenticated('fixture-initial', student);
  const active = shell();
  const button = active.match(/<button[^>]*aria-label="Đăng xuất"[^>]*>/)?.[0];
  assert.ok(button);
  assert.ok(!/\sdisabled(?:=|\s|>)/.test(button));
  const links = [...active.matchAll(/href="([^"]+)"/g)].map(
    (match) => match[1],
  );
  for (const prepare of [
    () => state.setAuthRestoring(),
    () => state.setGuest(),
  ]) {
    prepare();
    const html = shell();
    assert.ok(
      /\sdisabled=""/.test(
        html.match(/<button[^>]*aria-label="Đăng xuất"[^>]*>/)?.[0] ?? '',
      ),
    );
    assert.ok(!html.includes('Student One'));
    assert.deepEqual(
      [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]),
      links,
    );
  }
  state.setAuthenticated('fixture-initial', student);
  assert.ok(
    /\sdisabled=""/.test(
      shell(true).match(/<button[^>]*aria-label="Đăng xuất"[^>]*>/)?.[0] ?? '',
    ),
  );
});

test('route adapter keys track owner only while token props stay current', () => {
  for (const [name, role] of [
    ['RecommendationsRoute', 'Student'],
    ['AdminCategoriesRoute', 'Admin'],
  ]) {
    let element;
    function Probe() {
      element = SessionRoutes[name]();
      return null;
    }
    const read = () =>
      renderToStaticMarkup(
        e(MemoryRouter, null, e(AuthProvider, null, e(Probe))),
      );
    state.setAuthenticated('fixture-initial', { ...student, role });
    read();
    const initialKey = element.key;
    const initialToken = element.props.accessToken;
    state.setAuthenticated('fixture-rotated', { ...student, role });
    read();
    assert.equal(element.key, initialKey);
    assert.equal(element.props.accessToken !== initialToken, true);
    state.setAuthenticated('fixture-other', { ...student, id: 2, role });
    read();
    assert.notEqual(element.key, initialKey);
    state.setGuest();
    read();
    assert.equal(element, null);
  }
});

test('logout revocation warning remains visible on the login destination', () => {
  const previousWindow = globalThis.window;
  try {
    globalThis.window = { location: { origin: 'http://localhost' } };
    state.setGuest(
      'Đã đăng xuất trên thiết bị này; máy chủ chưa xác nhận thu hồi phiên.',
    );
    const html = render('/login');
    assert.ok(html.includes('máy chủ chưa xác nhận thu hồi phiên'));
    assert.ok(!html.includes('Student One'));
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
