import assert from 'node:assert/strict';
import { before, after, afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { parseSkillOptions } from '../src/features/categories/contracts.ts';

let vite, api;
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
});
afterEach(() => {
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
