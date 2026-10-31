import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';

let vite, api, auth;
const originalFetch = globalThis.fetch;
const item = {
  id: 8,
  type: 'Reminder',
  content: 'Deadline',
  isRead: false,
  createdAt: '2026-10-28T00:00:00Z',
  eventId: 5,
};
const page = {
  items: [item],
  meta: { page: 1, pageSize: 20, total: 25, totalPages: 2 },
  unreadCount: 23,
};
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
before(async () => {
  vite = await createServer({
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true },
  });
  api = await vite.ssrLoadModule('/src/features/notifications/api.ts');
  auth = await vite.ssrLoadModule('/src/features/auth/auth-state.ts');
});
after(async () => {
  globalThis.fetch = originalFetch;
  auth.setGuest();
  await vite?.close();
});
test('notification DTO preserves global unread, empty pages, and Violation destination', () => {
  assert.deepEqual(api.parseNotifications(page), page);
  assert.equal(
    api.notificationDestination({ ...item, type: 'Violation', eventId: null }),
    '/forum',
  );
  assert.equal(api.notificationDestination(item), null);
  assert.equal(api.parseNotifications({ ...page, items: [] }).unreadCount, 23);
  assert.deepEqual(
    api.parseNotifications({
      items: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      unreadCount: 0,
    }).items,
    [],
  );
});
test('malformed responses never masquerade as empty notifications', () => {
  for (const value of [
    null,
    {},
    { ...page, items: null },
    { ...page, unreadCount: -1 },
    { ...page, unreadCount: 26 },
    { ...page, meta: { ...page.meta, totalPages: 0 } },
    { ...page, items: [item, item] },
    ...[
      { eventId: null },
      { type: 'Violation', eventId: 5 },
      { isRead: 'false' },
      { createdAt: '2026-02-30T00:00:00Z' },
      { content: 'x'.repeat(501) },
    ].map((patch) => ({ ...page, items: [{ ...item, ...patch }] })),
  ])
    assert.throws(() => api.parseNotifications(value), {
      code: 'INVALID_RESPONSE',
    });
});
test('authenticated list and idempotent mark-read use exact routes, pagination and no PATCH body/query', async () => {
  auth.setAuthenticated('test-token', { id: 1, role: 'Student' });
  const signal = new AbortController().signal;
  const calls = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    return json(
      path.includes('/read') ? { notification: { id: 8, isRead: true } } : page,
    );
  };
  assert.deepEqual(await api.listNotifications(2, signal), page);
  await api.markNotificationRead(8, signal);
  await api.markNotificationRead(8, signal);
  assert.equal(calls[0].path, '/api/notifications?page=2&pageSize=20');
  for (const call of calls) {
    assert.equal(
      call.options.headers.get('Authorization'),
      'Bearer test-token',
    );
    assert.equal(call.options.signal, signal);
  }
  assert.equal(calls[1].path, '/api/notifications/8/read');
  assert.equal(calls[1].options.method, 'PATCH');
  assert.equal(calls[1].options.body, undefined);
});
test('read response validation and HTTP/network/abort failures propagate for panel retry', async () => {
  globalThis.fetch = async () =>
    json({ notification: { id: 9, isRead: true } });
  await assert.rejects(api.markNotificationRead(8), {
    code: 'INVALID_RESPONSE',
  });
  for (const status of [403, 404, 503]) {
    globalThis.fetch = async () =>
      json({ error: { code: 'TEST_ERROR', message: 'Failure' } }, status);
    await assert.rejects(api.listNotifications(), { status });
    await assert.rejects(api.markNotificationRead(8), { status });
  }
  globalThis.fetch = async () => {
    throw new Error('Network');
  };
  await assert.rejects(api.listNotifications(), { code: 'NETWORK_ERROR' });
  const abort = new DOMException('Aborted', 'AbortError');
  globalThis.fetch = async () => {
    throw abort;
  };
  await assert.rejects(api.listNotifications(), (err) => err === abort);
});

