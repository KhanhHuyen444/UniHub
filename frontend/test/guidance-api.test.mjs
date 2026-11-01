import assert from 'node:assert/strict';
import { before, after, afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const originalFetch = globalThis.fetch;
let vite;
let api;
let authState;
let mockFetch = originalFetch;
const studentUser = {
  id: 42,
  email: 'student@example.invalid',
  fullName: 'Student User',
  avatarUrl: null,
  role: 'Student',
};
const adminUser = {
  id: 1,
  email: 'admin@example.invalid',
  fullName: 'Admin User',
  avatarUrl: null,
  role: 'Admin',
};
const empty = { selectedMajor: null, stages: [] };
const detail = {
  item: {
    id: 81,
    title: 'Test article',
    publisher: null,
    descriptionText: null,
    requirementsText: null,
    majors: [{ id: 4, name: 'Closed major', status: 'Closed' }],
    skills: [],
    academicYears: [],
    createdAt: '2026-10-01T00:00:00Z',
  },
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

before(async () => {
  globalThis.fetch = (...args) => mockFetch(...args);
  vite = await createServer({
    appType: 'custom',
    configFile: false,
    logLevel: 'silent',
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true },
  });
  api = await vite.ssrLoadModule('/src/features/guidance/api.ts');
  authState = await vite.ssrLoadModule('/src/features/auth/auth-state.ts');
});
afterEach(() => {
  authState?.setGuest();
  mockFetch = originalFetch;
});
after(async () => {
  globalThis.fetch = originalFetch;
  await vite?.close();
});

test('list without majorId uses approved public endpoint and shared GET client', async () => {
  mockFetch = async (path, options) => {
    assert.equal(path, '/api/guidance');
    assert.equal(options.method, 'GET');
    assert.equal(options.body, undefined);
    assert.equal(options.headers.get('Authorization'), null);
    assert.equal(options.headers.get('Accept'), 'application/json');
    return json(empty);
  };
  assert.deepEqual(await api.getGuidanceList(), empty);
});

test('list serializes exactly one majorId and forwards AbortSignal', async () => {
  const controller = new AbortController();
  mockFetch = async (path, options) => {
    assert.equal(path, '/api/guidance?majorId=4');
    assert.equal(options.signal, controller.signal);
    return json({
      selectedMajor: { id: 4, name: 'Major', type: 'Major' },
      stages: [],
    });
  };
  const response = await api.getGuidanceList({
    majorId: 4,
    signal: controller.signal,
  });
  assert.equal(response.selectedMajor.id, 4);
});

test('detail requests exact path and preserves Closed/no-year response', async () => {
  const controller = new AbortController();
  mockFetch = async (path, options) => {
    assert.equal(path, '/api/guidance/81');
    assert.equal(options.method, 'GET');
    assert.equal(options.signal, controller.signal);
    return json(detail);
  };
  assert.deepEqual(await api.getGuidanceDetail(81, controller.signal), detail);
});

test('invalid request IDs are rejected without making a request', async () => {
  mockFetch = async () => {
    assert.fail('unexpected request');
  };
  for (const id of [0, -1, 1.5, '4', NaN, Infinity, 2147483648, null]) {
    await assert.rejects(api.getGuidanceList({ majorId: id }), {
      code: 'INVALID_QUERY',
      kind: 'request',
    });
    await assert.rejects(api.getGuidanceDetail(id), {
      code: 'INVALID_ID',
      kind: 'request',
    });
  }
});

test('Backend HTTP status/code/message propagate for list and detail', async () => {
  for (const [status, code] of [
    [400, 'INVALID_FILTER'],
    [404, 'NOT_FOUND'],
    [503, 'SERVICE_UNAVAILABLE'],
    [500, 'INTERNAL_ERROR'],
  ]) {
    const message = `Backend ${code}`;
    mockFetch = async () => json({ error: { code, message } }, status);
    for (const request of [
      () => api.getGuidanceList(),
      () => api.getGuidanceDetail(81),
    ])
      await assert.rejects(request(), { status, code, message, kind: 'http' });
  }
});

test('invalid successful payloads are rejected instead of empty fallback', async () => {
  for (const body of [{}, null, { selectedMajor: null, stages: [null] }]) {
    mockFetch = async () => json(body);
    await assert.rejects(api.getGuidanceList(), {
      code: 'INVALID_RESPONSE',
      kind: 'response',
    });
  }
  mockFetch = async () => json({ item: {} });
  await assert.rejects(api.getGuidanceDetail(81), {
    code: 'INVALID_RESPONSE',
    kind: 'response',
  });
});

test('shared client network and non-JSON response errors are preserved', async () => {
  mockFetch = async () => {
    throw new TypeError('Network unavailable');
  };
  await assert.rejects(api.getGuidanceList(), {
    code: 'NETWORK_ERROR',
    kind: 'network',
  });
  mockFetch = async () =>
    new Response('<html>error</html>', {
      headers: { 'Content-Type': 'text/html' },
    });
  await assert.rejects(api.getGuidanceDetail(81), {
    code: 'INVALID_RESPONSE',
    kind: 'response',
  });
});

test('AbortError reaches caller unchanged for both endpoints', async () => {
  const controller = new AbortController();
  controller.abort();
  const aborted = new DOMException('Aborted', 'AbortError');
  mockFetch = async (_path, options) => {
    assert.equal(options.signal, controller.signal);
    assert.equal(options.signal.aborted, true);
    throw aborted;
  };
  await assert.rejects(
    api.getGuidanceList({ signal: controller.signal }),
    (error) => error === aborted,
  );
  await assert.rejects(
    api.getGuidanceDetail(81, controller.signal),
    (error) => error === aborted,
  );
});

test('authenticated Student uses protectedApiRequest with Bearer token', async () => {
  authState.setAuthenticated('student-token-123', studentUser);
  const controller = new AbortController();
  mockFetch = async (path, options) => {
    assert.equal(path, '/api/guidance');
    assert.equal(options.method, 'GET');
    assert.equal(
      options.headers.get('Authorization'),
      'Bearer student-token-123',
    );
    assert.equal(options.headers.get('Accept'), 'application/json');
    return json({
      selectedMajor: { id: 7, name: 'Công nghệ thông tin', type: 'Major' },
      stages: [],
    });
  };
  const response = await api.getGuidanceList({ signal: controller.signal });
  assert.equal(response.selectedMajor.id, 7);
});

test('authenticated Admin sends public request without Bearer token', async () => {
  authState.setAuthenticated('admin-token-456', adminUser);
  mockFetch = async (path, options) => {
    assert.equal(path, '/api/guidance');
    assert.equal(options.headers.get('Authorization'), null);
    return json(empty);
  };
  const response = await api.getGuidanceList();
  assert.deepEqual(response, empty);
});

test('Student 401 triggers token refresh and retries with refreshed token', async () => {
  authState.setAuthenticated('stale-token', studentUser);
  let attempts = 0;
  mockFetch = async (path, options) => {
    if (path === '/api/guidance') {
      attempts++;
      if (attempts === 1) {
        assert.equal(
          options.headers.get('Authorization'),
          'Bearer stale-token',
        );
        return json(
          { error: { code: 'UNAUTHORIZED', message: 'Token expired' } },
          401,
        );
      }
      assert.equal(
        options.headers.get('Authorization'),
        'Bearer refreshed-token',
      );
      return json({
        selectedMajor: { id: 9, name: 'Kỹ thuật phần mềm', type: 'Major' },
        stages: [],
      });
    }
    if (path === '/api/auth/refresh') {
      return json({
        accessToken: 'refreshed-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: studentUser,
      });
    }
    if (path === '/api/auth/me') {
      return json({ user: studentUser });
    }
    assert.fail(`unexpected path: ${path}`);
  };
  const response = await api.getGuidanceList();
  assert.equal(attempts, 2);
  assert.equal(response.selectedMajor.id, 9);
});
