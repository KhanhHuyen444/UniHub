import assert from 'node:assert/strict';
import { before, after, afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
let vite, api, contracts, fetcher;
const original = globalThis.fetch;
const row = {
  id: 12,
  type: 'Major',
  name: 'Data',
  status: 'Active',
  createdAt: '2026-10-28T18:30:00.000Z',
};
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
  api = await vite.ssrLoadModule('/src/features/admin/categories/api.ts');
  const state = await vite.ssrLoadModule('/src/features/auth/auth-state.ts');
  const originalApi = api;
  api = new Proxy(originalApi, {
    get(target, key) {
      return (...args) => {
        state.setAuthenticated(args[0], {
          id: 1,
          email: 'test@example.com',
          fullName: 'Test',
          avatarUrl: null,
          role: 'Admin',
        });
        return target[key](...args);
      };
    },
  });
  contracts = await vite.ssrLoadModule(
    '/src/features/admin/categories/contracts.ts',
  );
});
afterEach(() => {
  fetcher = original;
});
after(async () => {
  globalThis.fetch = original;
  await vite?.close();
});

test('list sends exact type, shared Bearer GET, no body and signal; parses Active and Closed', async () => {
  const controller = new AbortController();
  fetcher = async (path, options) => {
    assert.equal(path, '/api/admin/categories?type=Major');
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.get('Authorization'), 'Bearer test-token');
    assert.equal(options.body, undefined);
    assert.equal(options.signal, controller.signal);
    return json({ items: [row, { ...row, id: 13, status: 'Closed' }] });
  };
  assert.deepEqual(
    await api.getAdminCategories('test-token', 'Major', controller.signal),
    [row, { ...row, id: 13, status: 'Closed' }],
  );
});

test('create/rename/status use approved JSON payloads and mutation response, including changed:false', async () => {
  const cases = [
    [
      () => api.createAdminCategory('token', 'Major', ' New ', null),
      '/api/admin/categories',
      'POST',
      { type: 'Major', name: 'New', reason: null },
      { category: { ...row, name: 'New' } },
    ],
    [
      () => api.renameAdminCategory('token', 12, ' Data ', 'Reason'),
      '/api/admin/categories/12',
      'PATCH',
      { name: 'Data', reason: 'Reason' },
      { changed: false, category: row },
    ],
    [
      () => api.setAdminCategoryStatus('token', 12, 'Closed', null),
      '/api/admin/categories/12/status',
      'PATCH',
      { status: 'Closed', reason: null },
      { changed: true, category: { ...row, status: 'Closed' } },
    ],
  ];
  for (const [call, path, method, body, response] of cases) {
    fetcher = async (actual, options) => {
      assert.equal(actual, path);
      assert.equal(options.method, method);
      assert.equal(options.headers.get('Authorization'), 'Bearer token');
      assert.equal(options.headers.get('Content-Type'), 'application/json');
      assert.deepEqual(JSON.parse(options.body), body);
      return json(response, method === 'POST' ? 201 : 200);
    };
    const result = await call();
    assert.deepEqual(result, method === 'POST' ? response.category : response);
  }
});

test('invalid request IDs/types/status/name/reason fail before fetch; Unicode code point boundary works', async () => {
  fetcher = async () => {
    assert.fail('Invalid input reached network.');
  };
  for (const call of [
    () => api.getAdminCategories('', 'Major'),
    () => api.getAdminCategories('token', 'major'),
    () => api.createAdminCategory('token', 'Major', '  ', null),
    () => api.createAdminCategory('token', 'Major', 'x'.repeat(101), null),
    () => api.createAdminCategory('token', 'Skill', 'X', '😀'.repeat(501)),
    () => api.renameAdminCategory('token', 0, 'X', null),
    () => api.renameAdminCategory('token', 2147483648, 'X', null),
    () => api.setAdminCategoryStatus('token', 12, 'closed', null),
  ])
    await assert.rejects(call(), (error) => error.kind === 'request');
  fetcher = async () =>
    json({ category: { ...row, name: '😀'.repeat(100) } }, 201);
  assert.equal(
    (
      await api.createAdminCategory(
        'token',
        'Major',
        '😀'.repeat(100),
        '😀'.repeat(500),
      )
    ).name.length,
    200,
  );
});

