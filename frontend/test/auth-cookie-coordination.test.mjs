import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import {
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

const originalFetch = globalThis.fetch;
const user = (id) => ({
  id,
  email: `user${id}@example.invalid`,
  fullName: `User ${id}`,
  avatarUrl: null,
  role: 'Student',
});
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
// In-memory test double only: mutation happens at response headers, before Auth
// can inspect revision/JSON. Only IDs/booleans are asserted, never credentials.
function cookieJar(owner = 1) {
  const jar = { owner, generation: 0 };
  const requests = [];
  let changed = deferred();
  let active = 0;
  let maxActive = 0;
  globalThis.fetch = async (path, init) => {
    if (path === '/api/auth/me') {
      const id =
        init.headers.get('Authorization') === 'Bearer fixture-two' ? 2 : 1;
      return json({ user: user(id) });
    }
    if (
      !['/api/auth/google', '/api/auth/refresh', '/api/auth/logout'].includes(
        path,
      )
    ) {
      return init.headers.get('Authorization') === 'Bearer fixture-old'
        ? json(
            { error: { code: 'UNAUTHORIZED', message: 'Fixture expired' } },
            401,
          )
        : json({ ok: true });
    }
    assert.equal(init.signal == null, true);
    active += 1;
    maxActive = Math.max(maxActive, active);
    const pending = deferred();
    const kind = path.slice('/api/auth/'.length);
    const intendedOwner =
      kind === 'google'
        ? JSON.parse(init.body).idToken === 'fixture-login-two'
          ? 2
          : 1
        : jar.owner;
    requests.push({ kind, intendedOwner, sentOwner: jar.owner, pending });
    changed.resolve();
    changed = deferred();
    return pending.promise;
  };
  return {
    requests,
    jar,
    async wait(count) {
      while (requests.length < count) await changed.promise;
    },
    complete(
      index,
      { network = false, status = 200, bodyFailure = false } = {},
    ) {
      const request = requests[index];
      assert.ok(request && !request.completed);
      request.completed = true;
      active -= 1;
      if (network) {
        request.pending.reject(new TypeError('Fixture transport failure'));
        return;
      }
      if (status >= 400) {
        request.pending.resolve(
          json(
            {
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'Fixture service failure',
              },
            },
            status,
          ),
        );
        return;
      }
      jar.owner = request.kind === 'logout' ? null : request.intendedOwner;
      jar.generation += 1;
      const response =
        request.kind === 'logout'
          ? new Response(null, { status: 204 })
          : json({
              accessToken: jar.owner === 2 ? 'fixture-two' : 'fixture-one',
              tokenType: 'Bearer',
              expiresIn: 900,
              user: user(jar.owner),
            });
      if (bodyFailure)
        response.text = async () => {
          throw new TypeError('Fixture body failure');
        };
      request.pending.resolve(response);
    },
    assertFinal(id) {
      assert.equal(jar.owner, id);
      assert.equal(getAuthSnapshot().user?.id ?? null, id);
      assert.equal(
        getAuthSnapshot().status,
        id === null ? 'guest' : 'authenticated',
      );
      assert.equal(getAuthSnapshot().accessToken === null, id === null);
      assert.equal(maxActive, 1);
    },
  };
}
afterEach(() => {
  globalThis.fetch = originalFetch;
  setGuest();
});
const invalidated = (operation) =>
  assert.rejects(operation, { name: 'AuthOperationInvalidatedError' });

test('login A response must finish before login B can replace cookie; latest intent wins', async () => {
  const fixture = cookieJar(null);
  const a = invalidated(loginWithGoogleIdToken('fixture-login-one'));
  await fixture.wait(1);
  const b = loginWithGoogleIdToken('fixture-login-two');
  assert.equal(getAuthSnapshot().user, null);
  assert.equal(fixture.requests.length, 1); // B cannot return headers before A.
  fixture.complete(0);
  await fixture.wait(2);
  assert.equal(fixture.requests[1].sentOwner, 1);
  fixture.complete(1);
  await Promise.all([a, b]);
  fixture.assertFinal(2);
});

for (const restore of [false, true]) {
  test(`${restore ? 'restore' : 'protected refresh'} A cannot overwrite login B cookie`, async () => {
    const fixture = cookieJar();
    setAuthenticated('fixture-old', user(1));
    const a = restore
      ? restoreAuthSession()
      : invalidated(protectedApiRequest('/api/probe'));
    await fixture.wait(1);
    const b = loginWithGoogleIdToken('fixture-login-two');
    assert.equal(fixture.requests.length, 1);
    fixture.complete(0);
    await fixture.wait(2);
    assert.equal(fixture.requests[1].kind, 'google');
    fixture.complete(1);
    await Promise.all([a, b]);
    fixture.assertFinal(2);
  });
}

