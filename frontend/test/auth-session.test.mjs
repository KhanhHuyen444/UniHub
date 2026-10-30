import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthProvider, useAuth } from '../src/features/auth/AuthProvider.tsx';
import {
  getAuthSnapshot,
  setAuthenticated,
  setGuest,
  subscribeToAuth,
} from '../src/features/auth/auth-state.ts';
import {
  loginWithGoogleIdToken,
  logoutCurrentSession,
  protectedApiRequest,
  restoreAuthSession,
} from '../src/features/auth/auth-api.ts';

const originalFetch = globalThis.fetch;
const student = {
  id: 1,
  email: 'student@example.invalid',
  fullName: 'Student',
  avatarUrl: null,
  role: 'Student',
};
const admin = {
  ...student,
  id: 2,
  email: 'admin@example.invalid',
  fullName: 'Admin',
  role: 'Admin',
};
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const response = (accessToken, user) =>
  json({ accessToken, tokenType: 'Bearer', expiresIn: 900, user });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
function cleared(status) {
  const snapshot = getAuthSnapshot();
  assert.equal(snapshot.status, status);
  assert.equal(snapshot.accessToken === null, true);
  assert.equal(snapshot.role, null);
  assert.equal(snapshot.user, null);
}
function authenticated(token, user) {
  const snapshot = getAuthSnapshot();
  assert.equal(snapshot.status, 'authenticated');
  assert.equal(snapshot.accessToken === token, true);
  assert.equal(snapshot.role, user.role);
  assert.deepEqual(snapshot.user, user);
}
afterEach(() => {
  globalThis.fetch = originalFetch;
  setGuest();
});

