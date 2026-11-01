import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, createApiClient } from '../src/lib/api.ts';

test('PUT support and optional fieldErrors preserve existing error envelope', async () => {
  const field = {
    source: 'body',
    field: 'majorId',
    code: 'INVALID_CATEGORY',
    message: 'Invalid major',
  };
  const request = createApiClient(async (_path, init) => {
    assert.equal(init.method, 'PUT');
    assert.equal(init.body, '{"majorId":1}');
    return new Response(
      JSON.stringify({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid',
          fieldErrors: [field, { source: 'unknown' }, null],
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  });
  await assert.rejects(
    request('/api/users/me/profile', { method: 'PUT', body: { majorId: 1 } }),
    (e) =>
      e.code === 'VALIDATION_ERROR' &&
      e.status === 400 &&
      JSON.stringify(e.fieldErrors) === JSON.stringify([field]),
  );
});

test('parses successful JSON responses', async () => {
  const request = createApiClient(
    async () =>
      new Response(JSON.stringify({ id: 12 }), {
        headers: { 'Content-Type': 'application/json' },
      }),
  );

  assert.deepEqual(await request('/api/opportunities/12'), { id: 12 });
});

test('preserves the standard JSON error code, message, and status', async () => {
  const request = createApiClient(
    async () =>
      new Response(
        JSON.stringify({
          error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài nguyên.' },
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
  );

  await assert.rejects(request('/api/opportunities/missing'), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.kind, 'http');
    assert.equal(error.status, 404);
    assert.equal(error.code, 'NOT_FOUND');
    assert.equal(error.message, 'Không tìm thấy tài nguyên.');
    return true;
  });
});

test('does not expose non-JSON HTTP response bodies', async () => {
  const request = createApiClient(
    async () =>
      new Response('<html>private upstream details</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
  );

  await assert.rejects(request('/api/health'), (error) => {
    assert.equal(error.kind, 'http');
    assert.equal(error.code, 'HTTP_ERROR');
    assert.equal(error.status, 502);
    assert.equal(error.message.includes('private upstream'), false);
    return true;
  });
});

test('normalizes fetch failures without exposing their messages', async () => {
  const request = createApiClient(async () => {
    throw new TypeError('socket credentials should not be shown');
  });

  await assert.rejects(request('/api/health'), (error) => {
    assert.equal(error.kind, 'network');
    assert.equal(error.code, 'NETWORK_ERROR');
    assert.equal(error.message.includes('socket credentials'), false);
    return true;
  });
});

test('returns undefined for 204 and empty successful responses', async () => {
  const responses = [
    new Response(null, { status: 204 }),
    new Response('', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  ];
  const request = createApiClient(async () => responses.shift());

  assert.equal(
    await request('/api/opportunities/12', { method: 'DELETE' }),
    undefined,
  );
  assert.equal(await request('/api/opportunities'), undefined);
});

test('rejects successful non-JSON responses', async () => {
  const request = createApiClient(
    async () =>
      new Response('OK', { headers: { 'Content-Type': 'text/plain' } }),
  );

  await assert.rejects(request('/api/health'), (error) => {
    assert.equal(error.kind, 'response');
    assert.equal(error.code, 'INVALID_RESPONSE');
    return true;
  });
});

test('adds JSON headers, serializes the body, and appends query parameters', async () => {
  let receivedUrl;
  let receivedInit;
  const request = createApiClient(async (input, init) => {
    receivedUrl = String(input);
    receivedInit = init;
    return new Response(JSON.stringify({ accepted: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const query = new URLSearchParams({ q: 'career event', page: '2' });
  const result = await request('/api/events?sort=recent', {
    method: 'POST',
    body: { title: 'Career fair' },
    query,
  });

  assert.deepEqual(result, { accepted: true });
  assert.equal(receivedUrl, '/api/events?sort=recent&q=career+event&page=2');
  assert.equal(receivedInit.method, 'POST');
  assert.equal(receivedInit.body, JSON.stringify({ title: 'Career fair' }));
  assert.equal(receivedInit.headers.get('Accept'), 'application/json');
  assert.equal(receivedInit.headers.get('Content-Type'), 'application/json');
});

test('passes abort errors through unchanged', async () => {
  const abortError = new DOMException('aborted', 'AbortError');
  const request = createApiClient(async () => {
    throw abortError;
  });

  await assert.rejects(request('/api/health'), (error) => error === abortError);
});

test('rejects paths outside the same-origin /api prefix', async () => {
  const request = createApiClient(async () => {
    throw new Error('fetch should not be called');
  });

  await assert.rejects(request('https://example.com/api/health'), (error) => {
    assert.equal(error.code, 'INVALID_API_PATH');
    assert.equal(error.kind, 'request');
    return true;
  });
});

test('rejects JSON bodies on GET requests', async () => {
  const request = createApiClient(async () => {
    throw new Error('fetch should not be called');
  });

  await assert.rejects(
    request('/api/opportunities', { method: 'GET', body: { page: 1 } }),
    (error) => {
      assert.equal(error.code, 'INVALID_REQUEST_BODY');
      assert.equal(error.kind, 'request');
      return true;
    },
  );
});
