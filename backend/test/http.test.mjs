import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import express from 'express';
import { app } from '../dist/app.js';
import { readPort } from '../dist/config/env.js';
import { errorHandler } from '../dist/middleware/errors.js';

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server)
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
});

test('GET /api/health xác nhận HTTP server, không xác nhận database', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.deepEqual(await response.json(), {
    status: 'ok',
    service: 'unihub-api',
  });
});

test('route chưa tồn tại trả lỗi JSON 404', async () => {
  const response = await fetch(`${baseUrl}/api/does-not-exist`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài nguyên.' },
  });
});

test('JSON lỗi trả 400, không lộ nội dung request hoặc stack', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"privateMarker":',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: { code: 'INVALID_JSON', message: 'Nội dung JSON không hợp lệ.' },
  });
});

test('JSON vượt giới hạn trả 413', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'x'.repeat(101 * 1024) }),
  });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, 'PAYLOAD_TOO_LARGE');
});

test('mã hóa không hỗ trợ trả 415', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=unknown' },
    body: '{}',
  });
  assert.equal(response.status, 415);
  assert.equal((await response.json()).error.code, 'UNSUPPORTED_ENCODING');
});

test('lỗi nội bộ được che thông tin trong phản hồi 500', async (context) => {
  const log = context.mock.method(console, 'error', () => {});
  const testApp = express();
  testApp.get('/', () => {
    throw new Error('private-internal-details');
  });
  testApp.use(errorHandler);
  const testServer = testApp.listen(0, '127.0.0.1');
  await once(testServer, 'listening');
  try {
    const response = await fetch(
      `http://127.0.0.1:${testServer.address().port}/`,
    );
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: { code: 'INTERNAL_ERROR', message: 'Máy chủ gặp lỗi nội bộ.' },
    });
    assert.equal(log.mock.callCount(), 1);
  } finally {
    await new Promise((resolve, reject) =>
      testServer.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test('PORT chỉ chấp nhận số nguyên trong khoảng hợp lệ', () => {
  assert.equal(readPort('3001'), 3001);
  assert.equal(readPort('65535'), 65535);
  for (const value of ['', '0', '-1', '65536', '3001x', '3.5', 'NaN']) {
    assert.throws(() => readPort(value), /PORT/);
  }
});
