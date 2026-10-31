import { createHash } from 'node:crypto';
import { normalize, resolve } from 'node:path';

export const EMAIL_MYSQL_OPT_IN = 'disposable-mysql84';
export const EMAIL_MYSQL_OWNER = 'unihub-event-reminder-email-tests';

function refuse() {
  throw new Error('EMAIL_MYSQL_TEST_GUARD_REFUSED');
}
export function datadirHash(value) {
  return createHash('sha256')
    .update(normalize(resolve(value)).toLowerCase())
    .digest('hex');
}

// Pure validation. Never load .env, use DATABASE_URL, or open a connection here.
export function readEmailMysqlTestEnvironment(env) {
  if (
    env.NODE_ENV !== 'test' ||
    env.UNIHUB_EMAIL_MYSQL_TEST !== EMAIL_MYSQL_OPT_IN
  )
    refuse();
  let identity;
  try {
    identity = JSON.parse(
      env.TEST_EVENT_REMINDER_EMAIL_MYSQL_IDENTITY ?? 'null',
    );
  } catch {
    refuse();
  }
  if (
    !identity ||
    identity.owner !== EMAIL_MYSQL_OWNER ||
    !/^[a-f0-9]{16}$/.test(identity.nonce ?? '') ||
    identity.database !== `unihub_email_test_${identity.nonce}` ||
    !Number.isInteger(identity.port) ||
    identity.port < 1024 ||
    identity.port > 65535 ||
    identity.port === 3306 ||
    !/^[a-f0-9-]{36}$/.test(identity.uuid ?? '') ||
    !/^[a-f0-9]{64}$/.test(identity.datadir_sha256 ?? '')
  )
    refuse();
  const suffix = identity.nonce.slice(0, 8);
  const expectedUsers = {
    runtime: `uh_email_${suffix}`,
    denied: `uh_noemail_${suffix}`,
    admin: 'root',
  };
  const urls = {};
  for (const [role, variable] of [
    ['runtime', 'TEST_EVENT_REMINDER_EMAIL_DATABASE_URL'],
    ['denied', 'TEST_EVENT_REMINDER_EMAIL_DENIED_URL'],
    ['admin', 'TEST_EVENT_REMINDER_EMAIL_ADMIN_URL'],
  ]) {
    let url;
    try {
      url = new URL(env[variable]);
    } catch {
      refuse();
    }
    if (
      url.protocol !== 'mysql:' ||
      url.hostname !== '127.0.0.1' ||
      Number(url.port) !== identity.port ||
      url.pathname !== `/${identity.database}` ||
      url.username !== expectedUsers[role] ||
      !url.password ||
      url.search ||
      url.hash
    )
      refuse();
    urls[role] = url.href;
  }
  return { identity, urls, expectedUsers };
}

export async function verifyEmailMysqlIdentity(client, config, role) {
  const [actual] = await client.$queryRaw`
    SELECT DATABASE() AS db, @@port AS port, @@datadir AS datadir,
      @@server_uuid AS uuid, VERSION() AS version, CURRENT_USER() AS account
  `;
  const wanted = config.identity;
  if (
    !actual ||
    actual.db !== wanted.database ||
    Number(actual.port) !== wanted.port ||
    actual.uuid !== wanted.uuid ||
    datadirHash(actual.datadir) !== wanted.datadir_sha256 ||
    !/^8\.4\./.test(actual.version) ||
    actual.version.includes('MariaDB') ||
    actual.account.split('@')[0] !== config.expectedUsers[role]
  )
    refuse();
}

// The only initial SQL is a read-only identity probe. No caller receives clients
// until all accounts prove they belong to the runner's fresh private instance.
export async function openVerifiedEmailMysqlClients(env, createClient) {
  const config = readEmailMysqlTestEnvironment(env);
  const clients = {};
  try {
    for (const [name, role] of [
      ['admin', 'admin'],
      ['a', 'runtime'],
      ['b', 'runtime'],
      ['denied', 'denied'],
    ]) {
      clients[name] = createClient(config.urls[role]);
      await verifyEmailMysqlIdentity(clients[name], config, role);
    }
    return { ...clients, config };
  } catch {
    await Promise.allSettled(
      Object.values(clients).map((client) => client.$disconnect()),
    );
    throw new Error('EMAIL_MYSQL_TEST_IDENTITY_OR_CONNECTION_REFUSED');
  }
}

// Must throw in the parent test; node:test records failed subtests without rejecting.
export async function requireEmailMysqlValidation(validate) {
  await validate();
}
export async function verifyEmailMysqlPrivileges(
  client,
  database,
  emailAllowed,
) {
  const rows = await client.$queryRaw`SHOW GRANTS FOR CURRENT_USER`;
  const grants = rows.flatMap((row) => Object.values(row));
  const expected = new Map([
    ['users', ['SELECT']],
    ['events', ['DELETE', 'INSERT', 'SELECT', 'UPDATE']],
    ['notifications', ['DELETE', 'INSERT', 'SELECT', 'UPDATE']],
    ['activity_logs', ['INSERT', 'SELECT']],
  ]);
  if (emailAllowed)
    expected.set('event_reminder_emails', ['INSERT', 'SELECT', 'UPDATE']);
  for (const grant of grants) {
    if (/^GRANT USAGE ON \*\.\* TO /.test(grant)) continue;
    const match = /^GRANT (.+) ON `([^`]+)`\.`([^`]+)` TO [^]+$/.exec(grant);
    if (!match || match[2] !== database || /WITH GRANT OPTION/.test(grant))
      refuse();
    const wanted = expected.get(match[3]);
    if (
      !wanted ||
      JSON.stringify(match[1].split(', ').sort()) !== JSON.stringify(wanted)
    )
      refuse();
    expected.delete(match[3]);
  }
  if (expected.size) refuse();
}