test('session subscription publishes login, restore, refresh and immediate logout atomically', async () => {
  setGuest();
  const notifications = [];
  const unsubscribe = subscribeToAuth(() => {
    const snapshot = getAuthSnapshot();
    let session;
    function Consumer() {
      session = useAuth();
      return null;
    }
    renderToStaticMarkup(
      createElement(AuthProvider, null, createElement(Consumer)),
    );
    assert.equal(session.accessToken === snapshot.accessToken, true);
    assert.equal(session.role, snapshot.role);
    assert.equal(session.user, snapshot.user);
    assert.equal(session.status, snapshot.status);
    notifications.push(snapshot.status);
    if (snapshot.status === 'authenticated') {
      assert.equal(snapshot.accessToken !== null, true);
      assert.equal(snapshot.role, snapshot.user.role);
    } else {
      cleared(snapshot.status);
    }
  });
  try {
    let token = 'fixture-login';
    let currentUser = student;
    const logoutResponse = deferred();
    globalThis.fetch = async (path) => {
      if (path === '/api/auth/google' || path === '/api/auth/refresh')
        return response(token, currentUser);
      if (path === '/api/auth/me') return json({ user: currentUser });
      if (path === '/api/auth/logout') return logoutResponse.promise;
      return json({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401);
    };
    await loginWithGoogleIdToken('fixture-google');
    authenticated(token, student);
    const loginSnapshot = getAuthSnapshot();
    assert.equal(getAuthSnapshot() === loginSnapshot, true);

    token = 'fixture-restored';
    const restore = restoreAuthSession();
    cleared('restoring');
    await restore;
    authenticated(token, student);
    assert.notEqual(getAuthSnapshot(), loginSnapshot);

    token = 'fixture-refreshed';
    currentUser = { ...student, role: 'Admin' };
    // Exercise refresh through the existing protected request helper.
    let resourceCalls = 0;
    const fetchAuth = globalThis.fetch;
    globalThis.fetch = async (path, init) =>
      path === '/api/session-probe'
        ? ++resourceCalls === 1
          ? json({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401)
          : json({ ok: true })
        : fetchAuth(path, init);
    const beforeRefresh = getAuthSnapshot();
    await protectedApiRequest('/api/session-probe');
    authenticated(token, currentUser);
    assert.notEqual(getAuthSnapshot(), beforeRefresh);

    const logout = logoutCurrentSession();
    cleared('guest');
    logoutResponse.resolve(new Response(null, { status: 204 }));
    await logout;
    cleared('guest');
    assert.deepEqual(notifications, [
      'restoring',
      'authenticated',
      'restoring',
      'authenticated',
      'authenticated',
      'guest',
    ]);
  } finally {
    unsubscribe();
  }
});

test('switching user clears the previous session before login completes', async () => {
  setAuthenticated('fixture-previous', student);
  const loginResponse = deferred();
  globalThis.fetch = async (path) =>
    path === '/api/auth/google' ? loginResponse.promise : json({ user: admin });
  const login = loginWithGoogleIdToken('fixture-google');
  cleared('restoring');
  loginResponse.resolve(response('fixture-next', admin));
  await login;
  authenticated('fixture-next', admin);
});

test('failed account switch never restores the previous user', async () => {
  setAuthenticated('fixture-previous', student);
  globalThis.fetch = async () =>
    json({ error: { code: 'GOOGLE_TOKEN_INVALID', message: 'Invalid' } }, 401);
  const login = loginWithGoogleIdToken('fixture-google');
  cleared('restoring');
  await assert.rejects(login, { status: 401 });
  cleared('guest');
});

for (const failRefresh of [false, true]) {
  test(`previous refresh cannot overwrite a newly logged-in user (${failRefresh ? 'failure' : 'success'})`, async () => {
    setAuthenticated('fixture-previous', student);
    const refreshResponse = deferred();
    const started = deferred();
    globalThis.fetch = async (path) => {
      if (path === '/api/auth/refresh') {
        started.resolve();
        return refreshResponse.promise;
      }
      if (path === '/api/auth/google') return response('fixture-next', admin);
      if (path === '/api/auth/me') return json({ user: admin });
      return json({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401);
    };
    const pending = protectedApiRequest('/api/session-probe');
    const rejected = assert.rejects(pending, {
      name: 'AuthOperationInvalidatedError',
    });
    await started.promise;
    const login = loginWithGoogleIdToken('fixture-google');
    refreshResponse.resolve(
      failRefresh
        ? json({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401)
        : response('fixture-stale', student),
    );
    await Promise.all([rejected, login]);
    authenticated('fixture-next', admin);
  });
}

test('token-only rotation notifies session consumers with unchanged user and role', () => {
  setAuthenticated('fixture-before', student);
  const before = getAuthSnapshot();
  let notifications = 0;
  const unsubscribe = subscribeToAuth(() => {
    notifications += 1;
  });
  try {
    setAuthenticated('fixture-after', student);
    authenticated('fixture-after', student);
    assert.equal(getAuthSnapshot().user, before.user);
    assert.notEqual(getAuthSnapshot(), before);
    assert.equal(notifications, 1);
  } finally {
    unsubscribe();
  }
});

test('repeated logout shares one server call and clears session before completion', async () => {
  setAuthenticated('fixture-initial', student);
  const pending = deferred();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return pending.promise;
  };
  const first = logoutCurrentSession();
  const second = logoutCurrentSession();
  cleared('guest');
  await Promise.resolve();
  assert.equal(calls, 1);
  pending.resolve(new Response(null, { status: 204 }));
  await Promise.all([first, second]);
  cleared('guest');
});

test('failed repeated logout keeps cleared session and reports unconfirmed revocation', async () => {
  setAuthenticated('fixture-initial', student);
  const pending = deferred();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return pending.promise;
  };
  const results = Promise.allSettled([
    logoutCurrentSession(),
    logoutCurrentSession(),
  ]);
  cleared('guest');
  pending.resolve(
    json(
      { error: { code: 'SERVICE_UNAVAILABLE', message: 'Fixture failure' } },
      503,
    ),
  );
  assert.ok((await results).every((result) => result.status === 'rejected'));
  assert.equal(calls, 1);
  cleared('guest');
  assert.match(getAuthSnapshot().error, /máy chủ chưa xác nhận/);
});
