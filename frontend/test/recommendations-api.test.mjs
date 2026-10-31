import assert from 'node:assert/strict';
import { before, after, beforeEach, afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { parseRecommendations } from '../src/features/recommendations/contracts.ts';
import { roleGateState } from '../src/features/auth/role-access.ts';
import { loginDestination } from '../src/features/auth/return-path.ts';
const evaluatedAt = '2026-11-05T17:00:00Z';
const item = {
  id: 41,
  type: 'Thực tập',
  title: 'Opportunity',
  publisher: 'Publisher',
  workFormat: 'Online',
  location: null,
  deadline: null,
  isVerified: false,
  matchScore: 0.7632,
};
const payload = (items = [item]) => ({ items, meta: { evaluatedAt } });
let vite, api, auth, fetcher;
const user = {
  id: 42,
  email: 'student@example.invalid',
  fullName: 'Student',
  avatarUrl: null,
  role: 'Student',
};
const original = globalThis.fetch;
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
before(async () => {
  globalThis.fetch = (...args) => fetcher(...args);
  vite = await createServer({
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true },
  });
  api = await vite.ssrLoadModule('/src/features/recommendations/api.ts');
  auth = await vite.ssrLoadModule('/src/features/auth/auth-state.ts');
});
beforeEach(() => auth.setAuthenticated('student-test-token', user));

afterEach(() => {
  auth.setGuest();
  fetcher = original;
});
after(async () => {
  globalThis.fetch = original;
  await vite?.close();
});

test('shared client sends exact Recommendations GET, Bearer token, no query/body and signal', async () => {
  const controller = new AbortController();
  fetcher = async (path, options) => {
    assert.equal(path, '/api/recommendations');
    assert.equal(options.method, 'GET');
    assert.equal(options.body, undefined);
    assert.equal(
      options.headers.get('Authorization'),
      'Bearer student-test-token',
    );
    assert.equal(options.signal, controller.signal);
    assert.equal(options.headers.get('Accept'), 'application/json');
    return json(payload());
  };
  assert.deepEqual(await api.getRecommendations(controller.signal), payload());
});

test('parser preserves server order and rounded-score ties, plain text, metadata and empty result', () => {
  const input = payload([
    {
      ...item,
      id: 99,
      title: '<script>text only</script>',
      privateField: 'not returned',
    },
    { ...item, id: 1 },
  ]);
  const result = parseRecommendations(input);
  assert.deepEqual(
    result.items.map((row) => row.id),
    [99, 1],
  );
  assert.equal(result.items[0].title, '<script>text only</script>');
  assert.equal(Object.hasOwn(result.items[0], 'privateField'), false);
  assert.equal(input.items[0].privateField, 'not returned');
  assert.deepEqual(parseRecommendations(payload([])), payload([]));
});

test('known deadline validation honors evaluatedAt: date cutoff exclusive and datetime equality allowed', () => {
  const date = {
    precision: 'date',
    date: '2026-11-06',
    sourceTimeZone: null,
    instant: '2026-11-06T17:00:00Z',
    state: 'open',
  };
  const datetime = {
    precision: 'datetime',
    date: '2026-11-06',
    sourceTimeZone: 'Asia/Ho_Chi_Minh',
    instant: evaluatedAt,
    state: 'open',
  };
  assert.equal(
    parseRecommendations(payload([{ ...item, deadline: date }])).items[0]
      .deadline.precision,
    'date',
  );
  assert.equal(
    parseRecommendations(payload([{ ...item, deadline: datetime }])).items[0]
      .deadline.precision,
    'datetime',
  );
  for (const deadline of [
    { ...date, instant: evaluatedAt },
    { ...datetime, instant: '2026-11-05T16:59:59Z' },
    { ...date, date: '2026-02-30' },
    { ...datetime, sourceTimeZone: '' },
    { ...date, state: 'expired' },
    { ...date, precision: 'unknown' },
    { ...date, instant: '2026-02-30T17:00:00Z' },
  ])
    assert.throws(
      () => parseRecommendations(payload([{ ...item, deadline }])),
      { code: 'INVALID_RESPONSE' },
    );
});

