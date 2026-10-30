import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { apiRequest } from '../src/lib/api.ts';
import {
  getAuthSnapshot,
  setAuthenticated,
  setGuest,
} from '../src/features/auth/auth-state.ts';
import {
  loginWithGoogleIdToken,
  logoutCurrentSession,
  protectedApiRequest,
} from '../src/features/auth/auth-api.ts';

const originalFetch = globalThis.fetch;
const user = {
  id: 1,
  email: 'one@example.invalid',
  fullName: 'One',
  avatarUrl: null,
  role: 'Student',
};
const other = { ...user, id: 2, email: 'two@example.invalid' };
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const failure = (status, code = 'TEST_ERROR') =>
  json({ error: { code, message: 'Fixture failure' } }, status);
const session = (current = user) =>
  json({
    accessToken: 'fixture-new',
    tokenType: 'Bearer',
    expiresIn: 900,
    user: current,
  });
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
afterEach(() => {
  globalThis.fetch = originalFetch;
  setGuest();
});

for (const status of [403, 409, 503]) {
  test(`HTTP ${status} is preserved without refresh or mutation retry`, async () => {
    setAuthenticated('fixture-old', user);
    let calls = 0;
    const code = status === 409 ? 'PROFILE_INCOMPLETE' : 'TEST_ERROR';
    globalThis.fetch = async () => {
      calls += 1;
      return failure(status, code);
    };
    await assert.rejects(
      protectedApiRequest('/api/example', {
        method: 'POST',
        body: { name: 'Example' },
      }),
      { status, code },
    );
    assert.equal(calls, 1);
    assert.equal(getAuthSnapshot().status, 'authenticated');
  });
}

test('401 refresh success retries a mutation once, retaining body, query, headers and signal', async () => {
  setAuthenticated('fixture-old', user);
  const controller = new AbortController();
  const resource = [];
  let refreshes = 0;
  globalThis.fetch = async (path, init) => {
    if (path === '/api/auth/refresh') {
      refreshes += 1;
      return session();
    }
    if (path === '/api/auth/me') return json({ user });
    resource.push(init);
    assert.equal(path, '/api/example?type=Major');
    assert.equal(init.signal, controller.signal);
    assert.equal(init.headers.get('X-Fixture'), 'retained');
    assert.equal(init.method, 'POST');
    assert.equal(init.body, JSON.stringify({ name: 'Example' }));
    return resource.length === 1 ? failure(401) : json({ ok: true });
  };
  assert.deepEqual(
    await protectedApiRequest('/api/example', {
      method: 'POST',
      body: { name: 'Example' },
      query: new URLSearchParams({ type: 'Major' }),
      headers: { 'X-Fixture': 'retained' },
      signal: controller.signal,
    }),
    { ok: true },
  );
  assert.equal(refreshes, 1);
  assert.equal(resource.length, 2);
  assert.equal(
    resource[0].headers.get('Authorization') !==
      resource[1].headers.get('Authorization'),
    true,
  );
});

for (const status of [401, 403, 503]) {
  test(`refresh HTTP ${status} is preserved and never retries the resource`, async () => {
    setAuthenticated('fixture-old', user);
    const paths = [];
    globalThis.fetch = async (path) => {
      paths.push(path);
      return failure(path === '/api/auth/refresh' ? status : 401);
    };
    await assert.rejects(protectedApiRequest('/api/example'), { status });
    assert.deepEqual(paths, ['/api/example', '/api/auth/refresh']);
    assert.equal(
      getAuthSnapshot().status,
      status === 401 ? 'guest' : 'unavailable',
    );
  });
}

for (const duringRefresh of [false, true]) {
  test(`network failure ${duringRefresh ? 'during refresh' : 'on mutation'} is not retried`, async () => {
    setAuthenticated('fixture-old', user);
    const paths = [];
    globalThis.fetch = async (path) => {
      paths.push(path);
      if (duringRefresh && path === '/api/example') return failure(401);
      throw new TypeError('Fixture network unavailable');
    };
    await assert.rejects(
      protectedApiRequest('/api/example', {
        method: 'PATCH',
        body: { name: 'Example' },
      }),
      { code: 'NETWORK_ERROR', kind: 'network' },
    );
    assert.deepEqual(
      paths,
      duringRefresh ? ['/api/example', '/api/auth/refresh'] : ['/api/example'],
    );
  });
}

test('concurrent 401 requests share one refresh and each retry once', async () => {
  setAuthenticated('fixture-old', user);
  const pendingRefresh = deferred();
  const started = deferred();
  let refreshes = 0;
  let resourceCalls = 0;
  globalThis.fetch = async (path, init) => {
    if (path === '/api/auth/refresh') {
      refreshes += 1;
      started.resolve();
      return pendingRefresh.promise;
    }
    if (path === '/api/auth/me') return json({ user });
    resourceCalls += 1;
    return init.headers.get('Authorization') === 'Bearer fixture-old'
      ? failure(401)
      : json({ ok: true });
  };
  const requests = [
    protectedApiRequest('/api/one'),
    protectedApiRequest('/api/two'),
  ];
  await started.promise;
  pendingRefresh.resolve(session());
  await Promise.all(requests);
  assert.equal(refreshes, 1);
  assert.equal(resourceCalls, 4);
});

