import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer as createTcpServer } from 'node:net';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import express from 'express';
import { app, createApp } from '../dist/app.js';
import { readPort } from '../dist/config/env.js';
import {
  DatabaseNotConfiguredError,
  InvalidDatabaseConfigurationError,
  createPrismaClient,
} from '../dist/lib/prisma.js';
import { errorHandler } from '../dist/middleware/errors.js';

const backendDirectory = fileURLToPath(new URL('..', import.meta.url));

let server;
let baseUrl;

async function withServer(testApp, callback) {
  const testServer = testApp.listen(0, '127.0.0.1');
  await once(testServer, 'listening');

  try {
    return await callback(`http://127.0.0.1:${testServer.address().port}`);
  } finally {
    await new Promise((resolve, reject) =>
      testServer.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function getFreePort() {
  const socket = createTcpServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const address = socket.address();
  assert.notEqual(typeof address, 'string');
  await new Promise((resolve, reject) =>
    socket.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

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

test('GET /api/health vẫn thành công mà không gọi database probe', async () => {
  let probeCalls = 0;
  const testApp = createApp({
    checkDatabase: async () => {
      probeCalls += 1;
      throw new Error('database unavailable');
    },
    logDatabaseFailure: () => {},
  });

  await withServer(testApp, async (url) => {
    const response = await fetch(`${url}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'ok',
      service: 'unihub-api',
    });
  });
  assert.equal(probeCalls, 0);
});

test('GET /api/ready returns 200 when the injected database probe succeeds', async () => {
  const testApp = createApp({ checkDatabase: async () => {} });

  await withServer(testApp, async (url) => {
    const response = await fetch(`${url}/api/ready`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
      status: 'ready',
      service: 'unihub-api',
      database: 'available',
    });
  });
});

test('GET /api/ready reports missing and invalid configuration without exposing it', async () => {
  const missingApp = createApp({
    checkDatabase: async () => {
      throw new DatabaseNotConfiguredError();
    },
  });
  const invalidApp = createApp({
    checkDatabase: async () => {
      throw new InvalidDatabaseConfigurationError();
    },
  });

  await withServer(missingApp, async (url) => {
    const response = await fetch(`${url}/api/ready`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'DATABASE_NOT_CONFIGURED',
        message: 'Database chưa được cấu hình.',
      },
    });
  });

  await withServer(invalidApp, async (url) => {
    const response = await fetch(`${url}/api/ready`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'DATABASE_CONFIGURATION_INVALID',
        message: 'Cấu hình database không hợp lệ.',
      },
    });
  });
});

test('Prisma configuration errors do not include the supplied connection URL', () => {
  assert.throws(
    () => createPrismaClient(undefined),
    (error) => error instanceof DatabaseNotConfiguredError,
  );

  const urlWithMarker =
    'mysql://runtime:private-password-marker@localhost/unihub?unsupported=1';
  assert.throws(
    () => createPrismaClient(urlWithMarker),
    (error) => {
      assert.ok(error instanceof InvalidDatabaseConfigurationError);
      assert.equal(error.message.includes('private-password-marker'), false);
      assert.equal(error.message.includes('localhost'), false);
      return true;
    },
  );
});

test('GET /api/ready hides connection error details from responses and logs', async (context) => {
  const secretMarker = 'mysql://runtime:never-log-this@db.invalid/unihub';
  const loggedMessages = [];
  context.mock.method(console, 'error', (...messages) => {
    loggedMessages.push(messages);
  });
  const testApp = createApp({
    checkDatabase: async () => {
      throw new Error(secretMarker);
    },
  });

  await withServer(testApp, async (url) => {
    const response = await fetch(`${url}/api/ready`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database hiện không sẵn sàng.',
      },
    });
  });
  assert.equal(JSON.stringify(loggedMessages).includes(secretMarker), false);
  assert.equal(loggedMessages.length, 1);
});

test('server ignores MIGRATION_DATABASE_URL when DATABASE_URL is missing', async () => {
  const port = await getFreePort();
  const child = spawn(
    process.execPath,
    [`${backendDirectory}/dist/server.js`],
    {
      cwd: tmpdir(),
      env: {
        ...process.env,
        PORT: String(port),
        DATABASE_URL: '',
        MIGRATION_DATABASE_URL:
          'mysql://migration:must-not-be-used@127.0.0.1:1/migration_db',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let stdout = '';
  child.stdout.setEncoding('utf8');
  child.stderr.resume();

  try {
    await new Promise((resolve, reject) => {
      const startupTimeout = setTimeout(() => {
        child.stdout.off('data', checkOutput);
        child.off('exit', checkExit);
        reject(new Error('Server did not start in time.'));
      }, 5_000);
      const checkOutput = (chunk) => {
        stdout += chunk;
        if (stdout.includes('UniHub HTTP server:')) {
          clearTimeout(startupTimeout);
          child.stdout.off('data', checkOutput);
          child.off('exit', checkExit);
          resolve();
        }
      };
      const checkExit = () => {
        clearTimeout(startupTimeout);
        child.stdout.off('data', checkOutput);
        reject(new Error('Server exited before listening.'));
      };
      child.stdout.on('data', checkOutput);
      child.once('exit', checkExit);
    });

    const healthResponse = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(healthResponse.status, 200);

    const readyResponse = await fetch(`http://127.0.0.1:${port}/api/ready`);
    assert.equal(readyResponse.status, 503);
    assert.deepEqual(await readyResponse.json(), {
      error: {
        code: 'DATABASE_NOT_CONFIGURED',
        message: 'Database chưa được cấu hình.',
      },
    });
    assert.equal(child.exitCode, null);
  } finally {
    if (child.exitCode === null) {
      await new Promise((resolve) => {
        const shutdownTimeout = setTimeout(() => {
          child.kill('SIGKILL');
        }, 5_000);
        child.once('exit', () => {
          clearTimeout(shutdownTimeout);
          resolve();
        });
        child.kill('SIGTERM');
      });
    }
  }
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