test('Reminder opens only its referenced event through the protected Events API', async () => {
  const event = {
    id: 5,
    title: 'Exam',
    dueDate: '2026-11-01T00:00:00Z',
    notes: null,
  };
  const signal = new AbortController().signal;
  auth.setAuthenticated('test-token', { id: 1, role: 'Student' });
  globalThis.fetch = async (path, options) => {
    assert.equal(path, '/api/events/5');
    assert.equal(options.headers.get('Authorization'), 'Bearer test-token');
    assert.equal(options.signal, signal);
    return json({ event });
  };
  assert.deepEqual(await api.getNotificationEvent(5, signal), event);
  globalThis.fetch = async () => json({ event: { ...event, id: 6 } });
  await assert.rejects(api.getNotificationEvent(5), {
    code: 'INVALID_RESPONSE',
  });
  globalThis.fetch = async () =>
    json(
      { error: { code: 'NOT_FOUND', message: 'Event no longer available' } },
      404,
    );
  await assert.rejects(api.getNotificationEvent(5), { status: 404 });
});

test('notifications reuse auth refresh after an expired access token', async () => {
  auth.setAuthenticated('expired', { id: 1, role: 'Student' });
  const paths = [];
  globalThis.fetch = async (path, options) => {
    paths.push(path);
    if (path === '/api/auth/refresh')
      return json({
        user: {
          id: 1,
          role: 'Student',
          fullName: 'Test',
          email: 'test@example.invalid',
          avatarUrl: null,
        },
        accessToken: 'fresh',
        tokenType: 'Bearer',
        expiresIn: 900,
      });
    if (path === '/api/auth/me')
      return json({
        user: {
          id: 1,
          role: 'Student',
          fullName: 'Test',
          email: 'test@example.invalid',
          avatarUrl: null,
        },
      });
    return options.headers.get('Authorization') === 'Bearer expired'
      ? json({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401)
      : json(page);
  };
  assert.deepEqual(await api.listNotifications(), page);
  assert.deepEqual(paths, [
    '/api/notifications?page=1&pageSize=20',
    '/api/auth/refresh',
    '/api/auth/me',
    '/api/notifications?page=1&pageSize=20',
  ]);
});
test('Student bell has dialog semantics; guest, Admin and preview cannot open it', async () => {
  const { NotificationBell } = await vite.ssrLoadModule(
    '/src/features/notifications/NotificationBell.tsx',
  );
  const { AuthProvider } = await vite.ssrLoadModule(
    '/src/features/auth/AuthProvider.tsx',
  );
  for (const [role, preview, disabled] of [
    ['Student', false, false],
    ['Admin', false, true],
    [null, false, true],
    ['Student', true, true],
  ]) {
    if (role) auth.setAuthenticated('test-token', { id: 1, role });
    else auth.setGuest();
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(
          AuthProvider,
          null,
          createElement(NotificationBell, { preview }),
        ),
      ),
    );
    assert.ok(html.includes('aria-haspopup="dialog"'));
    assert.ok(html.includes('aria-label="Thông báo"'));
    assert.equal(html.includes('disabled=""'), disabled);
    assert.equal(html.includes('<dialog'), false);
  }
});

test('PublicLayout exposes a working bell after Student login, without exposing it to other roles', async () => {
  const { PublicLayout } = await vite.ssrLoadModule(
    '/src/layouts/PublicLayout.tsx',
  );
  const { AuthProvider } = await vite.ssrLoadModule(
    '/src/features/auth/AuthProvider.tsx',
  );
  for (const role of [null, 'Student', 'Admin']) {
    if (role)
      auth.setAuthenticated('test-token', {
        id: 1,
        role,
        fullName: 'Test',
        email: 'test@example.invalid',
        avatarUrl: null,
      });
    else auth.setGuest();
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(
          AuthProvider,
          null,
          createElement(PublicLayout, null, 'Content'),
        ),
      ),
    );
    assert.equal(html.includes('aria-haspopup="dialog"'), role === 'Student');
  }
});
