import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  datadirHash,
  EMAIL_MYSQL_OPT_IN,
  EMAIL_MYSQL_OWNER,
  readEmailMysqlTestEnvironment,
  openVerifiedEmailMysqlClients,
} from './helpers/event-reminder-email-mysql-guard.mjs';
import {
  isolatedEmailMysqlChildEnvironment,
  redactEmailMysqlOutput,
} from './run-event-reminder-email-mysql.mjs';

const nonce = '0123456789abcdef';
const datadir = 'C:/Temp/unihub-email-mysql-test-fixture';
function fixture() {
  return {
    NODE_ENV: 'test',
    UNIHUB_EMAIL_MYSQL_TEST: EMAIL_MYSQL_OPT_IN,
    TEST_EVENT_REMINDER_EMAIL_MYSQL_IDENTITY: JSON.stringify({
      owner: EMAIL_MYSQL_OWNER,
      nonce,
      database: `unihub_email_test_${nonce}`,
      port: 44061,
      uuid: '12345678-1234-1234-1234-123456789abc',
      datadir_sha256: datadirHash(datadir),
    }),
    TEST_EVENT_REMINDER_EMAIL_DATABASE_URL: `mysql://uh_email_01234567:test-only@127.0.0.1:44061/unihub_email_test_${nonce}`,
    TEST_EVENT_REMINDER_EMAIL_DENIED_URL: `mysql://uh_noemail_01234567:test-only@127.0.0.1:44061/unihub_email_test_${nonce}`,
    TEST_EVENT_REMINDER_EMAIL_ADMIN_URL: `mysql://root:test-only@127.0.0.1:44061/unihub_email_test_${nonce}`,
  };
}

test('email MySQL guard accepts only explicit test credentials bound to one identity', () => {
  const config = readEmailMysqlTestEnvironment(fixture());
  assert.equal(config.identity.database, `unihub_email_test_${nonce}`);
  assert.equal(config.expectedUsers.runtime, 'uh_email_01234567');
});

test('unsafe/missing guards and URL targets are rejected before creating any client', async () => {
  const runtime = fixture().TEST_EVENT_REMINDER_EMAIL_DATABASE_URL;
  const changes = [
    { NODE_ENV: undefined },
    { NODE_ENV: 'production' },
    { UNIHUB_EMAIL_MYSQL_TEST: undefined },
    { TEST_EVENT_REMINDER_EMAIL_MYSQL_IDENTITY: '{}' },
    { TEST_EVENT_REMINDER_EMAIL_MYSQL_IDENTITY: 'bad JSON' },
    {
      TEST_EVENT_REMINDER_EMAIL_DATABASE_URL: undefined,
      DATABASE_URL: runtime,
    },
    ...[
      runtime.replace('127.0.0.1', 'example.com'),
      runtime.replace('127.0.0.1', 'localhost'),
      runtime.replace('44061', '3306'),
      runtime.replace(`unihub_email_test_${nonce}`, 'unihub_dev'),
      runtime.replace('uh_email_01234567', 'root'),
      `${runtime}?private=1`,
      `${runtime}#private`,
      runtime.replace(':test-only@', '@'),
      runtime.replace('mysql:', 'https:'),
    ].map((value) => ({ TEST_EVENT_REMINDER_EMAIL_DATABASE_URL: value })),
    {
      TEST_EVENT_REMINDER_EMAIL_ADMIN_URL:
        fixture().TEST_EVENT_REMINDER_EMAIL_ADMIN_URL.replace('44061', '44062'),
    },
  ];
  for (const change of changes) {
    let factories = 0;
    await assert.rejects(
      openVerifiedEmailMysqlClients({ ...fixture(), ...change }, () => {
        factories++;
      }),
      /GUARD_REFUSED/,
    );
    assert.equal(factories, 0);
  }
});

test('live-identity verification uses only a read probe and refuses unknown servers/accounts', async () => {
  for (const patch of [
    { db: 'unihub_dev' },
    { port: 3306 },
    { uuid: 'foreign-server' },
    { datadir: 'C:/Personal/MySQL/Data' },
    { version: '8.0.40' },
    { version: '11.4-MariaDB' },
    { account: 'shared_user@localhost' },
  ]) {
    let probes = 0,
      disconnected = 0;
    await assert.rejects(
      openVerifiedEmailMysqlClients(fixture(), () => ({
        $queryRaw: async (strings) => {
          probes++;
          assert.match(strings.join(''), /SELECT DATABASE\(\)/);
          return [
            {
              db: `unihub_email_test_${nonce}`,
              port: 44061,
              datadir,
              uuid: '12345678-1234-1234-1234-123456789abc',
              version: '8.4.13',
              account: 'root@localhost',
              ...patch,
            },
          ];
        },
        $disconnect: async () => {
          disconnected++;
        },
      })),
      /IDENTITY_OR_CONNECTION_REFUSED/,
    );
    assert.equal(probes, 1);
    assert.equal(disconnected, 1);
  }
});

test('verified clients are distinct and connection errors never disclose URLs/passwords', async () => {
  let factories = 0;
  const all = await openVerifiedEmailMysqlClients(fixture(), (url) => {
    factories++;
    return {
      $queryRaw: async () => [
        {
          db: `unihub_email_test_${nonce}`,
          port: 44061,
          datadir,
          uuid: '12345678-1234-1234-1234-123456789abc',
          version: '8.4.13',
          account: `${new URL(url).username}@localhost`,
        },
      ],
      $disconnect: async () => {},
    };
  });
  assert.equal(factories, 4);
  assert.notEqual(all.a, all.b);
  await assert.rejects(
    openVerifiedEmailMysqlClients(fixture(), () => ({
      $queryRaw: async () => {
        throw new Error('private-password mysql://private');
      },
      $disconnect: async () => {},
    })),
    (error) =>
      error.message === 'EMAIL_MYSQL_TEST_IDENTITY_OR_CONNECTION_REFUSED' &&
      error.cause === undefined,
  );
});

test('runner child environments exclude development credentials, provider keys and Node preload hooks', () => {
  const clean = isolatedEmailMysqlChildEnvironment({
    PATH: 'test-only-path',
    SystemRoot: 'C:/Windows',
    NODE_ENV: 'production',
    DATABASE_URL: 'mysql://private-development',
    MIGRATION_DATABASE_URL: 'mysql://private-migration',
    TEST_REMINDERS_DATABASE_URL: 'mysql://private-other-test',
    MYSQL_PWD: 'private-password',
    RESEND_API_KEY: 'private-key',
    EVENT_REMINDER_EMAIL_ENABLED: 'true',
    NODE_OPTIONS: '--import private-hook',
    JWT_SIGNING_SECRET: 'private-token',
  });
  assert.deepEqual(clean, {
    PATH: 'test-only-path',
    SystemRoot: 'C:/Windows',
    NODE_ENV: 'test',
    EVENT_REMINDER_EMAIL_ENABLED: 'false',
  });
  assert.equal(
    redactEmailMysqlOutput('private-password / private-key', [
      'private-password',
      'private-key',
    ]),
    '[redacted] / [redacted]',
  );
});