for (const initiallyMissing of [false, true]) {
  test(`401 retry limit with ${initiallyMissing ? 'missing' : 'expired'} access token`, async () => {
    if (initiallyMissing) setGuest();
    else setAuthenticated('fixture-old', user);
    let refreshes = 0;
    let resources = 0;
    globalThis.fetch = async (path) => {
      if (path === '/api/auth/refresh') {
        refreshes += 1;
        return session();
      }
      if (path === '/api/auth/me') return json({ user });
      resources += 1;
      return failure(401);
    };
    await assert.rejects(protectedApiRequest('/api/example'), { status: 401 });
    assert.equal(refreshes, 1);
    assert.equal(resources, initiallyMissing ? 1 : 2);
    assert.equal(getAuthSnapshot().status, 'guest');
  });
}

for (const change of ['logout', 'login']) {
  for (const lateStatus of [200, 401]) {
    test(`late ${lateStatus} after ${change} cannot return data or refresh`, async () => {
      setAuthenticated('fixture-old', user);
      const pending = deferred();
      const started = deferred();
      let refreshes = 0;
      globalThis.fetch = async (path) => {
        if (path === '/api/auth/logout')
          return new Response(null, { status: 204 });
        if (path === '/api/auth/google') return session(other);
        if (path === '/api/auth/me') return json({ user: other });
        if (path === '/api/auth/refresh') {
          refreshes += 1;
          return session();
        }
        started.resolve();
        return pending.promise;
      };
      const request = protectedApiRequest('/api/example');
      const rejected = assert.rejects(request, {
        name: 'AuthOperationInvalidatedError',
      });
      await started.promise;
      if (change === 'logout') await logoutCurrentSession();
      else await loginWithGoogleIdToken('fixture-google');
      pending.resolve(
        lateStatus === 200 ? json({ private: true }) : failure(401),
      );
      await rejected;
      assert.equal(refreshes, 0);
      assert.equal(
        getAuthSnapshot().user?.id ?? null,
        change === 'logout' ? null : other.id,
      );
    });
  }
}

test('an already aborted request sends neither refresh nor resource', async () => {
  setGuest();
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return session();
  };
  await assert.rejects(
    protectedApiRequest('/api/example', { signal: controller.signal }),
    { name: 'AbortError' },
  );
  assert.equal(calls, 0);
});

test('aborting a refresh waiter rejects promptly without cancelling another waiter', async () => {
  setAuthenticated('fixture-old', user);
  const controller = new AbortController();
  const pending = deferred();
  const started = deferred();
  let refreshes = 0;
  const resources = [];
  globalThis.fetch = async (path, init) => {
    if (path === '/api/auth/refresh') {
      refreshes += 1;
      assert.equal(init.signal == null, true);
      started.resolve();
      return pending.promise;
    }
    if (path === '/api/auth/me') return json({ user });
    resources.push(path);
    return init.headers.get('Authorization') === 'Bearer fixture-old'
      ? failure(401)
      : json({ ok: true });
  };
  const cancelled = protectedApiRequest('/api/cancelled', {
    signal: controller.signal,
  });
  const rejected = assert.rejects(cancelled, { name: 'AbortError' });
  const survivor = protectedApiRequest('/api/survivor');
  await started.promise;
  controller.abort();
  await rejected;
  pending.resolve(session());
  await survivor;
  assert.equal(refreshes, 1);
  assert.equal(resources.filter((path) => path === '/api/cancelled').length, 1);
  assert.equal(resources.filter((path) => path === '/api/survivor').length, 2);
});

for (const retry of [false, true]) {
  test(`abort during ${retry ? 'retry' : 'original request'} rejects even if transport completes late`, async () => {
    setAuthenticated('fixture-old', user);
    const controller = new AbortController();
    const started = deferred();
    const pending = deferred();
    let resources = 0;
    globalThis.fetch = async (path, init) => {
      if (path === '/api/auth/refresh') return session();
      if (path === '/api/auth/me') return json({ user });
      assert.equal(init.signal, controller.signal);
      resources += 1;
      if (retry && resources === 1) return failure(401);
      started.resolve();
      return pending.promise;
    };
    const request = protectedApiRequest('/api/example', {
      signal: controller.signal,
    });
    const rejected = assert.rejects(request, { name: 'AbortError' });
    await started.promise;
    controller.abort();
    await rejected;
    pending.resolve(json({ private: true }));
    assert.equal(resources, retry ? 2 : 1);
    assert.equal(getAuthSnapshot().status, 'authenticated');
  });
}

test('public client does not refresh on 401', async () => {
  setAuthenticated('fixture-old', user);
  let calls = 0;
  globalThis.fetch = async (_path, init) => {
    calls += 1;
    assert.equal(init.headers.has('Authorization'), false);
    return failure(401);
  };
  await assert.rejects(apiRequest('/api/opportunities'), { status: 401 });
  assert.equal(calls, 1);
});

test('protected transport rejects Auth endpoints and noncanonical paths without fetching', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return failure(401);
  };
  for (const path of [
    '/api/auth/google',
    '/api/auth/refresh',
    '/api/auth/logout',
    '/api/auth/me',
    '/api/auth/me?x=1',
    '/api/x/../auth/me',
    '/api/%61uth/me',
    '/api/\\auth/me',
    'https://example.invalid/api/example',
  ]) {
    await assert.rejects(protectedApiRequest(path), {
      code: 'INVALID_PROTECTED_API_PATH',
    });
  }
  assert.equal(calls, 0);
});
