import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let vite, api, contracts, fetcher;
const originalFetch = globalThis.fetch;

const sampleUser = {
  id: 12,
  fullName: 'Nguyễn An',
  email: 'an@example.invalid',
  major: { id: 4, name: 'Khoa học dữ liệu' },
  academicYear: 2,
  role: 'Student',
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

  api = await vite.ssrLoadModule('/src/features/admin/users/api.ts');
  contracts = await vite.ssrLoadModule(
    '/src/features/admin/users/contracts.ts',
  );
});

afterEach(() => {
  fetcher = originalFetch;
});

after(async () => {
  globalThis.fetch = originalFetch;
  await vite?.close();
});

// ----------------- CONTRACT TESTS -----------------

test('contracts: parseAdminUsersResponse parses valid response and handles null major/academicYear', () => {
  const payload = {
    items: [
      sampleUser,
      {
        id: 15,
        fullName: 'Trần Bình',
        email: 'binh@example.invalid',
        major: null,
        academicYear: null,
        role: 'Admin',
      },
    ],
    meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
  };

  const parsed = contracts.parseAdminUsersResponse(payload);
  assert.equal(parsed.items.length, 2);
  assert.deepEqual(parsed.items[0], sampleUser);
  assert.equal(parsed.items[1].major, null);
  assert.equal(parsed.items[1].academicYear, null);
  assert.equal(parsed.items[1].role, 'Admin');
  assert.deepEqual(parsed.meta, payload.meta);
});

test('contracts: parseAdminUsersResponse rejects invalid data structures', () => {
  assert.throws(() => contracts.parseAdminUsersResponse(null));
  assert.throws(() => contracts.parseAdminUsersResponse([]));
  assert.throws(() =>
    contracts.parseAdminUsersResponse({ items: 'not-array', meta: {} }),
  );
  assert.throws(() =>
    contracts.parseAdminUsersResponse({
      items: [{ ...sampleUser, id: -1 }],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    }),
  );
  assert.throws(() =>
    contracts.parseAdminUsersResponse({
      items: [{ ...sampleUser, role: 'InvalidRole' }],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    }),
  );
});

test('contracts: parseAdminUserRoleChange parses changed boolean and role enum', () => {
  const change1 = {
    changed: true,
    user: { id: 12, role: 'Admin' },
  };
  const parsed1 = contracts.parseAdminUserRoleChange(change1);
  assert.equal(parsed1.changed, true);
  assert.equal(parsed1.user.role, 'Admin');

  const change2 = {
    changed: false,
    user: { id: 12, role: 'Student' },
  };
  const parsed2 = contracts.parseAdminUserRoleChange(change2);
  assert.equal(parsed2.changed, false);
  assert.equal(parsed2.user.role, 'Student');
});

// ----------------- API TESTS -----------------

test('api: getAdminUsers sends Bearer header, query params and signal', async () => {
  const controller = new AbortController();
  fetcher = async (path, options) => {
    assert.equal(path, '/api/admin/users?page=2&pageSize=10&q=Nguy%E1%BB%85n');
    assert.equal(options.method, 'GET');
    assert.equal(
      options.headers.get('Authorization'),
      'Bearer admin-test-token',
    );
    assert.equal(options.body, undefined);
    assert.equal(options.signal, controller.signal);

    return json({
      items: [sampleUser],
      meta: { page: 2, pageSize: 10, total: 11, totalPages: 2 },
    });
  };

  const res = await api.getAdminUsers(
    'admin-test-token',
    { page: 2, pageSize: 10, q: 'Nguyễn' },
    controller.signal,
  );

  assert.equal(res.items.length, 1);
  assert.equal(res.meta.page, 2);
  assert.equal(res.meta.total, 11);
});

test('api: getAdminUsers client-side query validation', async () => {
  // Empty token
  await assert.rejects(
    () => api.getAdminUsers(''),
    (err) => err.code === 'UNAUTHORIZED',
  );

  // Invalid page
  await assert.rejects(
    () => api.getAdminUsers('token', { page: 0 }),
    (err) => err.code === 'INVALID_QUERY',
  );

  // Invalid pageSize
  await assert.rejects(
    () => api.getAdminUsers('token', { pageSize: 150 }),
    (err) => err.code === 'INVALID_QUERY',
  );

  // q > 100 characters
  await assert.rejects(
    () => api.getAdminUsers('token', { q: 'a'.repeat(101) }),
    (err) => err.code === 'INVALID_QUERY',
  );
});

test('api: patchAdminUserRole sends PATCH request with exact JSON body', async () => {
  fetcher = async (path, options) => {
    assert.equal(path, '/api/admin/users/12/role');
    assert.equal(options.method, 'PATCH');
    assert.equal(
      options.headers.get('Authorization'),
      'Bearer admin-test-token',
    );
    assert.equal(options.headers.get('Content-Type'), 'application/json');
    assert.equal(options.body, JSON.stringify({ role: 'Admin' }));

    return json({
      changed: true,
      user: { id: 12, role: 'Admin' },
    });
  };

  const res = await api.patchAdminUserRole('admin-test-token', 12, 'Admin');
  assert.equal(res.changed, true);
  assert.equal(res.user.role, 'Admin');
});

test('api: patchAdminUserRole client-side validation', async () => {
  await assert.rejects(
    () => api.patchAdminUserRole('', 12, 'Admin'),
    (err) => err.code === 'UNAUTHORIZED',
  );

  await assert.rejects(
    () => api.patchAdminUserRole('token', -1, 'Admin'),
    (err) => err.code === 'INVALID_ID',
  );

  await assert.rejects(
    () => api.patchAdminUserRole('token', 12, 'SuperAdmin'),
    (err) => err.code === 'VALIDATION_ERROR',
  );
});
