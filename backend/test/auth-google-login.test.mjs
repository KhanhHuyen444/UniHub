import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import { createApp } from '../dist/app.js';
import { errorHandler } from '../dist/middleware/errors.js';
import { createAuthRouter } from '../dist/modules/auth/auth.routes.js';
import {
  createAccessTokenService,
  InvalidJwtConfigurationError,
} from '../dist/modules/auth/access-token.js';

const now = new Date('2026-10-29T12:00:00.000Z');
const origin = 'http://localhost:5173';
const authConfiguration = {
  googleClientId: 'client-id.apps.googleusercontent.com',
  allowedOrigins: [origin],
};
const jwtConfiguration = {
  signingSecret: 'isolated-test-signing-secret-has-32-bytes-minimum',
  issuer: 'https://api.test.invalid',
  audience: 'unihub-test-api',
};
const tokenService = createAccessTokenService(jwtConfiguration, () => now);
const verifiedGooglePayload = {
  iss: 'https://accounts.google.com',
  aud: authConfiguration.googleClientId,
  exp: Math.floor(now.getTime() / 1000) + 3600,
  sub: 'google-sub-test-123',
  email: 'student@example.invalid',
  email_verified: true,
  name: 'Student Example',
  picture: 'https://images.example.invalid/avatar.png',
};

async function withServer(app, callback) {
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

function testApp(dependencies = {}) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use(
    '/api/auth',
    createAuthRouter({
      getConfiguration: () => authConfiguration,
      validateAccessTokenConfiguration: () => {
        createAccessTokenService(jwtConfiguration, () => now);
      },
      signAccessToken: tokenService.sign,
      now: () => now,
      createSessionId: () => 'd7f55cee-2d7c-4df9-aece-36b6eb446db5',
      createRefreshSecret: () => 'isolated-refresh-secret-for-test-only',
      verifyGoogleIdToken: async (idToken, audience) => {
        assert.equal(idToken, 'fictional-google-id-token');
        assert.equal(audience, authConfiguration.googleClientId);
        return verifiedGooglePayload;
      },
      ...dependencies,
    }),
  );
  app.use(errorHandler);
  return app;
}

function makeDatabase({ initialUsers = [], sessionError } = {}) {
  let users = initialUsers.map((user) => ({ ...user }));
  const sessions = [];
  let transactionCount = 0;
  const client = {
    $transaction: async (operation) => {
      transactionCount += 1;
      const stagedUsers = users.map((user) => ({ ...user }));
      const stagedSessions = [];
      const transaction = {
        user: {
          findUnique: async ({ where }) =>
            stagedUsers.find((user) =>
              where.google_sub !== undefined
                ? user.google_sub === where.google_sub
                : user.email.toLowerCase() === where.email.toLowerCase(),
            ) ?? null,
          create: async ({ data }) => {
            const user = {
              user_id:
                Math.max(0, ...stagedUsers.map((item) => item.user_id)) + 1,
              major_id: null,
              academic_year: null,
              career_goal: null,
              created_at: now,
              updated_at: now,
              ...data,
            };
            stagedUsers.push(user);
            return user;
          },
          update: async ({ where, data }) => {
            const user = stagedUsers.find(
              (item) => item.user_id === where.user_id,
            );
            assert.ok(user);
            Object.assign(user, data);
            return user;
          },
        },
        authSession: {
          create: async ({ data }) => {
            if (sessionError) throw sessionError;
            const session = { ...data, revoked_at: null, created_at: now };
            stagedSessions.push(session);
            return session;
          },
        },
      };

      const result = await operation(transaction);
      users = stagedUsers;
      sessions.push(...stagedSessions);
      return result;
    },
  };
  return {
    client,
    users: () => users.map((user) => ({ ...user })),
    sessions: () => sessions.map((session) => ({ ...session })),
    transactionCount: () => transactionCount,
  };
}

