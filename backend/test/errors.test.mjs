import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import {
  ApiError,
  asPublicApiError,
  errorHandler,
} from '../dist/middleware/errors.js';

const adapterError = (originalCode, kind = 'mysql', code = 'P2039') =>
  Object.assign(
    new Error('private SQL, credentials and stack must stay private'),
    {
      code,
      meta: { driverAdapterError: { cause: { kind, originalCode } } },
    },
  );

test('only the identified P2039 MySQL pool connection timeout becomes 503', () => {
  for (const error of [
    adapterError('45028'),
    new Error('wrapper', { cause: adapterError('45028') }),
  ]) {
    const result = asPublicApiError(error);
    assert.ok(result instanceof ApiError);
    assert.equal(result.status, 503);
    assert.equal(result.code, 'SERVICE_UNAVAILABLE');
    assert.equal(result.message, 'Database hiện không sẵn sàng.');
  }
});

test('query, constraint, unknown and malformed adapter errors retain their identity', () => {
  const circular = new Error('cycle');
  circular.cause = circular;
  for (const error of [
    ...['1064', '1146', '1054', '1062', '1452', '1213', '45020', '99999'].map(
      (code) => adapterError(code),
    ),
    adapterError('45028', 'postgres'),
    adapterError('45028', 'mysql', 'P2010'),
    adapterError('45028', 'mysql', 'P2002'),
    adapterError('45028', 'mysql', 'UNKNOWN'),
    adapterError(45028),
    { code: 'P2039' },
    { code: 'P2039', meta: null },
    { code: 'P2039', meta: { driverAdapterError: null } },
    { code: 'P2039', meta: { driverAdapterError: { cause: null } } },
    { code: 'P2039', kind: 'mysql', originalCode: '45028' },
    new Error('P2039 ER_GET_CONNECTION_TIMEOUT 45028'),
    new TypeError('programming error'),
    circular,
    null,
  ]) {
    assert.equal(asPublicApiError(error), error);
  }
});

test('existing availability codes and explicit API errors are preserved', () => {
  for (const error of [
    { code: 'P1001' },
    { errorCode: 'P2024' },
    { cause: { code: 'ECONNREFUSED' } },
    { code: 'ER_ACCESS_DENIED_ERROR' },
  ]) {
    assert.equal(asPublicApiError(error).status, 503);
  }
  const explicit = new ApiError(409, 'CONFLICT', 'Existing module behavior');
  explicit.cause = adapterError('45028');
  assert.equal(asPublicApiError(explicit), explicit);
});

test('HTTP error envelope hides driver details and keeps unrelated errors at 500', async () => {
  const errors = [
    adapterError('45028'),
    adapterError('1064'),
    { code: 'P2039' },
  ];
  const app = express();
  app.get('/:index', (request, _response, next) => {
    next(asPublicApiError(errors[Number(request.params.index)]));
  });
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    for (const [index, status] of [503, 500, 500].entries()) {
      const response = await fetch(
        `http://127.0.0.1:${server.address().port}/${index}`,
      );
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), {
        error:
          status === 503
            ? {
                code: 'SERVICE_UNAVAILABLE',
                message: 'Database hiện không sẵn sàng.',
              }
            : { code: 'INTERNAL_ERROR', message: 'Máy chủ gặp lỗi nội bộ.' },
      });
    }
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