test('rejects malformed envelope/meta/IDs/scores/types/fields; never silently filters bad items', () => {
  for (const value of [
    null,
    {},
    { items: [], meta: {} },
    { items: [], meta: { evaluatedAt: '2026-02-30T00:00:00Z' } },
    payload([item, item]),
    ...[
      { id: '41' },
      { id: 0 },
      { id: 2147483648 },
      { type: 'Bài viết định hướng' },
      { type: 'thực tập' },
      { publisher: null },
      { title: null },
      { workFormat: ['Online'] },
      { location: 1 },
      { isVerified: 1 },
      { deadline: undefined },
      { matchScore: NaN },
      { matchScore: Infinity },
      { matchScore: 0.4999 },
      { matchScore: 1.0001 },
      { matchScore: 0.76321 },
    ].map((changes) => payload([{ ...item, ...changes }])),
  ])
    assert.throws(() => parseRecommendations(value), {
      code: 'INVALID_RESPONSE',
      kind: 'response',
    });
});

test('401/403/409 and service errors keep shared status/code', async () => {
  for (const [status, code] of [
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [409, 'PROFILE_INCOMPLETE'],
    [503, 'SERVICE_UNAVAILABLE'],
    [500, 'INTERNAL_ERROR'],
  ]) {
    auth.setAuthenticated('student-test-token', user);
    fetcher = async () =>
      json({ error: { code, message: 'Safe message' } }, status);
    await assert.rejects(api.getRecommendations(), {
      status,
      code,
      kind: 'http',
    });
  }
});

test('network, malformed successful JSON and abort propagate without empty fallback', async () => {
  fetcher = async () => {
    throw new Error('private');
  };
  await assert.rejects(api.getRecommendations(), {
    code: 'NETWORK_ERROR',
  });
  fetcher = async () => json({ items: [] });
  await assert.rejects(api.getRecommendations(), {
    code: 'INVALID_RESPONSE',
  });
  const aborted = new DOMException('Abort', 'AbortError');
  fetcher = async () => {
    throw aborted;
  };
  await assert.rejects(api.getRecommendations(), (error) => error === aborted);
});