async function postLogin(
  app,
  {
    body = { idToken: 'fictional-google-id-token' },
    requestOrigin = origin,
  } = {},
) {
  return withServer(app, (url) =>
    fetch(`${url}/api/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(requestOrigin ? { Origin: requestOrigin } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

function validExistingGoogleUser(overrides = {}) {
  return {
    user_id: 24,
    google_sub: verifiedGooglePayload.sub,
    email: 'stored@example.invalid',
    full_name: 'Stored Name',
    avatar_url: null,
    role: 'Student',
    major_id: null,
    academic_year: null,
    career_goal: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

test('login Google tạo Student, lưu hash session và trả token/cookie theo contract', async () => {
  const database = makeDatabase();
  const calls = [];
  const app = testApp({
    getPrismaClient: () => database.client,
    verifyGoogleIdToken: async (idToken, audience) => {
      calls.push(['google', idToken, audience]);
      return verifiedGooglePayload;
    },
  });

  const response = await postLogin(app);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(body.tokenType, 'Bearer');
  assert.equal(body.expiresIn, 900);
  assert.equal(body.user.id, 1);
  assert.equal(body.user.email, verifiedGooglePayload.email);
  assert.equal(body.user.role, 'Student');
  assert.equal((await tokenService.verify(body.accessToken)).role, 'Student');

  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /^unihub_refresh=/);
  assert.match(cookie, /Max-Age=604800/);
  assert.match(cookie, /Path=\/api\/auth/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  assert.equal(cookie.includes('isolated-refresh-secret-for-test-only'), true);

  const [session] = database.sessions();
  assert.equal(session.user_id, body.user.id);
  assert.equal(
    session.expires_at.getTime(),
    now.getTime() + 7 * 24 * 60 * 60 * 1000,
  );
  assert.equal(
    session.refresh_token_hash,
    createHash('sha256')
      .update('isolated-refresh-secret-for-test-only')
      .digest('hex'),
  );
  assert.equal(
    session.refresh_token_hash.includes('isolated-refresh-secret'),
    false,
  );
  assert.equal(database.users()[0].role, 'Student');
  assert.deepEqual(calls[0], [
    'google',
    'fictional-google-id-token',
    authConfiguration.googleClientId,
  ]);
});

test('login cùng google_sub cập nhật tên/avatar nhưng giữ email và role hiện có', async () => {
  const existingUser = validExistingGoogleUser({ role: 'Admin' });
  const database = makeDatabase({ initialUsers: [existingUser] });
  const response = await postLogin(
    testApp({ getPrismaClient: () => database.client }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.user.id, existingUser.user_id);
  assert.equal(body.user.email, existingUser.email);
  assert.equal(body.user.fullName, verifiedGooglePayload.name);
  assert.equal(body.user.avatarUrl, verifiedGooglePayload.picture);
  assert.equal(body.user.role, 'Admin');
  assert.equal(database.users().length, 1);
  assert.equal(database.sessions().length, 1);
});

test('email đã thuộc user khác trả ACCOUNT_LINK_REQUIRED, không tự liên kết', async () => {
  const existingUser = validExistingGoogleUser({
    google_sub: null,
    email: verifiedGooglePayload.email,
  });
  const database = makeDatabase({ initialUsers: [existingUser] });
  const response = await postLogin(
    testApp({ getPrismaClient: () => database.client }),
  );

  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'ACCOUNT_LINK_REQUIRED');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(database.users()[0].google_sub, null);
  assert.equal(database.sessions().length, 0);
});

test('Google verifier và các claim bắt buộc sai trả GOOGLE_TOKEN_INVALID', async () => {
  const verifierFailure = testApp({
    verifyGoogleIdToken: async () => {
      throw new Error('private verifier detail');
    },
  });
  const invalidClaims = [
    { iss: 'https://attacker.invalid' },
    { aud: 'other-client.apps.googleusercontent.com' },
    { exp: Math.floor(now.getTime() / 1000) - 1 },
    { sub: '' },
    { email: 'not-an-email' },
    { email_verified: false },
  ].map((claims) =>
    testApp({
      verifyGoogleIdToken: async () => ({
        ...verifiedGooglePayload,
        ...claims,
      }),
    }),
  );
  for (const app of [verifierFailure, ...invalidClaims]) {
    const response = await postLogin(app);
    const text = await response.text();
    assert.equal(response.status, 401);
    assert.equal(JSON.parse(text).error.code, 'GOOGLE_TOKEN_INVALID');
    assert.equal(text.includes('private verifier detail'), false);
  }
});

test('Google certificate network failure maps to SERVICE_UNAVAILABLE', async () => {
  const app = testApp({
    verifyGoogleIdToken: async () => {
      throw Object.assign(new Error('network detail'), { code: 'ECONNRESET' });
    },
  });
  const response = await postLogin(app);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'SERVICE_UNAVAILABLE');
});

test('Origin thiếu/sai bị từ chối trước khi gọi verifier hoặc database', async () => {
  let verifierCalls = 0;
  let databaseCalls = 0;
  const app = testApp({
    verifyGoogleIdToken: async () => {
      verifierCalls += 1;
      return verifiedGooglePayload;
    },
    getPrismaClient: () => {
      databaseCalls += 1;
      return makeDatabase().client;
    },
  });
  for (const requestOrigin of [null, 'https://attacker.invalid']) {
    const response = await postLogin(app, { requestOrigin });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, 'FORBIDDEN');
  }
  assert.equal(verifierCalls, 0);
  assert.equal(databaseCalls, 0);
});

test('cấu hình thiếu/sai trả SERVICE_UNAVAILABLE trước verifier và ghi dữ liệu', async () => {
  let verifierCalls = 0;
  let databaseCalls = 0;
  const invalidAuthConfiguration = testApp({
    getConfiguration: () => ({ googleClientId: '', allowedOrigins: [] }),
    verifyGoogleIdToken: async () => {
      verifierCalls += 1;
      return verifiedGooglePayload;
    },
    getPrismaClient: () => {
      databaseCalls += 1;
      return makeDatabase().client;
    },
  });
  const placeholderGoogleClient = testApp({
    getConfiguration: () => ({
      googleClientId:
        'replace-with-google-web-client-id.apps.googleusercontent.com',
      allowedOrigins: [origin],
    }),
  });
  const invalidJwtConfiguration = testApp({
    validateAccessTokenConfiguration: () => {
      throw new InvalidJwtConfigurationError();
    },
    verifyGoogleIdToken: async () => {
      verifierCalls += 1;
      return verifiedGooglePayload;
    },
    getPrismaClient: () => {
      databaseCalls += 1;
      return makeDatabase().client;
    },
  });
  for (const app of [
    invalidAuthConfiguration,
    placeholderGoogleClient,
    invalidJwtConfiguration,
  ]) {
    const response = await postLogin(app);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'SERVICE_UNAVAILABLE');
  }
  assert.equal(verifierCalls, 0);
  assert.equal(databaseCalls, 0);
});

test('body thiếu hoặc có field ngoài idToken trả INVALID_REQUEST', async () => {
  const app = testApp();
  for (const body of [
    {},
    { idToken: 'token', role: 'Admin' },
    { idToken: 42 },
  ]) {
    const response = await postLogin(app, { body });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_REQUEST');
  }
});

test('transaction thất bại rollback dữ liệu và không phát token/cookie', async () => {
  const database = makeDatabase({
    sessionError: Object.assign(new Error('database unavailable'), {
      code: 'P1001',
    }),
  });
  const response = await postLogin(
    testApp({ getPrismaClient: () => database.client }),
  );
  const text = await response.text();

  assert.equal(response.status, 503);
  assert.equal(JSON.parse(text).error.code, 'SERVICE_UNAVAILABLE');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(text.includes('accessToken'), false);
  assert.equal(database.users().length, 0);
  assert.equal(database.sessions().length, 0);
});

test('health và ready tiếp tục hoạt động khi không có cấu hình auth', async () => {
  const app = createApp({ checkDatabase: async () => {} });
  await withServer(app, async (url) => {
    const health = await fetch(`${url}/api/health`);
    const ready = await fetch(`${url}/api/ready`);
    assert.equal(health.status, 200);
    assert.equal(ready.status, 200);
  });
});
