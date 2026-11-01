import assert from 'node:assert/strict';
import { before, after, beforeEach, afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { parseSkillOptions } from '../src/features/categories/contracts.ts';

let vite, api, auth;
const user = {
  id: 42,
  email: 'student@example.invalid',
  fullName: 'Student',
  avatarUrl: null,
  role: 'Student',
};
const original = globalThis.fetch;
let fetcher;
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
  api = await vite.ssrLoadModule('/src/features/categories/api.ts');
  auth = await vite.ssrLoadModule('/src/features/auth/auth-state.ts');
});
beforeEach(() => {
  auth.setAuthenticated('test-student-token', user);
});
afterEach(() => {
  auth.setGuest();
  fetcher = original;
});
after(async () => {
  globalThis.fetch = original;
  await vite?.close();
});

test('Student client uses shared GET/Bearer headers, exact query, no body and AbortSignal', async () => {
  const controller = new AbortController();
  fetcher = async (path, options) => {
    assert.equal(path, '/api/categories?type=Skill');
    assert.equal(options.method, 'GET');
    assert.equal(options.body, undefined);
    assert.equal(
      options.headers.get('Authorization'),
      'Bearer test-student-token',
    );
    assert.equal(options.headers.get('Accept'), 'application/json');
    assert.equal(options.signal, controller.signal);
    return json({ items: [{ id: 2, name: 'SQL', type: 'Skill' }] });
  };
  assert.deepEqual(
    await api.getSkillOptions('test-student-token', controller.signal),
    [{ id: 2, name: 'SQL', type: 'Skill' }],
  );
});

test('parser preserves server order, Unicode names and empty result, strips unrelated fields', () => {
  const items = [
    { id: 8, name: 'Kỹ năng', type: 'Skill', ignored: 'private' },
    { id: 1, name: 'SQL', type: 'Skill' },
  ];
  assert.deepEqual(parseSkillOptions({ items }), [
    { id: 8, name: 'Kỹ năng', type: 'Skill' },
    { id: 1, name: 'SQL', type: 'Skill' },
  ]);
  assert.equal(items[0].ignored, 'private');
  assert.deepEqual(parseSkillOptions({ items: [] }), []);
});

test('parser rejects bad envelopes, IDs, duplicate IDs, names, Major and any status-bearing rows', () => {
  const good = { id: 1, name: 'SQL', type: 'Skill' };
  for (const value of [
    undefined,
    null,
    [],
    {},
    { items: null },
    { items: {} },
    ...[
      null,
      {},
      { ...good, id: '1' },
      { ...good, id: 0 },
      { ...good, id: 1.5 },
      { ...good, id: 2147483648 },
      { ...good, id: NaN },
      { ...good, name: ' ' },
      { ...good, name: 'x'.repeat(101) },
      { ...good, type: 'Major' },
      { ...good, type: 'skill' },
      { ...good, status: 'Closed' },
      { ...good, status: 'Active' },
    ].map((item) => ({ items: [item] })),
    { items: [good, good] },
  ])
    assert.throws(() => parseSkillOptions(value), {
      code: 'INVALID_RESPONSE',
      kind: 'response',
    });
});

test('blank token fails locally without fetch; invalid/expired token and Admin preserve 401/403', async () => {
  fetcher = async () => {
    assert.fail('Blank token must not be sent.');
  };
  for (const token of ['', '  '])
    await assert.rejects(api.getSkillOptions(token), {
      code: 'UNAUTHORIZED',
      status: 401,
    });
  for (const [status, code] of [
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [503, 'SERVICE_UNAVAILABLE'],
    [500, 'INTERNAL_ERROR'],
  ]) {
    auth.setAuthenticated('test-student-token', user);
    fetcher = async () =>
      json({ error: { code, message: 'Safe server error' } }, status);
    await assert.rejects(api.getSkillOptions('invalid-token'), {
      code,
      kind: 'http',
      status,
    });
  }
});

test('malformed success, network and abort failures never become empty success', async () => {
  fetcher = async () =>
    json({
      items: [{ id: 1, name: 'Closed', type: 'Skill', status: 'Closed' }],
    });
  await assert.rejects(api.getSkillOptions('token'), {
    code: 'INVALID_RESPONSE',
  });
  fetcher = async () => {
    throw new Error('private network detail');
  };
  await assert.rejects(api.getSkillOptions('token'), {
    code: 'NETWORK_ERROR',
    kind: 'network',
  });
  const aborted = new DOMException('Aborted', 'AbortError');
  fetcher = async () => {
    throw aborted;
  };
  await assert.rejects(
    api.getSkillOptions('token'),
    (error) => error === aborted,
  );
});

