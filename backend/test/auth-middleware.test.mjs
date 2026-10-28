import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import express from 'express';
import { SignJWT } from 'jose';
import { errorHandler } from '../dist/middleware/errors.js';
import {
  createRequireAuth,
  createRequireRole,
} from '../dist/middleware/auth.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  createAccessTokenService,
  InvalidJwtConfigurationError,
} from '../dist/modules/auth/access-token.js';

const now = new Date('2026-10-28T12:00:00.000Z');
const config = {
  signingSecret: 'test-only-secret-with-at-least-32-bytes',
  issuer: 'https://api.test.invalid',
  audience: 'unihub-test-api',
};
const service = createAccessTokenService(config, () => now);
const identity = {
  userId: 42,
  role: 'Student',
  sessionId: 'd7f55cee-2d7c-4df9-aece-36b6eb446db5',
};

async function withServer(middlewares, callback) {
  const app = express();
  app.get('/protected', ...middlewares, (request, response) => {
    response.json({ authUser: request.authUser ?? null });
  });
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function sessionRecord(overrides = {}) {
  return {
    session_id: identity.sessionId,
    user_id: identity.userId,
    expires_at: new Date(now.getTime() + 60_000),
    revoked_at: null,
    ...overrides,
  };
}

function authenticated(
  session = sessionRecord(),
  findUnique = async () => session,
) {
  return createRequireAuth({
    verifyToken: service.verify,
    getPrismaClient: () => ({
      authSession: { findUnique },
    }),
    now: () => now,
  });
}

async function requestWithToken(token, middleware, roleMiddleware) {
  return withServer(
    roleMiddleware ? [middleware, roleMiddleware] : [middleware],
    async (url) =>
      fetch(`${url}/protected`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
  );
}

test('JWT ký HS256 hợp lệ mang identity đã xác minh và access tối đa 15 phút', async () => {
  const token = await service.sign(identity);
  const verified = await service.verify(token);
  assert.deepEqual(verified, {
    ...identity,
    issuedAt: Math.floor(now.getTime() / 1000),
    expiresAt: Math.floor(now.getTime() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
  });
});

test('JWT config từ chối secret mẫu, secret rỗng và secret dưới 32 byte', async () => {
  const invalidSecrets = [
    'replace-with-a-random-secret-of-at-least-32-bytes',
    '',
    'short-secret',
  ];
  for (const signingSecret of invalidSecrets) {
    assert.throws(
      () => createAccessTokenService({ ...config, signingSecret }),
      InvalidJwtConfigurationError,
    );
  }

  const middleware = createRequireAuth({
    verifyToken: async () =>
      createAccessTokenService({
        ...config,
        signingSecret: 'replace-with-a-random-secret-of-at-least-32-bytes',
      }).verify('unused'),
  });
  const response = await requestWithToken('a.b.c', middleware);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'SERVICE_UNAVAILABLE');
});

test('JWT bị sửa chữ ký, sai issuer/audience, claim hoặc thời hạn đều không hợp lệ', async () => {
  const validToken = await service.sign(identity);
  const [header, payload, signature] = validToken.split('.');
  const alteredSignature = `${header}.${payload}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
  await assert.rejects(service.verify(alteredSignature));

  const key = new TextEncoder().encode(config.signingSecret);
  const base = (claims = {}) =>
    new SignJWT({ role: identity.role, sid: identity.sessionId, ...claims })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setSubject(String(identity.userId))
      .setIssuedAt(Math.floor(now.getTime() / 1000))
      .setExpirationTime(Math.floor(now.getTime() / 1000) + 60);

  const invalidTokens = [
    await base().setIssuer('https://attacker.invalid').sign(key),
    await base().setAudience('other-api').sign(key),
    await base().setSubject('0').sign(key),
    await base({ role: 'Owner' }).sign(key),
    await base({ sid: 'not-a-session-id' }).sign(key),
    await base()
      .setIssuedAt(Math.floor(now.getTime() / 1000) + 60)
      .setExpirationTime(Math.floor(now.getTime() / 1000) + 120)
      .sign(key),
    await new SignJWT({ role: identity.role, sid: identity.sessionId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setSubject(String(identity.userId))
      .setExpirationTime(Math.floor(now.getTime() / 1000) + 60)
      .sign(key),
    await base()
      .setExpirationTime(
        Math.floor(now.getTime() / 1000) + ACCESS_TOKEN_TTL_SECONDS + 1,
      )
      .sign(key),
  ];
  for (const token of invalidTokens)
    await assert.rejects(service.verify(token));

  const wrongAlgorithmToken = await new SignJWT({
    role: identity.role,
    sid: identity.sessionId,
  })
    .setProtectedHeader({ alg: 'HS384', typ: 'JWT' })
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setSubject(String(identity.userId))
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(now.getTime() / 1000) + 60)
    .sign(key);
  await assert.rejects(service.verify(wrongAlgorithmToken));
});

test('JWT hết hạn bị từ chối', async () => {
  const token = await service.sign(identity);
  const expiredService = createAccessTokenService(
    config,
    () => new Date(now.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000),
  );
  await assert.rejects(expiredService.verify(token));
});

test('requireAuth chấp nhận Bearer, kiểm tra session và gắn claim đã ký', async () => {
  const token = await service.sign(identity);
  const response = await requestWithToken(token, authenticated());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    authUser: {
      ...identity,
      issuedAt: Math.floor(now.getTime() / 1000),
      expiresAt: Math.floor(now.getTime() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
    },
  });
});

test('thiếu/malformed token, thiếu/revoked/hết hạn/sai chủ session trả 401', async () => {
  const token = await service.sign(identity);
  const cases = [
    [undefined, authenticated()],
    ['not-a-jwt', authenticated()],
    [token, authenticated(null)],
    [token, authenticated(sessionRecord({ revoked_at: now }))],
    [token, authenticated(sessionRecord({ expires_at: now }))],
    [token, authenticated(sessionRecord({ user_id: identity.userId + 1 }))],
  ];
  for (const [candidate, middleware] of cases) {
    const response = await requestWithToken(candidate, middleware);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, 'UNAUTHORIZED');
  }
});

test('Student bị chặn bởi quyền Admin; role lấy từ JWT, không query users.role', async () => {
  const token = await service.sign(identity);
  let query;
  const middleware = createRequireAuth({
    verifyToken: service.verify,
    getPrismaClient: () => ({
      authSession: {
        findUnique: async (args) => {
          query = args;
          return sessionRecord();
        },
      },
    }),
    now: () => now,
  });
  const response = await requestWithToken(
    token,
    middleware,
    createRequireRole('Admin'),
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'FORBIDDEN');
  assert.deepEqual(query, {
    where: { session_id: identity.sessionId },
    select: {
      session_id: true,
      user_id: true,
      expires_at: true,
      revoked_at: true,
    },
  });
});

test('Admin được requireRole(Admin) theo claim đã ký', async () => {
  const token = await service.sign({ ...identity, role: 'Admin' });
  const response = await requestWithToken(
    token,
    authenticated(),
    createRequireRole('Admin'),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).authUser.role, 'Admin');
});

test('database lỗi trả 503 envelope chung, không lộ thông tin nội bộ', async () => {
  const token = await service.sign(identity);
  const middleware = createRequireAuth({
    verifyToken: service.verify,
    getPrismaClient: () => ({
      authSession: {
        findUnique: async () => {
          throw Object.assign(
            new Error('mysql://private-user:private-password@db.invalid'),
            { code: 'P1001' },
          );
        },
      },
    }),
  });
  const response = await requestWithToken(token, middleware);
  const body = await response.text();
  assert.equal(response.status, 503);
  assert.deepEqual(JSON.parse(body), {
    error: {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Database hiện không sẵn sàng.',
    },
  });
  assert.equal(body.includes('private-password'), false);
});
