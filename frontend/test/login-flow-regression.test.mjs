import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { fileURLToPath } from 'node:url';

let vite,
  loginDestination,
  safeReturnPath,
  LoginPage,
  LoginPresentation,
  LoginLayout,
  GoogleIdentityButton,
  ProfileLoginRedirect,
  authState;

before(async () => {
  vite = await createServer({
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true },
  });

  ({ loginDestination, safeReturnPath } = await vite.ssrLoadModule(
    '/src/features/auth/return-path.ts',
  ));
  ({ LoginPage } = await vite.ssrLoadModule(
    '/src/features/auth/LoginPage.tsx',
  ));
  ({ LoginPresentation } = await vite.ssrLoadModule(
    '/src/features/auth/LoginPresentation.tsx',
  ));
  ({ LoginLayout } = await vite.ssrLoadModule(
    '/src/features/auth/LoginLayout.tsx',
  ));
  ({ GoogleIdentityButton } = await vite.ssrLoadModule(
    '/src/features/auth/GoogleIdentityButton.tsx',
  ));
  ({ ProfileLoginRedirect } = await vite.ssrLoadModule(
    '/src/features/profile/ProfileLoginRedirect.tsx',
  ));
  authState = await vite.ssrLoadModule('/src/features/auth/auth-state.ts');
});

after(() => vite?.close());

test('loginDestination standardizes post-login destinations for all roles', () => {
  // Student default is '/'
  assert.equal(loginDestination(null, 'Student'), '/');
  // Student with safe returnTo
  assert.equal(
    loginDestination('/recommendations', 'Student'),
    '/recommendations',
  );
  assert.equal(
    loginDestination('/opportunities?type=Internship', 'Student'),
    '/opportunities?type=Internship',
  );
  // Admin default is '/admin/dashboard'
  assert.equal(loginDestination(null, 'Admin'), '/admin/dashboard');
  // Admin with safe returnTo
  assert.equal(
    loginDestination('/admin/opportunities', 'Admin'),
    '/admin/opportunities',
  );
  assert.equal(
    loginDestination('/admin/dashboard', 'Admin'),
    '/admin/dashboard',
  );
  // Guest / null role default is '/'
  assert.equal(loginDestination(null, null), '/');
  // Unsafe / external URLs fall back safely and never redirect externally
  assert.equal(
    loginDestination('https://evil.attacker.invalid', 'Student'),
    '/opportunities',
  );
  assert.equal(
    loginDestination('//evil.attacker.invalid/path', 'Admin'),
    '/opportunities',
  );
  // Redirect loop prevention: /login as returnTo falls back safely
  assert.equal(loginDestination('/login', 'Student'), '/opportunities');
  assert.equal(
    loginDestination('/login?returnTo=%2Flogin', 'Admin'),
    '/opportunities',
  );
});

test('LoginPresentation renders two-column structure with benefits, Google slot and privacy', () => {
  const html = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(LoginPresentation, {
        googleButton: createElement(
          'div',
          { id: 'test-google-button' },
          'Google Button Slot',
        ),
        submitting: false,
        restoring: false,
        error: null,
        authError: null,
      }),
    ),
  );

  assert.ok(html.includes('Chào mừng đến với'));
  assert.ok(html.includes('UniHub'));
  assert.ok(html.includes('Google Button Slot'));
  assert.ok(html.includes('Bảo mật &amp; Quyền riêng tư'));
  assert.ok(
    html.includes('mã định danh Google, email, họ tên và ảnh đại diện'),
  );
  assert.ok(html.includes('Quay về trang chủ'));
  assert.ok(html.includes('href="/"'));
});

test('LoginPresentation displays submitting, restoring and error states accurately', () => {
  // Submitting state
  const submittingHtml = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(LoginPresentation, {
        googleButton: createElement('span', null, 'Slot'),
        submitting: true,
      }),
    ),
  );
  assert.ok(submittingHtml.includes('Đang xác minh tài khoản…'));

  // Restoring state
  const restoringHtml = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(LoginPresentation, {
        googleButton: createElement('span', null, 'Slot'),
        restoring: true,
      }),
    ),
  );
  assert.ok(restoringHtml.includes('Đang khôi phục phiên đăng nhập…'));

  // Error state
  const errorHtml = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(LoginPresentation, {
        googleButton: createElement('span', null, 'Slot'),
        error: 'Tài khoản Google không hợp lệ.',
      }),
    ),
  );
  assert.ok(errorHtml.includes('role="alert"'));
  assert.ok(errorHtml.includes('Tài khoản Google không hợp lệ.'));

  // Auth service unavailable state
  const authErrorHtml = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(LoginPresentation, {
        googleButton: createElement('span', null, 'Slot'),
        authError: 'Dịch vụ xác thực chưa sẵn sàng.',
      }),
    ),
  );
  assert.ok(authErrorHtml.includes('Dịch vụ xác thực chưa sẵn sàng.'));
});

test('LoginLayout renders shell with navigation and focusable account anchor', () => {
  const html = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(
        LoginLayout,
        null,
        createElement('div', { id: 'child-content' }, 'Form'),
      ),
    ),
  );

  assert.ok(html.includes('login-shell'));
  assert.ok(html.includes('login-header'));
  assert.ok(html.includes('href="#login-panel"'));
  assert.ok(html.includes('id="child-content"'));
});

test('GoogleIdentityButton accepts width prop and handles inert/disabled attributes', () => {
  const html = renderToStaticMarkup(
    createElement(GoogleIdentityButton, {
      onCredential() {},
      disabled: true,
      width: 270,
    }),
  );

  assert.ok(html.includes('aria-disabled="true"'));
  assert.ok(html.includes('inert'));
});