const tokenResponse = (accessToken = 'refreshed-token', role = 'Student') => ({
  accessToken,
  tokenType: 'Bearer',
  expiresIn: 900,
  user: { ...user, role },
});
const denied = () =>
  json({ error: { code: 'UNAUTHORIZED', message: 'Denied' } }, 401);
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

test('401 refreshes once, verifies me, retries with Auth token rather than stale parent prop', async () => {
  const calls = [];
  fetcher = async (path, options) => {
    calls.push(path);
    if (path === '/api/auth/refresh') {
      assert.equal(options.credentials, 'include');
      return json(tokenResponse());
    }
    if (path === '/api/auth/me') return json({ user });
    assert.equal(path, '/api/categories?type=Skill');
    return options.headers.get('Authorization') === 'Bearer refreshed-token'
      ? json({ items: [] })
      : denied();
  };
  assert.deepEqual(await api.getSkillOptions('stale-parent-prop'), []);
  assert.deepEqual(calls, [
    '/api/categories?type=Skill',
    '/api/auth/refresh',
    '/api/auth/me',
    '/api/categories?type=Skill',
  ]);
  assert.equal(auth.getAccessToken(), 'refreshed-token');
});

test('invalid refresh clears Auth, propagates 401 and never retries Skills', async () => {
  const calls = [];
  fetcher = async (path) => {
    calls.push(path);
    return denied();
  };
  await assert.rejects(api.getSkillOptions('prop'), {
    status: 401,
    code: 'UNAUTHORIZED',
  });
  assert.deepEqual(calls, ['/api/categories?type=Skill', '/api/auth/refresh']);
  assert.equal(auth.getAuthSnapshot().status, 'guest');
});

test('refresh outage propagates safe service error and Auth unavailable', async () => {
  fetcher = async (path) =>
    path === '/api/auth/refresh'
      ? json(
          { error: { code: 'SERVICE_UNAVAILABLE', message: 'Unavailable' } },
          503,
        )
      : denied();
  await assert.rejects(api.getSkillOptions('prop'), {
    status: 503,
    code: 'SERVICE_UNAVAILABLE',
  });
  assert.equal(auth.getAuthSnapshot().status, 'unavailable');
});

test('a second 401 terminates retry without a refresh loop', async () => {
  let refreshes = 0,
    skills = 0;
  fetcher = async (path) => {
    if (path === '/api/auth/refresh') {
      refreshes++;
      return json(tokenResponse());
    }
    if (path === '/api/auth/me') return json({ user });
    skills++;
    return denied();
  };
  await assert.rejects(api.getSkillOptions('prop'), { status: 401 });
  assert.equal(refreshes, 1);
  assert.equal(skills, 2);
  assert.equal(auth.getAuthSnapshot().status, 'guest');
});

test('abort during shared refresh preserves signal and prevents retry from reaching transport', async () => {
  const controller = new AbortController();
  const refresh = deferred(),
    started = deferred();
  let sent = 0;
  fetcher = async (path, options) => {
    if (path === '/api/auth/refresh') {
      started.resolve();
      return refresh.promise;
    }
    if (path === '/api/auth/me') return json({ user });
    options.signal?.throwIfAborted();
    sent++;
    return denied();
  };
  const pending = api.getSkillOptions('prop', controller.signal);
  await started.promise;
  controller.abort();
  refresh.resolve(json(tokenResponse()));
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(sent, 1);
  assert.equal(auth.getAuthSnapshot().status, 'authenticated');
});

test('abort during retry ignores even a transport that returns a late successful response', async () => {
  const controller = new AbortController();
  let skills = 0;
  fetcher = async (path) => {
    if (path === '/api/auth/refresh') return json(tokenResponse());
    if (path === '/api/auth/me') return json({ user });
    if (++skills === 1) return denied();
    controller.abort();
    return json({ items: [] });
  };
  await assert.rejects(api.getSkillOptions('prop', controller.signal), {
    name: 'AbortError',
  });
});

test('token rotated by another request is reused without a second refresh', async () => {
  let calls = 0;
  fetcher = async (path, options) => {
    assert.equal(path, '/api/categories?type=Skill');
    if (++calls === 1) {
      auth.setAuthenticated('rotated', user);
      return denied();
    }
    assert.equal(options.headers.get('Authorization'), 'Bearer rotated');
    return json({ items: [] });
  };
  assert.deepEqual(await api.getSkillOptions('old-prop'), []);
  assert.equal(calls, 2);
});

test('Guest and Admin cannot fetch Student options, even with forged nonempty parent prop', async () => {
  fetcher = async () => assert.fail('must not fetch');
  auth.setGuest();
  await assert.rejects(api.getSkillOptions('prop'), { status: 401 });
  auth.setAuthenticated('admin', { ...user, role: 'Admin' });
  await assert.rejects(api.getSkillOptions('prop'), { status: 403 });
});
