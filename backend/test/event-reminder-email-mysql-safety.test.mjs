import {
  REQUIRED_BACKEND_EXPORTS,
  validateBackendEntryPoints,
} from './helpers/event-reminder-email-mysql-lifecycle.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createProcessOwner,
  startOnReservedPort,
} from './helpers/event-reminder-email-mysql-process.mjs';
import {
  requireEmailMysqlValidation,
  verifyEmailMysqlPrivileges,
} from './helpers/event-reminder-email-mysql-guard.mjs';
import {
  createMigrationSnapshot,
  validateMigrationSnapshot,
  REVIEWED_MIGRATIONS,
} from './helpers/event-reminder-email-mysql-migrations.mjs';
function child() {
  const c = new EventEmitter();
  Object.assign(c, { pid: 123, exitCode: null, signalCode: null, kills: 0 });
  c.kill = () => {
    c.kills++;
    return false;
  };
  for (const key of ['stdin', 'stdout', 'stderr']) {
    c[key] = new EventEmitter();
    c[key].destroy = () => {};
  }
  c.stdin.end = () => {};
  c.stdin.write = () => {};
  return c;
}
const options = { executionMs: 3, gracefulMs: 3, forceMs: 3, drainMs: 3 };
test('initializer timeout and failed termination retain uncertain manifest; unrelated process untouched', async () => {
  const initializer = child(),
    unrelated = child();
  const owner = createProcessOwner(() => initializer, options);
  await assert.rejects(
    owner.command('fake-initialize', []),
    /ISOLATED_PROCESS_STATE_UNCERTAIN/,
  );
  const manifest = await owner.cleanup();
  assert.equal(manifest.stopped, false);
  assert.equal(manifest.processes[0].killFailed, true);
  assert.equal(manifest.processes[0].exited, false);
  assert.equal(unrelated.kills, 0);
  owner.dispose();
  assert.equal(initializer.listenerCount('exit'), 0);
  assert.equal(initializer.listenerCount('error'), 0);
});
test('exit without close is bounded and is distinct from uncertain process death', async () => {
  const c = child();
  const owner = createProcessOwner(() => c, options);
  c.stdin.end = () => {
    c.exitCode = 0;
    c.emit('exit', 0, null);
  };
  await assert.rejects(owner.command('fake', []), /OUTPUT_CLOSE_TIMEOUT/);
  const result = await owner.cleanup();
  assert.equal(result.stopped, true);
  assert.equal(result.processes[0].closed, false);
  assert.equal(c.kills, 0);
  owner.dispose();
});
test('spawn failure, kill error and close alone never masquerade as exit', async () => {
  for (const spawnFailure of [false, true]) {
    const c = child();
    if (spawnFailure) c.pid = undefined;
    const owner = createProcessOwner(() => c, options);
    c.stdin.end = () => {
      c.emit(
        'error',
        Object.assign(
          new Error('fake'),
          spawnFailure ? { syscall: 'spawn fake' } : {},
        ),
      );
      c.emit('close', 1);
    };
    c.kill = () => {
      throw new Error('fake kill failure');
    };
    await assert.rejects(owner.command('fake', []));
    const result = await owner.cleanup();
    assert.equal(result.stopped, spawnFailure);
    assert.equal(result.processes[0].spawnFailed, spawnFailure);
    owner.dispose();
  }
});
test('hung graceful shutdown is bounded; signals target only live owned handles', async () => {
  const c = child(),
    unrelated = child(),
    alreadyExited = child();
  const owner = createProcessOwner(() => c, options);
  const server = owner.track(c);
  const old = owner.track(alreadyExited);
  alreadyExited.emit('exit', 0, null);
  assert.equal(old.exited, true);
  owner.signal();
  owner.signal();
  assert.equal(unrelated.kills, 0);
  assert.equal(alreadyExited.kills, 0);
  const result = await owner.cleanup(server, () => new Promise(() => {}));
  assert.equal(result.stopped, false);
  await assert.rejects(owner.command('fake', []), /Interrupted/);
  owner.dispose();
});
test('confirmed forced exit succeeds without inherited close handles', async () => {
  const c = child();
  const owner = createProcessOwner(() => c, options);
  const record = owner.track(c);
  c.kill = (signal) => {
    assert.equal(signal, 'SIGKILL');
    c.emit('exit', null, signal);
    return true;
  };
  assert.equal(
    (
      await owner.cleanup(record, async () => {
        throw new Error('identity refused');
      })
    ).stopped,
    true,
  );
  owner.dispose();
});
test('validation throws before fixture DML even when a simulated subtest swallows failure', async () => {
  let writes = 0;
  await assert.rejects(
    (async () => {
      await requireEmailMysqlValidation(async () => {
        throw new Error('schema invalid');
      });
      writes++;
    })(),
    /schema invalid/,
  );
  assert.equal(writes, 0);
  const swallowedSubtest = async (fn) => {
    try {
      await fn();
    } catch {
      /* node:test behavior */
    }
  };
  await swallowedSubtest(async () => {
    throw new Error('failed');
  });
  await assert.rejects(
    verifyEmailMysqlPrivileges(
      {
        $queryRaw: async () => [
          { grant: 'GRANT ALL PRIVILEGES ON *.* TO fake' },
        ],
      },
      'fake',
      true,
    ),
  );
  assert.equal(writes, 0);
});
test('private snapshot pins exact bytes and rejects source changes before deployment', async () => {
  const source = join(process.cwd(), 'backend/prisma/migrations'),
    dest = 'private-snapshot';
  const files = new Map(),
    dirs = new Set([dest]);
  let modified = false,
    unexpected = false;
  const fake = {
    readdir: async (path, opts) => {
      if (path.startsWith(source)) {
        const entries = await readdir(path, opts);
        return unexpected && path === source
          ? [...entries, { name: 'unexpected', isDirectory: () => true }]
          : entries;
      }
      if (path === dest)
        return [
          ...Object.keys(REVIEWED_MIGRATIONS).map((name) => ({
            name,
            isDirectory: () => true,
          })),
          { name: 'migration_lock.toml' },
        ];
      return [{ name: 'migration.sql', isFile: () => true }];
    },
    readFile: async (path, encoding) =>
      path.startsWith(source)
        ? modified && path.endsWith('migration.sql')
          ? Buffer.from('modified')
          : readFile(path, encoding)
        : files.get(path),
    mkdir: async (path) => {
      dirs.add(path);
    },
    writeFile: async (path, bytes, opts) => {
      assert.equal(opts.flag, 'wx');
      files.set(path, bytes);
    },
    chmod: async () => {},
  };
  await createMigrationSnapshot(fake, source, dest, Buffer.from('schema'));
  await validateMigrationSnapshot(fake, source, dest);
  modified = true;
  await assert.rejects(
    validateMigrationSnapshot(fake, source, dest),
    /CHECKSUM_REFUSED/,
  );
  modified = false;
  unexpected = true;
  await assert.rejects(
    validateMigrationSnapshot(fake, source, dest),
    /SET_REFUSED/,
  );
  unexpected = false;
  files.set(
    join(dest, Object.keys(REVIEWED_MIGRATIONS)[0], 'migration.sql'),
    Buffer.from('changed snapshot'),
  );
  await assert.rejects(
    validateMigrationSnapshot(fake, source, dest),
    /CHECKSUM_REFUSED/,
  );
});

