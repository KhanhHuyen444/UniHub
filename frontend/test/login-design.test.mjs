import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { fileURLToPath } from 'node:url';
let vite, Presentation, Layout, Google;
before(async () => {
  vite = await createServer({
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true },
  });
  ({ LoginPresentation: Presentation } = await vite.ssrLoadModule(
    '/src/features/auth/LoginPresentation.tsx',
  ));
  ({ LoginLayout: Layout } = await vite.ssrLoadModule(
    '/src/features/auth/LoginLayout.tsx',
  ));
  ({ GoogleIdentityButton: Google } = await vite.ssrLoadModule(
    '/src/features/auth/GoogleIdentityButton.tsx',
  ));
});
after(() => vite?.close());
const render = (props) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(Presentation, {
        googleButton: createElement('span', null, 'GIS slot'),
        ...props,
      }),
    ),
  );
test('login two-column content uses existing brand, truthful privacy and real navigation', () => {
  const html = render({});
  assert(html.includes('Chào mừng đến với'));
  assert.equal((html.match(/login-benefit-icon/g) || []).length, 3);
  assert(html.includes('mã định danh Google'));
  assert(!html.includes('chỉ lấy email'));
  assert(html.includes('href="/"'));
  assert(html.includes('id="login-panel"'));
  assert(!html.includes('line-clamp'));
  assert(!html.includes('localStorage'));
  assert(html.includes('logo-student-40.svg'));
});
test('restoring/submitting/errors stay visible without losing brand, Google slot or privacy', () => {
  const html = render({
    restoring: true,
    submitting: true,
    error: 'Lỗi đăng nhập thử nghiệm ' + 'nội dung dài '.repeat(50),
    authError: 'Không khôi phục được phiên',
  });
  assert(html.includes('Đang khôi phục phiên'));
  assert(html.includes('Đang xác minh tài khoản'));
  assert(html.includes('role="alert"'));
  assert(html.includes('Không khôi phục được phiên'));
  assert(html.includes('GIS slot'));
  assert(html.includes('Bảo mật &amp; Quyền riêng tư'));
  assert(html.includes('nội dung dài '.repeat(50).trim()));
});
test('login-specific shell has four navigation links and functional account anchor', () => {
  const html = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(Layout, null, createElement('div', null, 'Login child')),
    ),
  );
  assert(html.includes('login-shell'));
  assert(html.includes('href="#login-panel"'));
  for (const path of ['/', '/opportunities', '/roadmaps', '/forum'])
    assert(html.includes(`href="${path}"`));
  assert(html.includes('Liên kết khám phá'));
  assert(!html.includes('Đăng nhập với Google'));
});
test('GIS renderer retains a disabled inert container or explicit missing-config message', () => {
  const html = renderToStaticMarkup(
    createElement(Google, { onCredential() {}, disabled: true, width: 270 }),
  );
  assert(
    (html.includes('inert') && html.includes('aria-disabled="true"')) ||
      html.includes('Chưa cấu hình VITE_GOOGLE_CLIENT_ID'),
  );
  assert(!html.includes('<button'));
  assert(!html.includes('iframe'));
});

test('missing Google configuration renders a clear status without a fake sign-in button', async () => {
  const missing = await createServer({
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true },
    define: { 'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('') },
  });
  try {
    const { GoogleIdentityButton } = await missing.ssrLoadModule(
      '/src/features/auth/GoogleIdentityButton.tsx',
    );
    const html = renderToStaticMarkup(
      createElement(GoogleIdentityButton, { onCredential() {} }),
    );
    assert(html.includes('Chưa cấu hình VITE_GOOGLE_CLIENT_ID'));
    assert(html.includes('role="status"'));
    assert(!html.includes('<button'));
  } finally {
    await missing.close();
  }
});
