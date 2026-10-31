import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';

let vite, api, auth, lifecycle, ui, AuthProvider, RequireRole;
const originalFetch = globalThis.fetch;
const evaluatedAt = '2026-10-30T08:00:00Z';
const admin = {
  id: 1,
  role: 'Admin',
  fullName: 'Test Admin',
  email: 'admin@test.invalid',
  avatarUrl: null,
};
const bodies = [
  { totalAccounts: 0, evaluatedAt },
  { byStatus: { Pending: 0, Approved: 2, Rejected: 0 }, evaluatedAt },
  { posts: 0, comments: 0, evaluatedAt },
];
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const tick = () => new Promise((resolve) => setImmediate(resolve));
before(async () => {
  vite = await createServer({
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true },
  });
  api = await vite.ssrLoadModule('/src/features/admin/dashboard/api.ts');
  auth = await vite.ssrLoadModule('/src/features/auth/auth-state.ts');
  lifecycle = await vite.ssrLoadModule(
    '/src/features/admin/dashboard/metric-request.ts',
  );
  ui = await vite.ssrLoadModule(
    '/src/features/admin/dashboard/AdminDashboardPage.tsx',
  );
  ({ AuthProvider } = await vite.ssrLoadModule(
    '/src/features/auth/AuthProvider.tsx',
  ));
  ({ RequireRole } = await vite.ssrLoadModule(
    '/src/features/auth/AuthGuard.tsx',
  ));
});
after(async () => {
  globalThis.fetch = originalFetch;
  auth.setGuest();
  await vite?.close();
});