test('reserved listener closes before server spawn, and interruption prevents spawn', async () => {
  const order = [];
  const reservation = {
    close: (cb) => {
      order.push('release');
      cb();
    },
  };
  await startOnReservedPort(
    reservation,
    () => order.push('spawn'),
    () => false,
  );
  assert.deepEqual(order, ['release', 'spawn']);
  await assert.rejects(
    startOnReservedPort(
      reservation,
      () => assert.fail('spawn after signal'),
      () => true,
    ),
    /Interrupted/,
  );
});

test('preflight checks every backend export and generated model without invoking factories', async () => {
  const modules = Object.fromEntries(
    Object.entries(REQUIRED_BACKEND_EXPORTS).map(([file, names]) => [
      file,
      Object.fromEntries(
        names.map((name) => [
          name,
          () => assert.fail('factory invoked during preflight'),
        ]),
      ),
    ]),
  );
  modules['generated/prisma/client.js'].Prisma = {
    ModelName: { EventReminderEmail: 'EventReminderEmail' },
  };
  await validateBackendEntryPoints(async (file) => modules[file]);
  for (const [file, names] of Object.entries(REQUIRED_BACKEND_EXPORTS)) {
    await assert.rejects(
      validateBackendEntryPoints(async (current) =>
        current === file
          ? { ...modules[current], [names[0]]: undefined }
          : modules[current],
      ),
      /MISSING/,
    );
  }
  modules['generated/prisma/client.js'].Prisma.ModelName = {};
  await assert.rejects(
    validateBackendEntryPoints(async (file) => modules[file]),
    /STALE/,
  );
});

test('identity mismatch is fatal even when output never closes', async () => {
  const c = child();
  const owner = createProcessOwner(() => c, options);
  await assert.rejects(
    owner.command('fake', [], {
      setup: () => {
        c.emit('exit', 1, null);
        return () => ({ released: false, refused: true });
      },
    }),
    /EMAIL_MYSQL_IDENTITY_MISMATCH/,
  );
  assert.equal((await owner.cleanup()).stopped, true);
  owner.dispose();
});
