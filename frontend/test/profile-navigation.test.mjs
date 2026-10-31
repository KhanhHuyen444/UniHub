import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { safeReturnPath } from '../src/features/auth/return-path.ts';

let vite, auth, AuthProvider, StudentAccountMenu, UserAvatar;
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
    '/src/layouts/StudentAccountMenu.tsx',
  ));
  ({ UserAvatar } = await vite.ssrLoadModule(
    '/src/components/ui/UserAvatar.tsx',
  ));
});
after(async () => {
  auth?.setGuest();
  await vite?.close();
});
const user = {
  id: 42,
  fullName: 'Test Student',
  email: 'fixture@example.invalid',
  avatarUrl: null,
  role: 'Student',
};
const menu = () =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(AuthProvider, null, createElement(StudentAccountMenu)),
    ),
  );
test('Student account menu exposes Profile and Recommendations; Guest/Admin do not get Student links', () => {
  auth.setAuthenticated('fixture', user);
  const markup = menu();
  assert.match(markup, /href="\/profile"/);
  assert.match(markup, /href="\/recommendations"/);
  assert.match(markup, /Đăng xuất/);
  auth.setGuest();
  assert.equal(menu(), '');
  auth.setAuthenticated('fixture', { ...user, role: 'Admin' });
  assert.equal(menu(), '');
});
test('avatar missing image renders initials and no broken img element', () => {
  const markup = renderToStaticMarkup(
    createElement(UserAvatar, { name: 'Nguyễn Minh Anh', url: null }),
  );
  assert.match(markup, />MA</);
  assert.doesNotMatch(markup, /<img/);
});
test('Profile returnTo preserves recommendations query and rejects external/login destinations', () => {
  assert.equal(
    safeReturnPath('/recommendations?from=profile'),
    '/recommendations?from=profile',
  );
  for (const path of [
    'https://evil.invalid',
    '//evil.invalid',
    '/login',
    '/\\evil.invalid',
  ])
    assert.equal(safeReturnPath(path), '/opportunities');
});