test('expired token refreshes once and retries with the current token; manual retry stays current', async () => {
  const calls = [];
  const controller = new AbortController();
  fetcher = async (path, init) => {
    calls.push([path, init.headers.get('Authorization')]);
    if (path === '/api/auth/refresh') {
      assert.equal(init.method, 'POST');
      assert.equal(init.credentials, 'include');
      return json({
        accessToken: 'rotated-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        user,
      });
    }
    if (path === '/api/auth/me') return json({ user });
    assert.equal(init.signal, controller.signal);
    return init.headers.get('Authorization') === 'Bearer student-test-token'
      ? json({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401)
      : json(payload());
  };
  assert.deepEqual(await api.getRecommendations(controller.signal), payload());
  assert.deepEqual(await api.getRecommendations(controller.signal), payload());
  assert.deepEqual(calls, [
    ['/api/recommendations', 'Bearer student-test-token'],
    ['/api/auth/refresh', null],
    ['/api/auth/me', 'Bearer rotated-token'],
    ['/api/recommendations', 'Bearer rotated-token'],
    ['/api/recommendations', 'Bearer rotated-token'],
  ]);
});

test('refresh rejection clears auth so the guard goes to login and login does not bounce back', async () => {
  const calls = [];
  fetcher = async (path) => {
    calls.push(path);
    return json({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401);
  };
  await assert.rejects(api.getRecommendations(), { status: 401 });
  assert.deepEqual(calls, ['/api/recommendations', '/api/auth/refresh']);
  assert.equal(auth.getAccessToken(), null);
  const { status, user } = auth.getAuthSnapshot();
  assert.equal(status, 'guest');
  assert.equal(roleGateState(status, user?.role ?? null, 'Student'), 'login');
  assert.equal(
    loginDestination('/recommendations', 'Student'),
    '/recommendations',
  );
  // LoginPage redirects only authenticated users; this state remains on login.
  assert.notEqual(status, 'authenticated');
  const { AuthProvider } = await vite.ssrLoadModule(
    '/src/features/auth/AuthProvider.tsx',
  );
  const { LoginPage } = await vite.ssrLoadModule(
    '/src/features/auth/LoginPage.tsx',
  );
  const previousWindow = globalThis.window;
  globalThis.window = { location: { origin: 'http://localhost' } };
  try {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/login?returnTo=%2Frecommendations'] },
        createElement(AuthProvider, null, createElement(LoginPage)),
      ),
    );
    // Navigate would render no login content if stale authenticated state survived.
    assert.match(html, /Google/);
    assert.ok(html.length > 0);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('a second 401 after refresh ends the session without another refresh loop', async () => {
  let refreshes = 0,
    requests = 0;
  fetcher = async (path) => {
    if (path === '/api/auth/refresh') {
      refreshes++;
      return json({
        accessToken: 'rotated-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        user,
      });
    }
    if (path === '/api/auth/me') return json({ user });
    requests++;
    return json({ error: { code: 'UNAUTHORIZED', message: 'Revoked' } }, 401);
  };
  await assert.rejects(api.getRecommendations(), { status: 401 });
  assert.equal(refreshes, 1);
  assert.equal(requests, 2);
  assert.equal(auth.getAuthSnapshot().status, 'guest');
});

test('refresh outage keeps the route unavailable; restoring then retrying uses the new token', async () => {
  fetcher = async (path) =>
    json(
      {
        error: {
          code:
            path === '/api/auth/refresh'
              ? 'SERVICE_UNAVAILABLE'
              : 'UNAUTHORIZED',
          message: 'Unavailable',
        },
      },
      path === '/api/auth/refresh' ? 503 : 401,
    );
  await assert.rejects(api.getRecommendations(), { status: 503 });
  assert.equal(auth.getAccessToken(), null);
  assert.equal(
    roleGateState(auth.getAuthSnapshot().status, null, 'Student'),
    'unavailable',
  );
  // AuthProvider's retryRestore uses this same restoration operation.
  const { restoreAuthSession } = await vite.ssrLoadModule(
    '/src/features/auth/auth-api.ts',
  );
  fetcher = async (path, init) => {
    if (path === '/api/auth/refresh')
      return json({
        accessToken: 'recovered-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        user,
      });
    if (path === '/api/auth/me') return json({ user });
    assert.equal(init.headers.get('Authorization'), 'Bearer recovered-token');
    return json(payload());
  };
  await restoreAuthSession();
  assert.equal(
    roleGateState(
      auth.getAuthSnapshot().status,
      auth.getAuthSnapshot().user.role,
      'Student',
    ),
    'allow',
  );
  assert.deepEqual(await api.getRecommendations(), payload());
});

test('refresh re-reads an Admin role and the Student guard denies access', async () => {
  const admin = { ...user, role: 'Admin' };
  fetcher = async (path) => {
    if (path === '/api/auth/refresh')
      return json({
        accessToken: 'admin-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: admin,
      });
    if (path === '/api/auth/me') return json({ user: admin });
    return auth.getAccessToken() === 'admin-token'
      ? json({ error: { code: 'FORBIDDEN', message: 'Student only' } }, 403)
      : json({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401);
  };
  await assert.rejects(api.getRecommendations(), { status: 403 });
  const current = auth.getAuthSnapshot();
  assert.equal(
    roleGateState(current.status, current.user.role, 'Student'),
    'forbidden',
  );
});
