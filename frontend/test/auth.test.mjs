import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import {
  getAccessToken,
  getAuthSnapshot,
  setAuthenticated,
  setGuest,
} from '../src/features/auth/auth-state.ts';
import {
  loginWithGoogleIdToken,
  logoutCurrentSession,
  protectedApiRequest,
  restoreAuthSession,
} from '../src/features/auth/auth-api.ts';
import { safeReturnPath } from '../src/features/auth/return-path.ts';
import { roleGateState } from '../src/features/auth/role-access.ts';

const user = {
  id: 42,
  email: 'student@example.invalid',
  fullName: 'Nguyễn An',
  avatarUrl: null,
  role: 'Student',
};

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  setGuest();
  globalThis.fetch = originalFetch;
});

const originalFetch = globalThis.fetch;

test('Google login sends only the ID token, then reads the UniHub user', async () => {
  const calls = [];
  globalThis.fetch = async (path, init) => {
    calls.push({ path, init });
    if (path === '/api/auth/google') {
      return json({
        accessToken: 'unihub-access',
        tokenType: 'Bearer',
        expiresIn: 900,
        user,
      });
    }
    if (path === '/api/auth/me') return json({ user });
    throw new Error(`Unexpected request: ${path}`);
  };

  await loginWithGoogleIdToken('google-id-token');

  assert.equal(calls.length, 2);
  assert.equal(calls[0].path, '/api/auth/google');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    idToken: 'google-id-token',
  });
  assert.equal(calls[0].init.credentials, 'include');
  assert.equal(calls[0].init.headers.get('Authorization'), null);
  assert.equal(calls[1].path, '/api/auth/me');
  assert.equal(
    calls[1].init.headers.get('Authorization'),
    'Bearer unihub-access',
  );
  assert.equal(getAuthSnapshot().status, 'authenticated');
  assert.equal(getAuthSnapshot().user.role, 'Student');
  assert.equal(getAccessToken(), 'unihub-access');
});

test('session restoration uses refresh cookie and then verifies /me', async () => {
  const calls = [];
  globalThis.fetch = async (path, init) => {
    calls.push({ path, init });
    if (path === '/api/auth/refresh') {
      return json({
        accessToken: 'restored-access',
        tokenType: 'Bearer',
        expiresIn: 900,
        user,
      });
    }
    if (path === '/api/auth/me') return json({ user });
    throw new Error(`Unexpected request: ${path}`);
  };

  await restoreAuthSession();

  assert.deepEqual(
    calls.map((call) => call.path),
    ['/api/auth/refresh', '/api/auth/me'],
  );
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.credentials, 'include');
  assert.equal(calls[0].init.headers.get('Content-Type'), 'application/json');
  assert.equal(calls[0].init.headers.get('Authorization'), null);
  assert.equal(getAuthSnapshot().status, 'authenticated');
  assert.equal(getAccessToken(), 'restored-access');
});

test('missing refresh session becomes Guest while service errors stay unavailable', async () => {
  globalThis.fetch = async () =>
    json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401);
  await restoreAuthSession();
  assert.equal(getAuthSnapshot().status, 'guest');

  globalThis.fetch = async () =>
    json(
      { error: { code: 'SERVICE_UNAVAILABLE', message: 'Unavailable' } },
      503,
    );
  await restoreAuthSession();
  assert.equal(getAuthSnapshot().status, 'unavailable');
});

test('protected API refreshes one time after 401 and retries with new access JWT', async () => {
  const calls = [];
  setAuthenticated('expired-access', user);
  globalThis.fetch = async (path, init) => {
    calls.push({ path, init });
    if (
      path === '/api/admin/example' &&
      calls.filter((call) => call.path === path).length === 1
    ) {
      return json({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401);
    }
    if (path === '/api/auth/refresh') {
      return json({
        accessToken: 'fresh-access',
        tokenType: 'Bearer',
        expiresIn: 900,
        user,
      });
    }
    if (path === '/api/auth/me') return json({ user });
    if (path === '/api/admin/example') return json({ ok: true });
    throw new Error(`Unexpected request: ${path}`);
  };

  assert.deepEqual(await protectedApiRequest('/api/admin/example'), {
    ok: true,
  });
  assert.deepEqual(
    calls.map((call) => call.path),
    [
      '/api/admin/example',
      '/api/auth/refresh',
      '/api/auth/me',
      '/api/admin/example',
    ],
  );
  assert.equal(
    calls[0].init.headers.get('Authorization'),
    'Bearer expired-access',
  );
  assert.equal(
    calls[3].init.headers.get('Authorization'),
    'Bearer fresh-access',
  );
  assert.equal(calls[1].init.headers.get('Authorization'), null);
  assert.equal(getAccessToken(), 'fresh-access');
});

test('logout clears memory and calls the cookie endpoint without a bearer token', async () => {
  setAuthenticated('access-to-clear', user);
  let received;
  globalThis.fetch = async (path, init) => {
    received = { path, init };
    return new Response(null, { status: 204 });
  };

  await logoutCurrentSession();

  assert.equal(received.path, '/api/auth/logout');
  assert.equal(received.init.method, 'POST');
  assert.equal(received.init.credentials, 'include');
  assert.equal(received.init.headers.get('Authorization'), null);
  assert.equal(getAccessToken(), null);
  assert.equal(getAuthSnapshot().status, 'guest');
});

test('logout reports server revocation failure after clearing local auth', async () => {
  setAuthenticated('access-to-clear', user);
  globalThis.fetch = async () => {
    throw new TypeError('network failure');
  };

  await assert.rejects(logoutCurrentSession());
  assert.equal(getAccessToken(), null);
  assert.equal(getAuthSnapshot().status, 'guest');
  assert.match(getAuthSnapshot().error, /máy chủ chưa xác nhận/);
});

test('return path accepts only same-origin local paths', () => {
  assert.equal(
    safeReturnPath('/admin?tab=queue', 'https://unihub.test'),
    '/admin?tab=queue',
  );
  assert.equal(
    safeReturnPath('//attacker.example', 'https://unihub.test'),
    '/opportunities',
  );
  assert.equal(
    safeReturnPath('https://attacker.example', 'https://unihub.test'),
    '/opportunities',
  );
  assert.equal(
    safeReturnPath('/login', 'https://unihub.test'),
    '/opportunities',
  );
  assert.equal(safeReturnPath(null, 'https://unihub.test'), '/opportunities');
});

test('Admin route guard separates restore, Guest, Student, Admin and unavailable states', () => {
  assert.equal(roleGateState('restoring', null, 'Admin'), 'pending');
  assert.equal(roleGateState('guest', null, 'Admin'), 'login');
  assert.equal(roleGateState('authenticated', 'Student', 'Admin'), 'forbidden');
  assert.equal(roleGateState('authenticated', 'Admin', 'Admin'), 'allow');
  assert.equal(roleGateState('unavailable', null, 'Admin'), 'unavailable');
});
