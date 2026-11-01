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

test('logout waits for an in-flight restore refresh and prevents it restoring auth or racing its cookie', async () => {
  let releaseRefresh;
  let refreshStarted;
  const started = new Promise((resolve) => {
    refreshStarted = resolve;
  });
  const calls = [];
  let cookieValue = 'old-cookie';
  globalThis.fetch = async (path) => {
    calls.push(path);
    if (path === '/api/auth/refresh') {
      await new Promise((resolve) => {
        releaseRefresh = () => {
          cookieValue = 'rotated-cookie';
          resolve();
        };
        refreshStarted();
      });
      return json({
        accessToken: 'stale-refresh-access',
        tokenType: 'Bearer',
        expiresIn: 900,
        user,
      });
    }
    if (path === '/api/auth/logout') {
      assert.equal(cookieValue, 'rotated-cookie');
      cookieValue = null;
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected request: ${path}`);
  };

  const restore = restoreAuthSession();
  await started;
  const logout = logoutCurrentSession();
  assert.equal(getAuthSnapshot().status, 'guest');
  assert.deepEqual(calls, ['/api/auth/refresh']);
  releaseRefresh();
  await Promise.all([restore, logout]);

  assert.deepEqual(calls, ['/api/auth/refresh', '/api/auth/logout']);
  assert.equal(cookieValue, null);
  assert.equal(getAccessToken(), null);
  assert.equal(getAuthSnapshot().status, 'guest');
});

test('logout invalidates a pending Google login and waits before revoking its cookie', async () => {
  let releaseLogin;
  let loginStarted;
  const started = new Promise((resolve) => {
    loginStarted = resolve;
  });
  const calls = [];
  let cookieValue = null;
  globalThis.fetch = async (path) => {
    calls.push(path);
    if (path === '/api/auth/google') {
      await new Promise((resolve) => {
        releaseLogin = () => {
          cookieValue = 'new-login-cookie';
          resolve();
        };
        loginStarted();
      });
      return json({
        accessToken: 'stale-login-access',
        tokenType: 'Bearer',
        expiresIn: 900,
        user,
      });
    }
    if (path === '/api/auth/logout') {
      assert.equal(cookieValue, 'new-login-cookie');
      cookieValue = null;
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected request: ${path}`);
  };

  const login = loginWithGoogleIdToken('google-id-token');
  await started;
  const logout = logoutCurrentSession();
  assert.equal(getAuthSnapshot().status, 'guest');
  releaseLogin();
  const loginResult = await Promise.allSettled([login]);
  await logout;

  assert.equal(loginResult[0].status, 'rejected');
  assert.deepEqual(calls, ['/api/auth/google', '/api/auth/logout']);
  assert.equal(cookieValue, null);
  assert.equal(getAccessToken(), null);
  assert.equal(getAuthSnapshot().status, 'guest');
});

test('a protected retry that still returns 401 clears auth and does not refresh again', async () => {
  const calls = [];
  setAuthenticated('expired-access', user);
  globalThis.fetch = async (path, init) => {
    calls.push({ path, init });
    if (path === '/api/protected/resource') {
      return json(
        { error: { code: 'UNAUTHORIZED', message: 'Expired token' } },
        401,
      );
    }
    if (path === '/api/auth/refresh') {
      return json({
        accessToken: 'new-access',
        tokenType: 'Bearer',
        expiresIn: 900,
        user,
      });
    }
    if (path === '/api/auth/me') return json({ user });
    throw new Error(`Unexpected request: ${path}`);
  };

  await assert.rejects(protectedApiRequest('/api/protected/resource'), {
    code: 'UNAUTHORIZED',
    status: 401,
  });
  assert.deepEqual(
    calls.map((call) => call.path),
    [
      '/api/protected/resource',
      '/api/auth/refresh',
      '/api/auth/me',
      '/api/protected/resource',
    ],
  );
  assert.equal(getAccessToken(), null);
  assert.equal(getAuthSnapshot().status, 'guest');
});

test('a retry with a newer concurrent token also clears auth on 401 without another refresh', async () => {
  let releaseOriginal;
  const originalStarted = new Promise((resolve) => {
    releaseOriginal = resolve;
  });
  let requestCount = 0;
  let firstStarted;
  const started = new Promise((resolve) => {
    firstStarted = resolve;
  });
  setAuthenticated('expired-access', user);
  const calls = [];
  globalThis.fetch = async (path, init) => {
    calls.push({ path, init });
    if (path === '/api/protected/resource') {
      requestCount += 1;
      if (requestCount === 1) {
        firstStarted();
        await originalStarted;
      }
      return json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid token' } },
        401,
      );
    }
    throw new Error(`Unexpected request: ${path}`);
  };

  const pendingRequest = protectedApiRequest('/api/protected/resource');
  await started;
  setAuthenticated('concurrent-new-access', user);
  releaseOriginal();
  await assert.rejects(pendingRequest, { code: 'UNAUTHORIZED', status: 401 });

  assert.equal(requestCount, 2);
  assert.equal(
    calls[1].init.headers.get('Authorization'),
    'Bearer concurrent-new-access',
  );
  assert.equal(getAccessToken(), null);
  assert.equal(getAuthSnapshot().status, 'guest');
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
