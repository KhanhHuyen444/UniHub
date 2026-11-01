import { deadline } from './event-reminder-email-mysql-process.mjs';
import { join, resolve, dirname, basename, relative } from 'node:path';
import {
  datadirHash,
  EMAIL_MYSQL_OWNER,
} from './event-reminder-email-mysql-guard.mjs';

export function assertSafeRunnerEnvironment(env) {
  for (const key of Object.keys(env)) {
    if (
      /DATABASE_URL|^TEST_.*(?:URL|IDENTITY)$|^MYSQL|^PRISMA_|^NODE_OPTIONS$|^NODE_PATH$|^RESEND_/i.test(
        key,
      )
    )
      throw new Error(
        'Refusing external database targets, credentials or engine/preload overrides.',
      );
  }
}

export function assertRunnerVersions(node, npm) {
  if (!/^\d+\.\d+\.\d+$/.test(node) || !/^\d+\.\d+\.\d+$/.test(npm.trim()))
    throw new Error('Node >=24.19 <25 and npm >=11.9 <12 required.');
  const [major, minor, patch] = node.split('.').map(Number);
  const [npmMajor, npmMinor, npmPatch] = npm.trim().split('.').map(Number);
  if (
    major !== 24 ||
    minor < 19 ||
    !Number.isInteger(patch) ||
    npmMajor !== 11 ||
    npmMinor < 9 ||
    !Number.isInteger(npmPatch)
  )
    throw new Error('Node >=24.19 <25 and npm >=11.9 <12 required.');
}

export async function assertRunnerPrerequisites(fs, files) {
  for (const file of files) {
    try {
      if (!(await fs.stat(file)).isFile()) throw new Error('Not a file.');
    } catch {
      throw new Error(
        'Missing runner prerequisite; check MySQL binaries, bundled npm, build and cached Prisma engine.',
      );
    }
  }
}

export function assertCleanupLayout(manifestPath, manifest, tempRoot) {
  const target = resolve(manifest.artifacts ?? '');
  const parent = resolve(tempRoot);
  if (
    manifest.owner !== EMAIL_MYSQL_OWNER ||
    manifest.stopped !== true ||
    dirname(target) !== parent ||
    !/^unihub-email-mysql-[A-Za-z0-9]+$/.test(basename(target)) ||
    resolve(manifestPath) !== join(target, 'harness-manifest.json') ||
    resolve(manifest.datadir ?? '') !== join(target, 'data') ||
    relative(parent, target).includes('..')
  )
    throw new Error('EMAIL_MYSQL_CLEANUP_REFUSED');
  return target;
}

export function assertBootstrapIdentity(line, expected) {
  const actual = line.trim().split('\t');
  if (
    actual.length !== 4 ||
    Number(actual[0]) !== expected.port ||
    datadirHash(actual[1]) !== datadirHash(expected.datadir) ||
    actual[2] !== expected.uuid ||
    !/^8\.4\./.test(actual[3]) ||
    actual[3].includes('MariaDB')
  )
    throw new Error('EMAIL_MYSQL_IDENTITY_MISMATCH');
}

// No writes are released until this exact session has returned its identity.
// mysql must run with --skip-reconnect so a later reconnect cannot bypass it.
export function guardMysqlSession(child, expected, isAlive, input) {
  let probe = '',
    released = false,
    refused = false;
  const onData = (chunk) => {
    if (released || refused) return;
    probe += chunk.toString();
    if (probe.length > 16384) {
      refused = true;
      try {
        child.kill();
      } catch {
        /* Owner must verify exit. */
      }
      return;
    }
    if (!probe.includes('\n')) return;
    try {
      if (!isAlive()) throw new Error('Owned server exited.');
      assertBootstrapIdentity(probe.slice(0, probe.indexOf('\n')), expected);
      released = true;
      child.stdin.end(input);
    } catch {
      refused = true;
      try {
        child.kill();
      } catch {
        /* Owner must verify exit. */
      }
    }
  };
  child.stdout.on('data', onData);
  try {
    child.stdin.write('SELECT @@port, @@datadir, @@server_uuid, VERSION();\n');
  } catch (error) {
    child.stdout.removeListener('data', onData);
    throw error;
  }
  const state = () => ({ released, refused });
  state.dispose = () => child.stdout.removeListener('data', onData);
  return state;
}

export async function initializeEmailMysqlLayout(
  fs,
  tempRoot,
  initialize,
  record,
) {
  const artifacts = await fs.mkdtemp(join(tempRoot, 'unihub-email-mysql-'));
  const datadir = join(artifacts, 'data');
  await fs.mkdir(datadir);
  const layout = {
    artifacts,
    datadir,
    manifestPath: join(artifacts, 'harness-manifest.json'),
    manifest: { owner: EMAIL_MYSQL_OWNER, artifacts, datadir, stopped: false },
  };
  record(layout); // Retain cleanup location even when initialization fails.
  await fs.writeFile(
    layout.manifestPath,
    JSON.stringify(layout.manifest, null, 2),
  );
  await initialize(datadir);
  return layout;
}

export async function stopOwnedChild(child, graceful, waitMs = 5000) {
  if (!child) return true;
  const exited = () => child.exitCode !== null || child.signalCode !== null;
  if (exited()) return true;
  async function wait() {
    if (exited()) return;
    let timer, listener;
    try {
      await new Promise((r) => {
        listener = r;
        child.once('exit', listener);
        timer = setTimeout(r, waitMs);
      });
    } finally {
      clearTimeout(timer);
      child.removeListener('exit', listener);
    }
  }
  try {
    await deadline(graceful, waitMs, 'GRACEFUL_TIMEOUT');
  } catch {
    /* Fallback targets only the owned ChildProcess. */
  }
  if (!exited()) await wait();
  if (!exited()) {
    try {
      child.kill();
    } catch {
      return false;
    }
    // On Windows this is forced termination, never a service/PID lookup.
    await wait();
  }
  return exited(); // kill() returning true does not establish exit.
}

export const REQUIRED_BACKEND_EXPORTS = Object.freeze({
  'lib/prisma.js': ['createPrismaClient'],
  'generated/prisma/client.js': ['PrismaClient', 'Prisma'],
  'modules/events/reminders.service.js': ['processReminderEvent'],
  'modules/events/events.service.js': [
    'patchEvent',
    'patchEventStatus',
    'deleteEvent',
  ],
  'modules/events/reminder-email.js': ['readReminderEmailConfig'],
  'modules/events/reminder-email.store.js': ['createPrismaEmailStore'],
  'modules/events/reminder-email.worker.js': ['createReminderEmailWorker'],
  'modules/events/mail-transport.js': ['MailFailure'],
  'modules/events/reminder-email-policy.js': [
    'RETRY_DELAYS_MS',
    'IDEMPOTENCY_WINDOW_MS',
  ],
});
// Import factory definitions only; never invoke them or import server/scheduler entry points.
export async function validateBackendEntryPoints(load) {
  for (const [file, names] of Object.entries(REQUIRED_BACKEND_EXPORTS)) {
    const module = await load(file);
    if (names.some((name) => module[name] === undefined))
      throw new Error('BACKEND_ENTRY_POINT_MISSING');
    if (
      file === 'generated/prisma/client.js' &&
      !module.Prisma.ModelName?.EventReminderEmail
    )
      throw new Error('GENERATED_PRISMA_CLIENT_STALE');
  }
}
