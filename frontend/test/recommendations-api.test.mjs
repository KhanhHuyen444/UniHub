import assert from 'node:assert/strict';
import { before, beforeEach, after, afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { parseRecommendations } from '../src/features/recommendations/contracts.ts';
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
  auth = await vite.ssrLoadModule('/src/features/auth/auth-state.ts');
  api = await vite.ssrLoadModule('/src/features/recommendations/api.ts');
});
beforeEach(() =>
  auth.setAuthenticated('student-test-token', {
    id: 1,
    role: 'Student',
    fullName: 'Fixture',
    email: 'fixture@example.invalid',
    avatarUrl: null,
  }),
);
afterEach(() => {
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
  assert.deepEqual(
    await api.getRecommendations('student-test-token', controller.signal),
    payload(),
  );
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

test('missing token fails locally; 401/403/409 and service errors keep shared status/code', async () => {
  fetcher = async () => {
    assert.fail('Blank token reached network');
  };
  await assert.rejects(api.getRecommendations(' '), {
    code: 'UNAUTHORIZED',
    status: 401,
  });
  for (const [status, code] of [
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [409, 'PROFILE_INCOMPLETE'],
    [503, 'SERVICE_UNAVAILABLE'],
    [500, 'INTERNAL_ERROR'],
  ]) {
    fetcher = async () =>
      json({ error: { code, message: 'Safe message' } }, status);
    await assert.rejects(api.getRecommendations('invalid-token'), {
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
  await assert.rejects(api.getRecommendations('token'), {
    code: 'NETWORK_ERROR',
  });
  fetcher = async () => json({ items: [] });
  await assert.rejects(api.getRecommendations('token'), {
    code: 'INVALID_RESPONSE',
  });
  const aborted = new DOMException('Abort', 'AbortError');
  fetcher = async () => {
    throw aborted;
  };
  await assert.rejects(
    api.getRecommendations('token'),
    (error) => error === aborted,
  );
});

const refreshUser = {
  id: 1,
  role: 'Student',
  fullName: 'Fixture',
  email: 'fixture@example.invalid',
  avatarUrl: null,
};
test('expired access uses shared refresh once, then retries with current session token', async () => {
  auth.setAuthenticated('expired', refreshUser);
  let refreshes = 0,
    requests = 0;
  fetcher = async (path, options) => {
    if (path === '/api/auth/refresh') {
      refreshes++;
      assert.equal(options.credentials, 'include');
      return json({
        accessToken: 'renewed',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: refreshUser,
      });
    }
    if (path === '/api/auth/me') return json({ user: refreshUser });
    requests++;
    if (options.headers.get('Authorization') === 'Bearer expired')
      return json({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401);
    assert.equal(options.headers.get('Authorization'), 'Bearer renewed');
    return json(payload());
  };
  await api.getRecommendations('expired');
  assert.equal(refreshes, 1);
  assert.equal(requests, 2);
  assert.equal(auth.getAuthSnapshot().status, 'authenticated');
});
test('revoked refresh clears session without retry loop', async () => {
  auth.setAuthenticated('expired', refreshUser);
  const paths = [];
  fetcher = async (path) => {
    paths.push(path);
    return json({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401);
  };
  await assert.rejects(api.getRecommendations('expired'), { status: 401 });
  assert.equal(paths.length, 2);
  assert.equal(paths[1], '/api/auth/refresh');
  assert.equal(auth.getAuthSnapshot().status, 'guest');
});