test('response rejects wrong shape/IDs/type/status/duplicates and inconsistent mutation result', async () => {
  for (const value of [
    null,
    {},
    { items: null },
    { items: [row, row] },
    ...[
      { ...row, id: '12' },
      { ...row, status: 'closed' },
      { ...row, type: 'major' },
      { ...row, name: '' },
      { ...row, id: 2147483648 },
    ].map((item) => ({ items: [item] })),
    { items: [{ ...row, type: 'Skill' }] },
  ])
    assert.throws(() => contracts.parseAdminCategories(value, 'Major'), {
      code: 'INVALID_RESPONSE',
    });
  for (const value of [
    { category: row },
    { changed: 'true', category: row },
    { changed: true, category: null },
  ])
    assert.throws(() => contracts.parseCategoryChange(value), {
      code: 'INVALID_RESPONSE',
    });
  fetcher = async () => json({ category: { ...row, status: 'Closed' } });
  await assert.rejects(
    api.createAdminCategory('token', 'Major', 'Data', null),
    { code: 'INVALID_RESPONSE' },
  );
  fetcher = async () => json({ changed: true, category: { ...row, id: 99 } });
  await assert.rejects(api.renameAdminCategory('token', 12, 'Data', null), {
    code: 'INVALID_RESPONSE',
  });
  fetcher = async () => json({ changed: true, category: row });
  await assert.rejects(
    api.setAdminCategoryStatus('token', 12, 'Closed', null),
    { code: 'INVALID_RESPONSE' },
  );
});

test('HTTP permission/business/database errors, network and abort propagate without empty fallback', async () => {
  for (const [status, code] of [
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [400, 'VALIDATION_ERROR'],
    [409, 'DUPLICATE_CATEGORY'],
    [409, 'LAST_ACTIVE_CATEGORY'],
    [503, 'SERVICE_UNAVAILABLE'],
    [500, 'INTERNAL_ERROR'],
  ]) {
    fetcher = async () =>
      json({ error: { code, message: 'Safe message' } }, status);
    await assert.rejects(api.getAdminCategories('token', 'Major'), {
      status,
      code,
      kind: 'http',
    });
  }
  fetcher = async () => {
    throw new Error('private');
  };
  await assert.rejects(api.getAdminCategories('token', 'Major'), {
    code: 'NETWORK_ERROR',
  });
  const aborted = new DOMException('Aborted', 'AbortError');
  fetcher = async () => {
    throw aborted;
  };
  await assert.rejects(
    api.getAdminCategories('token', 'Major'),
    (error) => error === aborted,
  );
});

test('401 refresh retries with rotated auth token and preserves AbortSignal', async () => {
  const user = {
    id: 1,
    email: 'test@example.com',
    fullName: 'Test',
    avatarUrl: null,
    role: 'Admin',
  };
  const controller = new AbortController();
  const seen = [];
  fetcher = async (path, options) => {
    seen.push(path);
    if (path === '/api/auth/refresh')
      return json({
        accessToken: 'rotated',
        tokenType: 'Bearer',
        expiresIn: 900,
        user,
      });
    if (path === '/api/auth/me') return json({ user });
    assert.equal(options.signal, controller.signal);
    if (options.headers.get('Authorization') !== 'Bearer rotated')
      return json({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401);
    return json({ items: [row] });
  };
  await api.getAdminCategories('old', 'Major', controller.signal);
  assert.equal(seen.filter((path) => path === '/api/auth/refresh').length, 1);
  assert.equal(seen.length, 4);
});

test('createdAt validates canonical UTC dates and safely normalizes invalid metadata', () => {
  assert.equal(contracts.parseAdminCategory(row).createdAt, row.createdAt);
  for (const createdAt of [
    undefined,
    null,
    123,
    '',
    'invalid',
    '2026-02-30T00:00:00.000Z',
    '2026-10-28',
    '2026-10-28T18:30:00.000+07:00',
  ]) {
    const result = contracts.parseAdminCategories(
      { items: [{ ...row, createdAt }] },
      'Major',
    );
    assert.equal(result[0].createdAt, null);
    assert.equal(result[0].name, row.name);
  }
});
