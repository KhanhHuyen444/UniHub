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
const SESSION_ID = 'd7f55cee-2d7c-4df9-aece-36b6eb446db5';
const LOGIN_REFRESH_SECRET = 'A'.repeat(43);
const ROTATED_REFRESH_SECRET = 'B'.repeat(43);
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
      getAllowedOrigins: () => authConfiguration.allowedOrigins,
      validateAccessTokenConfiguration: () => {
        createAccessTokenService(jwtConfiguration, () => now);
      },
      signAccessToken: tokenService.sign,
      verifyAccessToken: tokenService.verify,
      now: () => now,
      createSessionId: () => SESSION_ID,
      createRefreshSecret: () => LOGIN_REFRESH_SECRET,
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

function makeDatabase({
  initialUsers = [],
  initialSessions = [],
  sessionError,
} = {}) {
  let users = initialUsers.map((user) => ({ ...user }));
  let sessions = initialSessions.map((session) => ({ ...session }));
  let transactionCount = 0;
  let transactionQueue = Promise.resolve();
  const client = {
    $transaction: async (operation) => {
      const previousTransaction = transactionQueue;
      let releaseTransaction;
      transactionQueue = new Promise((resolve) => {
        releaseTransaction = resolve;
      });
      await previousTransaction;
      transactionCount += 1;
      const stagedUsers = users.map((user) => ({ ...user }));
      const stagedSessions = sessions.map((session) => ({ ...session }));
      const createdSessions = [];
      const transaction = {
        user: {
          findUnique: async ({ where }) => {
            if (where.user_id !== undefined) {
              return (
                stagedUsers.find((user) => user.user_id === where.user_id) ??
                null
              );
            }
            return (
              stagedUsers.find((user) =>
                where.google_sub !== undefined
                  ? user.google_sub === where.google_sub
                  : user.email.toLowerCase() === where.email.toLowerCase(),
              ) ?? null
            );
          },
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
            createdSessions.push(session);
            return session;
          },
          findUnique: async ({ where }) =>
            stagedSessions.find(
              (session) => session.session_id === where.session_id,
            ) ?? null,
          updateMany: async ({ where, data }) => {
            if (sessionError) throw sessionError;
            const session = stagedSessions.find((candidate) => {
              if (candidate.session_id !== where.session_id) return false;
              if (
                where.refresh_token_hash !== undefined &&
                candidate.refresh_token_hash !== where.refresh_token_hash
              ) {
                return false;
              }
              if (where.revoked_at === null && candidate.revoked_at !== null) {
                return false;
              }
              if (
                where.expires_at?.gt &&
                candidate.expires_at.getTime() <= where.expires_at.gt.getTime()
              ) {
                return false;
              }
              return true;
            });
            if (!session) return { count: 0 };
            Object.assign(session, data);
            return { count: 1 };
          },
        },
      };
      try {
        const result = await operation(transaction);
        users = stagedUsers;
        sessions = [...stagedSessions, ...createdSessions];
        return result;
      } finally {
        releaseTransaction();
      }
    },
    user: {
      findUnique: async ({ where }) =>
        users.find((user) => user.user_id === where.user_id) ?? null,
    },
    authSession: {
      findUnique: async ({ where }) =>
        sessions.find((session) => session.session_id === where.session_id) ??
        null,
      updateMany: async ({ where, data }) => {
        if (sessionError) throw sessionError;
        const session = sessions.find((candidate) => {
          if (candidate.session_id !== where.session_id) return false;
          if (
            where.refresh_token_hash !== undefined &&
            candidate.refresh_token_hash !== where.refresh_token_hash
          ) {
            return false;
          }
          if (where.revoked_at === null && candidate.revoked_at !== null) {
            return false;
          }
          return true;
        });
        if (!session) return { count: 0 };
        Object.assign(session, data);
        return { count: 1 };
      },
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

function activeSession(secret = LOGIN_REFRESH_SECRET, overrides = {}) {
  return {
    session_id: SESSION_ID,
    user_id: 24,
    refresh_token_hash: createHash('sha256').update(secret).digest('hex'),
    expires_at: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
    revoked_at: null,
    created_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

function cookieFor(secret = LOGIN_REFRESH_SECRET) {
  return `unihub_refresh=${SESSION_ID}.${secret}`;
}

async function postCookieEndpoint(
  app,
  endpoint,
  { cookie, requestOrigin = origin, fetchSite = 'same-origin', body } = {},
) {
  return withServer(app, (url) =>
    fetch(`${url}/api/auth/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(requestOrigin ? { Origin: requestOrigin } : {}),
        ...(fetchSite ? { 'Sec-Fetch-Site': fetchSite } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

async function getMe(app, accessToken, query = '') {
  return withServer(app, (url) =>
    fetch(`${url}/api/auth/me${query}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
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
  assert.equal(cookie.includes(LOGIN_REFRESH_SECRET), true);

  const [session] = database.sessions();
  assert.equal(session.user_id, body.user.id);
  assert.equal(
    session.expires_at.getTime(),
    now.getTime() + 7 * 24 * 60 * 60 * 1000,
  );
  assert.equal(
    session.refresh_token_hash,
    createHash('sha256').update(LOGIN_REFRESH_SECRET).digest('hex'),
  );
  assert.equal(
    session.refresh_token_hash.includes(LOGIN_REFRESH_SECRET),
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

test('refresh xoay hash trong transaction, giữ expiry tuyệt đối và đọc role mới', async () => {
  const user = validExistingGoogleUser({ role: 'Admin' });
  const previousExpiry = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const session = activeSession(LOGIN_REFRESH_SECRET, {
    expires_at: previousExpiry,
  });
  const database = makeDatabase({
    initialUsers: [user],
    initialSessions: [session],
  });
  const app = testApp({
    getPrismaClient: () => database.client,
    createRefreshSecret: () => ROTATED_REFRESH_SECRET,
  });

  const response = await postCookieEndpoint(app, 'refresh', {
    cookie: cookieFor(),
  });
  const body = await response.json();
  const rotatedSession = database.sessions()[0];

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(body.user.role, 'Admin');
  assert.equal((await tokenService.verify(body.accessToken)).role, 'Admin');
  assert.equal(
    rotatedSession.refresh_token_hash,
    createHash('sha256').update(ROTATED_REFRESH_SECRET).digest('hex'),
  );
  assert.equal(rotatedSession.expires_at.getTime(), previousExpiry.getTime());
  assert.equal(
    rotatedSession.expires_at.getTime(),
    session.expires_at.getTime(),
  );
  assert.equal(
    response.headers.get('set-cookie').includes(ROTATED_REFRESH_SECRET),
    true,
  );
  assert.equal(body.accessToken.includes(ROTATED_REFRESH_SECRET), false);
  assert.equal(database.transactionCount(), 1);
});

test('hai refresh đồng thời cùng secret chỉ một request thành công', async () => {
  const database = makeDatabase({
    initialUsers: [validExistingGoogleUser()],
    initialSessions: [activeSession()],
  });
  const app = testApp({
    getPrismaClient: () => database.client,
    createRefreshSecret: (() => {
      const secrets = [ROTATED_REFRESH_SECRET, 'C'.repeat(43)];
      let index = 0;
      return () => secrets[index++ % secrets.length];
    })(),
  });

  await withServer(app, async (url) => {
    const refresh = () =>
      fetch(`${url}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          Origin: origin,
          'Sec-Fetch-Site': 'same-origin',
          'Content-Type': 'application/json',
          Cookie: cookieFor(),
        },
      });
    const responses = await Promise.all([refresh(), refresh()]);
    assert.deepEqual(
      responses.map((response) => response.status).sort(),
      [200, 401],
    );
    const winner = responses.find((response) => response.status === 200);
    const loser = responses.find((response) => response.status === 401);
    assert.match(winner.headers.get('set-cookie'), /unihub_refresh=/);
    assert.equal(loser.headers.get('set-cookie'), null);

    const nextCookie = winner.headers.get('set-cookie').split(';', 1)[0];
    const nextResponse = await fetch(`${url}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Origin: origin,
        'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/json',
        Cookie: nextCookie,
      },
    });
    assert.equal(nextResponse.status, 200);
  });

  assert.equal(
    database.sessions()[0].refresh_token_hash,
    createHash('sha256').update(ROTATED_REFRESH_SECRET).digest('hex'),
  );
  assert.equal(
    database.sessions()[0].expires_at.getTime(),
    activeSession().expires_at.getTime(),
  );
});

test('refresh cookie lifetime matches remaining absolute session lifetime', async () => {
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  const database = makeDatabase({
    initialUsers: [validExistingGoogleUser()],
    initialSessions: [
      activeSession(LOGIN_REFRESH_SECRET, { expires_at: expiresAt }),
    ],
  });
  const response = await postCookieEndpoint(
    testApp({
      getPrismaClient: () => database.client,
      createRefreshSecret: () => ROTATED_REFRESH_SECRET,
    }),
    'refresh',
    { cookie: cookieFor() },
  );

  assert.equal(response.status, 200);
  const setCookie = response.headers.get('set-cookie');
  const maxAge = Number(/Max-Age=(\d+)/i.exec(setCookie)?.[1]);
  assert.ok(maxAge > 0 && maxAge <= 600);
  assert.ok(maxAge < 7 * 24 * 60 * 60);
  assert.equal(
    database.sessions()[0].expires_at.getTime(),
    expiresAt.getTime(),
  );
});

test('refresh hash cũ không xóa cookie; session revoked/hết hạn xóa cookie', async () => {
  const cases = [
    {
      session: activeSession(LOGIN_REFRESH_SECRET, {
        refresh_token_hash: createHash('sha256')
          .update(ROTATED_REFRESH_SECRET)
          .digest('hex'),
      }),
      clearsCookie: false,
    },
    {
      session: activeSession(LOGIN_REFRESH_SECRET, { revoked_at: now }),
      clearsCookie: true,
    },
    {
      session: activeSession(LOGIN_REFRESH_SECRET, { expires_at: now }),
      clearsCookie: true,
    },
  ];
  for (const { session, clearsCookie } of cases) {
    const database = makeDatabase({
      initialUsers: [validExistingGoogleUser()],
      initialSessions: [session],
    });
    const response = await postCookieEndpoint(
      testApp({ getPrismaClient: () => database.client }),
      'refresh',
      { cookie: cookieFor() },
    );
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, 'UNAUTHORIZED');
    if (clearsCookie) {
      assert.match(
        response.headers.get('set-cookie'),
        /Expires=Thu, 01 Jan 1970 00:00:00 GMT/,
      );
    } else {
      assert.equal(response.headers.get('set-cookie'), null);
    }
    assert.equal(
      database.sessions()[0].refresh_token_hash,
      session.refresh_token_hash,
    );
  }
});

test('refresh rollback giữ hash cũ và không trả cookie/token khi ký access lỗi', async () => {
  const session = activeSession();
  const database = makeDatabase({
    initialUsers: [validExistingGoogleUser()],
    initialSessions: [session],
  });
  const app = testApp({
    getPrismaClient: () => database.client,
    createRefreshSecret: () => ROTATED_REFRESH_SECRET,
    signAccessToken: async () => {
      throw new Error('signing failure');
    },
  });
  const response = await postCookieEndpoint(app, 'refresh', {
    cookie: cookieFor(),
  });
  const text = await response.text();

  assert.equal(response.status, 500);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(text.includes('accessToken'), false);
  assert.equal(
    database.sessions()[0].refresh_token_hash,
    session.refresh_token_hash,
  );
});

test('refresh kiểm tra Origin, Fetch Metadata và cấu hình trước database', async () => {
  let databaseCalls = 0;
  const app = testApp({
    getPrismaClient: () => {
      databaseCalls += 1;
      return makeDatabase().client;
    },
  });
  for (const [request, expectedStatus, expectedCode] of [
    [
      { requestOrigin: 'https://attacker.invalid', cookie: cookieFor() },
      403,
      'FORBIDDEN',
    ],
    [{ fetchSite: 'cross-site', cookie: cookieFor() }, 403, 'FORBIDDEN'],
    [{ cookie: cookieFor(), body: {} }, 400, 'INVALID_REQUEST'],
  ]) {
    const response = await postCookieEndpoint(app, 'refresh', request);
    assert.equal(response.status, expectedStatus);
    assert.equal((await response.json()).error.code, expectedCode);
  }
  assert.equal(databaseCalls, 0);
});

test('/me trả profile tối thiểu, role theo JWT snapshot và không lộ nội bộ', async () => {
  const user = validExistingGoogleUser({ role: 'Admin' });
  const database = makeDatabase({
    initialUsers: [user],
    initialSessions: [activeSession()],
  });
  const accessToken = await tokenService.sign({
    userId: user.user_id,
    role: 'Student',
    sessionId: SESSION_ID,
  });
  const response = await getMe(
    testApp({ getPrismaClient: () => database.client }),
    accessToken,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), {
    user: {
      id: user.user_id,
      email: user.email,
      fullName: user.full_name,
      avatarUrl: user.avatar_url,
      role: 'Student',
    },
  });
});

test('/me từ chối query và user không còn tồn tại', async () => {
  const user = validExistingGoogleUser();
  const accessToken = await tokenService.sign({
    userId: user.user_id,
    role: 'Student',
    sessionId: SESSION_ID,
  });
  const database = makeDatabase({ initialSessions: [activeSession()] });
  const app = testApp({ getPrismaClient: () => database.client });
  const missingUser = await getMe(app, accessToken);
  assert.equal(missingUser.status, 401);
  const query = await getMe(
    testApp({
      getPrismaClient: () =>
        makeDatabase({
          initialUsers: [user],
          initialSessions: [activeSession()],
        }).client,
    }),
    accessToken,
    '?debug=true',
  );
  assert.equal(query.status, 400);
});

test('logout thu hồi đúng một phiên, xóa cookie và middleware từ chối JWT cũ', async () => {
  const otherSessionId = '9c568cb9-4664-4f67-b1a1-f20da181235c';
  const otherSecret = 'C'.repeat(43);
  const otherSession = activeSession(otherSecret, {
    session_id: otherSessionId,
  });
  const database = makeDatabase({
    initialUsers: [validExistingGoogleUser()],
    initialSessions: [activeSession(), otherSession],
  });
  const app = testApp({ getPrismaClient: () => database.client });
  const oldAccessToken = await tokenService.sign({
    userId: 24,
    role: 'Student',
    sessionId: SESSION_ID,
  });

  const response = await postCookieEndpoint(app, 'logout', {
    cookie: cookieFor(),
  });
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  const clearedCookie = response.headers.get('set-cookie');
  assert.match(clearedCookie, /^unihub_refresh=;/);
  assert.match(clearedCookie, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
  assert.match(clearedCookie, /Path=\/api\/auth/);
  assert.match(clearedCookie, /HttpOnly/);
  assert.match(clearedCookie, /Secure/);
  assert.match(clearedCookie, /SameSite=Strict/);
  assert.equal(database.sessions()[0].revoked_at.getTime(), now.getTime());
  assert.equal(database.sessions()[1].revoked_at, null);

  const protectedResponse = await getMe(app, oldAccessToken);
  assert.equal(protectedResponse.status, 401);
});

test('logout thiếu cookie idempotent và cookie cũ không thu hồi phiên mới', async () => {
  const database = makeDatabase({
    initialUsers: [validExistingGoogleUser()],
    initialSessions: [activeSession(ROTATED_REFRESH_SECRET)],
  });
  const app = testApp({ getPrismaClient: () => database.client });
  const noCookie = await postCookieEndpoint(app, 'logout');
  assert.equal(noCookie.status, 204);
  assert.match(
    noCookie.headers.get('set-cookie'),
    /Expires=Thu, 01 Jan 1970 00:00:00 GMT/,
  );

  const staleCookie = await postCookieEndpoint(app, 'logout', {
    cookie: cookieFor(),
  });
  assert.equal(staleCookie.status, 204);
  assert.equal(database.sessions()[0].revoked_at, null);
});