test('metric parsers retain zeros, reject incomplete/invalid counts and validate real UTC evaluatedAt', () => {
  const parsers = [api.parseAccounts, api.parseOpportunities, api.parseForum];
  for (const [i, parse] of parsers.entries()) {
    assert.deepEqual(parse(bodies[i]), bodies[i]);
    for (const value of [
      null,
      {},
      [],
      { ...bodies[i], evaluatedAt: '2026-02-30T00:00:00Z' },
      { ...bodies[i], evaluatedAt: '2026-10-30' },
      { ...bodies[i], evaluatedAt: '2026-10-30T08:00:00+07:00' },
    ])
      assert.throws(() => parse(value), { code: 'INVALID_RESPONSE' });
  }
  for (const totalAccounts of [-1, 1.5, '0', null, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => api.parseAccounts({ totalAccounts, evaluatedAt }));
  assert.throws(() =>
    api.parseOpportunities({
      byStatus: { Pending: 1, Approved: 0 },
      evaluatedAt,
    }),
  );
  assert.throws(() => api.parseForum({ posts: 0, evaluatedAt }));
});

test('all three API calls start in parallel with shared Bearer, exact paths, no query/body and AbortSignal', async () => {
  auth.setAuthenticated('test-token', admin);
  const signal = new AbortController().signal;
  const pending = [];
  globalThis.fetch = (path, options) =>
    new Promise((resolve) => {
      pending.push({ path, options, resolve });
    });
  const result = Promise.all([
    api.getAccounts(signal),
    api.getOpportunities(signal),
    api.getForum(signal),
  ]);
  assert.deepEqual(
    pending.map((r) => r.path),
    ['accounts', 'opportunities', 'forum'].map(
      (name) => '/api/admin/dashboard/' + name,
    ),
  );
  for (const [i, call] of pending.entries()) {
    assert.equal(
      call.options.headers.get('Authorization'),
      'Bearer test-token',
    );
    assert.equal(call.options.method, 'GET');
    assert.equal(call.options.body, undefined);
    assert.equal(call.options.signal, signal);
    call.resolve(json(bodies[i]));
  }
  assert.deepEqual(await result, bodies);
});

test('API failures/malformed payloads remain errors and refresh reuses shared auth', async () => {
  const signal = new AbortController().signal;
  for (const status of [403, 503, 500]) {
    globalThis.fetch = async () =>
      json({ error: { code: 'TEST_ERROR', message: 'Failure' } }, status);
    await assert.rejects(api.getAccounts(signal), { status });
  }
  globalThis.fetch = async () => json({ totalAccounts: null, evaluatedAt });
  await assert.rejects(api.getAccounts(signal), { code: 'INVALID_RESPONSE' });
  globalThis.fetch = async () => {
    throw new Error('Network');
  };
  await assert.rejects(api.getForum(signal), { code: 'NETWORK_ERROR' });
  auth.setAuthenticated('expired', admin);
  globalThis.fetch = async (path, options) => {
    if (path === '/api/auth/refresh')
      return json({
        user: admin,
        accessToken: 'fresh',
        tokenType: 'Bearer',
        expiresIn: 900,
      });
    if (path === '/api/auth/me') return json({ user: admin });
    return options.headers.get('Authorization') === 'Bearer expired'
      ? json({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401)
      : json(bodies[0]);
  };
  assert.deepEqual(await api.getAccounts(signal), bodies[0]);
});

test('independent card lifecycles preserve successful siblings and retry only the failed card', async () => {
  auth.setAuthenticated('token', admin);
  const states = [[], [], []];
  const calls = [0, 0, 0];
  const loaders = bodies.map((body, i) => async () => {
    calls[i]++;
    if (i === 1 && calls[i] === 1) throw new Error('Unavailable');
    return body;
  });
  const stops = loaders.map((load, i) =>
    lifecycle.startMetricRequest(load, (state) => states[i].push(state)),
  );
  await tick();
  assert.deepEqual(
    states.map((s) => s.at(-1).status),
    ['success', 'error', 'success'],
  );
  assert.equal('data' in states[1].at(-1), false);
  stops[1]();
  const retry = lifecycle.startMetricRequest(loaders[1], (state) =>
    states[1].push(state),
  );
  await tick();
  assert.deepEqual(calls, [1, 2, 1]);
  assert.equal(states[1].at(-1).status, 'success');
  stops.forEach((stop) => stop());
  retry();
});

test('account/session/role changes and unmount abort and ignore late results; refresh keeps same account safe', async () => {
  for (const change of [
    () => auth.setGuest(),
    () => auth.setAuthenticated('other', { ...admin, id: 2 }),
    () => auth.setAuthenticated('student', { ...admin, role: 'Student' }),
    null,
  ]) {
    auth.setAuthenticated('token', admin);
    let finish, signal;
    const states = [];
    const stop = lifecycle.startMetricRequest(
      (s) => {
        signal = s;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
      (state) => states.push(state),
    );
    if (change) change();
    else stop();
    assert.equal(signal.aborted, true);
    finish(bodies[0]);
    await tick();
    assert.deepEqual(states, [{ status: 'loading' }]);
    stop();
  }
  auth.setAuthenticated('token', admin);
  let finish, signal;
  const states = [];
  const stop = lifecycle.startMetricRequest(
    (s) => {
      signal = s;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    (state) => states.push(state),
  );
  auth.setAuthenticated('refreshed', admin);
  assert.equal(signal.aborted, false);
  finish(bodies[0]);
  await tick();
  assert.equal(states.at(-1).status, 'success');
  stop();
});

test('rendered sections distinguish loading/errors from zero and expose retries and timestamps', () => {
  const render = (state) =>
    renderToStaticMarkup(
      createElement(
        ui.MetricContent,
        { title: 'Accounts', state, retry() {} },
        (data) => createElement('output', null, data.totalAccounts),
      ),
    );
  const loading = render({ status: 'loading' });
  assert.ok(loading.includes('Đang tải số liệu'));
  assert.equal(loading.includes('<output>'), false);
  const failed = render({ status: 'error', message: 'Unavailable' });
  assert.ok(failed.includes('role="alert"'));
  assert.ok(failed.includes('Thử lại'));
  assert.equal(failed.includes('<output>'), false);
  const zero = render({ status: 'success', data: bodies[0] });
  assert.ok(zero.includes('<output>0</output>'));
  assert.ok(
    zero.includes(`dateTime="${evaluatedAt}"`) ||
      zero.includes(`datetime="${evaluatedAt}"`),
  );
});

test('existing Admin guard and dashboard prevent Guest/Student rendering; Admin sees exactly three sections', () => {
  for (const role of [null, 'Student', 'Admin']) {
    if (role) auth.setAuthenticated('token', { ...admin, role });
    else auth.setGuest();
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/admin/dashboard'] },
        createElement(
          AuthProvider,
          null,
          createElement(
            RequireRole,
            { role: 'Admin' },
            createElement(ui.AdminDashboardPage),
          ),
        ),
      ),
    );
    assert.equal(html.includes('Dashboard thống kê'), role === 'Admin');
    if (role === 'Admin')
      for (const title of ['Tổng tài khoản', 'Cơ hội', 'Diễn đàn'])
        assert.ok(html.includes(`aria-label="${title}"`));
    const updates = [];
    let loads = 0;
    const stop = lifecycle.startMetricRequest(
      async () => {
        loads++;
        return bodies[0];
      },
      (s) => updates.push(s),
    );
    assert.equal(loads, role === 'Admin' ? 1 : 0);
    stop();
  }
});
