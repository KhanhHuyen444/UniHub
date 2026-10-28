import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import { createPrismaClient } from '../dist/lib/prisma.js';
import { errorHandler } from '../dist/middleware/errors.js';
import { createAuthRouter } from '../dist/modules/auth/auth.routes.js';
import { createAccessTokenService } from '../dist/modules/auth/access-token.js';

const databaseUrl = process.env.TEST_AUTH_DATABASE_URL;
const origin = 'http://127.0.0.1:5173';
const now = new Date('2026-10-29T12:00:00.000Z');
const signingService = createAccessTokenService(
  {
    signingSecret: 'mysql-isolated-auth-test-secret-at-least-32-bytes',
    issuer: 'https://auth-test.invalid',
    audience: 'unihub-auth-mysql-test',
  },
  () => now,
);

function assertIsolatedDatabase(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('TEST_AUTH_DATABASE_URL must be a valid MySQL URL.');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (
    url.protocol !== 'mysql:' ||
    !['localhost', '127.0.0.1', '::1'].includes(hostname) ||
    !databaseName.startsWith('unihub_auth_test') ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'TEST_AUTH_DATABASE_URL must target a loopback-only unihub_auth_test* database.',
    );
  }
}

test(
  'MySQL auth refresh: rollback, single-winner rotation, fixed expiry, role refresh and logout revocation',
  { skip: !databaseUrl && 'TEST_AUTH_DATABASE_URL is not configured.' },
  async () => {
    assertIsolatedDatabase(databaseUrl);
    const prisma = createPrismaClient(databaseUrl);
    let server;
    let createdUserId;
    let createdSessionId;
    try {
      await prisma.$connect();
      const [version] = await prisma.$queryRaw`SELECT VERSION() AS version`;
      assert.match(String(version.version), /^8\.4\./);

      const user = await prisma.user.create({
        data: {
          google_sub: `mysql-test-${randomUUID()}`,
          email: `mysql-auth-${randomUUID()}@example.invalid`,
          full_name: 'Isolated auth test user',
          role: 'Student',
        },
      });
      createdUserId = user.user_id;

      const sessionId = randomUUID();
      createdSessionId = sessionId;
      const oldSecret = Buffer.from(randomUUID() + randomUUID()).toString(
        'base64url',
      );
      const refreshSecret = oldSecret.slice(0, 43);
      const oldHash = createHash('sha256').update(refreshSecret).digest('hex');
      const expiresAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      await prisma.authSession.create({
        data: {
          session_id: sessionId,
          user_id: user.user_id,
          refresh_token_hash: oldHash,
          expires_at: expiresAt,
        },
      });

      const oldAccessToken = await signingService.sign({
        userId: user.user_id,
        role: 'Student',
        sessionId,
      });
      await prisma.user.update({
        where: { user_id: user.user_id },
        data: { role: 'Admin' },
      });

      let signFailure = true;
      let newSecretIndex = 0;
      const nextSecrets = ['A'.repeat(43), 'B'.repeat(43), 'C'.repeat(43)];
      const app = express();
      app.use(express.json({ limit: '100kb' }));
      app.use(
        '/api/auth',
        createAuthRouter({
          getPrismaClient: () => prisma,
          getAllowedOrigins: () => [origin],
          validateAccessTokenConfiguration: () => {},
          verifyAccessToken: signingService.verify,
          signAccessToken: async (identity) => {
            if (signFailure) throw new Error('isolated signing failure');
            return signingService.sign(identity);
          },
          createRefreshSecret: () =>
            nextSecrets[newSecretIndex++ % nextSecrets.length],
          now: () => now,
        }),
      );
      app.use(errorHandler);

      server = app.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const baseUrl = `http://127.0.0.1:${server.address().port}`;
      const oldCookie = `unihub_refresh=${sessionId}.${refreshSecret}`;
      const refresh = () =>
        fetch(`${baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            Origin: origin,
            'Sec-Fetch-Site': 'same-origin',
            'Content-Type': 'application/json',
            Cookie: oldCookie,
          },
        });

      const failedRefresh = await refresh();
      assert.equal(failedRefresh.status, 500);
      assert.equal(failedRefresh.headers.get('set-cookie'), null);
      assert.equal(
        (
          await prisma.authSession.findUnique({
            where: { session_id: sessionId },
          })
        ).refresh_token_hash,
        oldHash,
      );
      assert.equal(
        (
          await prisma.authSession.findUnique({
            where: { session_id: sessionId },
          })
        ).expires_at.getTime(),
        expiresAt.getTime(),
      );

      signFailure = false;
      const concurrentResponses = await Promise.all([refresh(), refresh()]);
      assert.deepEqual(
        concurrentResponses.map((response) => response.status).sort(),
        [200, 401],
      );
      const successIndex = concurrentResponses.findIndex(
        (response) => response.status === 200,
      );
      const successResponse = concurrentResponses[successIndex];
      const successBody = await successResponse.json();
      const successCookie = successResponse.headers.get('set-cookie');
      const secretMatch = /unihub_refresh=([^.]+)\.([^;]+)/.exec(successCookie);
      assert.ok(secretMatch);
      const rotatedSecret = secretMatch[2];
      const refreshedSession = await prisma.authSession.findUnique({
        where: { session_id: sessionId },
      });
      assert.equal(
        refreshedSession.refresh_token_hash,
        createHash('sha256').update(rotatedSecret).digest('hex'),
      );
      assert.equal(refreshedSession.expires_at.getTime(), expiresAt.getTime());
      assert.equal(refreshedSession.revoked_at, null);
      assert.equal(successBody.user.role, 'Admin');
      assert.equal(
        (await signingService.verify(successBody.accessToken)).role,
        'Admin',
      );

      const snapshot = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${oldAccessToken}` },
      });
      assert.equal(snapshot.status, 200);
      assert.equal((await snapshot.json()).user.role, 'Student');

      const logout = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Origin: origin,
          'Sec-Fetch-Site': 'same-origin',
          'Content-Type': 'application/json',
          Cookie: `unihub_refresh=${sessionId}.${rotatedSecret}`,
        },
      });
      assert.equal(logout.status, 204);
      assert.match(logout.headers.get('set-cookie'), /Path=\/api\/auth/);

      const rejectedAfterLogout = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${successBody.accessToken}`,
        },
      });
      assert.equal(rejectedAfterLogout.status, 401);
    } finally {
      if (server) {
        await new Promise((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
      if (createdSessionId) {
        await prisma.authSession.deleteMany({
          where: { session_id: createdSessionId },
        });
      }
      if (createdUserId) {
        await prisma.user.deleteMany({ where: { user_id: createdUserId } });
      }
      await prisma.$disconnect();
    }
  },
);