for (const kind of ['refresh', 'google']) {
  test(`${kind} then logout waits for cookie response and clears both state and jar`, async () => {
    const fixture = cookieJar();
    setAuthenticated('fixture-old', user(1));
    const first = invalidated(
      kind === 'google'
        ? loginWithGoogleIdToken('fixture-login-two')
        : protectedApiRequest('/api/probe'),
    );
    await fixture.wait(1);
    const logout = logoutCurrentSession();
    assert.equal(getAuthSnapshot().user, null);
    assert.equal(fixture.requests.length, 1);
    fixture.complete(0);
    await fixture.wait(2);
    assert.equal(fixture.requests[1].kind, 'logout');
    assert.equal(fixture.requests[1].sentOwner, kind === 'google' ? 2 : 1);
    fixture.complete(1);
    await Promise.all([first, logout]);
    fixture.assertFinal(null);
  });
}

test('concurrent protected requests and restore share one cookie rotation', async () => {
  const fixture = cookieJar();
  setAuthenticated('fixture-old', user(1));
  const requests = [
    protectedApiRequest('/api/one'),
    protectedApiRequest('/api/two'),
  ];
  await fixture.wait(1);
  const restore = restoreAuthSession();
  fixture.complete(0);
  await Promise.all([...requests, restore]);
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.jar.generation, 1);
  fixture.assertFinal(1);
});

for (const bodyFailure of [false, true]) {
  test(`failed old refresh ${bodyFailure ? 'after Set-Cookie' : 'before headers'} does not poison login queue`, async () => {
    const fixture = cookieJar();
    setAuthenticated('fixture-old', user(1));
    const old = invalidated(protectedApiRequest('/api/probe'));
    await fixture.wait(1);
    const login = loginWithGoogleIdToken('fixture-login-two');
    fixture.complete(
      0,
      bodyFailure ? { bodyFailure: true } : { network: true },
    );
    await fixture.wait(2);
    fixture.complete(1);
    await Promise.all([old, login]);
    fixture.assertFinal(2);
  });
}

test('logout then login then logout cancels queued login and ends with no cookie', async () => {
  const fixture = cookieJar();
  setAuthenticated('fixture-old', user(1));
  const first = logoutCurrentSession();
  await fixture.wait(1);
  const login = invalidated(loginWithGoogleIdToken('fixture-login-two'));
  const last = logoutCurrentSession();
  fixture.complete(0);
  await fixture.wait(2);
  assert.deepEqual(
    fixture.requests.map((request) => request.kind),
    ['logout', 'logout'],
  );
  fixture.complete(1);
  await Promise.all([first, login, last]);
  fixture.assertFinal(null);
});

test('queued superseded login never sends credentials or changes cookie', async () => {
  const fixture = cookieJar();
  const a = invalidated(loginWithGoogleIdToken('fixture-login-one'));
  const b = loginWithGoogleIdToken('fixture-login-two');
  await fixture.wait(1);
  assert.equal(fixture.requests[0].intendedOwner, 2);
  fixture.complete(0);
  await Promise.all([a, b]);
  assert.equal(fixture.requests.length, 1);
  fixture.assertFinal(2);
});

test('logout failure cannot clear cookie; memory stays Guest with honest warning', async () => {
  const fixture = cookieJar();
  setAuthenticated('fixture-old', user(1));
  const logout = assert.rejects(logoutCurrentSession(), {
    code: 'NETWORK_ERROR',
  });
  await fixture.wait(1);
  fixture.complete(0, { network: true });
  await logout;
  assert.equal(getAuthSnapshot().user, null);
  assert.equal(getAuthSnapshot().accessToken, null);
  assert.equal(fixture.jar.owner, 1);
  assert.match(getAuthSnapshot().error, /máy chủ chưa xác nhận/);
  const login = loginWithGoogleIdToken('fixture-login-two');
  await fixture.wait(2);
  fixture.complete(1);
  await login;
  fixture.assertFinal(2);
});

test('failed login A releases the queue for login B without stale state', async () => {
  const fixture = cookieJar();
  const a = assert.rejects(loginWithGoogleIdToken('fixture-login-one'), {
    code: 'NETWORK_ERROR',
  });
  await fixture.wait(1);
  const b = loginWithGoogleIdToken('fixture-login-two');
  fixture.complete(0, { network: true });
  await fixture.wait(2);
  fixture.complete(1);
  await Promise.all([a, b]);
  fixture.assertFinal(2);
});

test('refresh is blocked during login and restore waits for that login', async () => {
  const fixture = cookieJar();
  const login = loginWithGoogleIdToken('fixture-login-two');
  await fixture.wait(1);
  const restore = restoreAuthSession();
  await invalidated(protectedApiRequest('/api/probe'));
  assert.equal(fixture.requests.length, 1);
  fixture.complete(0);
  await Promise.all([login, restore]);
  fixture.assertFinal(2);
});

test('login A then queued login B then logout skips B and revokes the cookie from A', async () => {
  const fixture = cookieJar();
  const a = invalidated(loginWithGoogleIdToken('fixture-login-one'));
  await fixture.wait(1);
  const b = invalidated(loginWithGoogleIdToken('fixture-login-two'));
  const logout = logoutCurrentSession();
  fixture.complete(0);
  await fixture.wait(2);
  assert.deepEqual(
    fixture.requests.map((request) => request.kind),
    ['google', 'logout'],
  );
  fixture.complete(1);
  await Promise.all([a, b, logout]);
  fixture.assertFinal(null);
});
