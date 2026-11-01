import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { createServer } from 'vite';

let vite, pageModule, authState, AuthProvider;
const originalFetch = globalThis.fetch;

before(async () => {
  vite = await createServer({
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true },
  });

  pageModule = await vite.ssrLoadModule(
    '/src/features/admin/users/AdminUsersPage.tsx',
  );
  authState = await vite.ssrLoadModule('/src/features/auth/auth-state.ts');
  ({ AuthProvider } = await vite.ssrLoadModule(
    '/src/features/auth/AuthProvider.tsx',
  ));
});

after(async () => {
  globalThis.fetch = originalFetch;
  authState.setGuest();
  await vite?.close();
});

test('AdminUsersPage blocks non-Admin users with error state', () => {
  // Student role
  const markupStudent = renderToStaticMarkup(
    createElement(
      AuthProvider,
      null,
      createElement(
        MemoryRouter,
        null,
        createElement(pageModule.AdminUsersPage, {
          role: 'Student',
          accessToken: 'token-student',
        }),
      ),
    ),
  );

  assert.ok(markupStudent.includes('Từ chối truy cập'));
  assert.ok(
    markupStudent.includes(
      'Chức năng quản lý tài khoản và phân quyền chỉ dành cho Quản trị viên',
    ),
  );

  // Guest role
  const markupGuest = renderToStaticMarkup(
    createElement(
      AuthProvider,
      null,
      createElement(
        MemoryRouter,
        null,
        createElement(pageModule.AdminUsersPage, {
          role: null,
          accessToken: null,
        }),
      ),
    ),
  );

  assert.ok(markupGuest.includes('Từ chối truy cập'));
});

test('AdminUsersPage renders Admin header, search bar, and controls for Admin', () => {
  const markupAdmin = renderToStaticMarkup(
    createElement(
      AuthProvider,
      null,
      createElement(
        MemoryRouter,
        null,
        createElement(pageModule.AdminUsersPage, {
          role: 'Admin',
          accessToken: 'token-admin',
          currentUserId: 1,
        }),
      ),
    ),
  );

  assert.ok(markupAdmin.includes('Tài khoản &amp; Phân quyền'));
  assert.ok(markupAdmin.includes('Tìm kiếm theo họ tên hoặc email...'));
  assert.ok(markupAdmin.includes('Làm mới'));
});
