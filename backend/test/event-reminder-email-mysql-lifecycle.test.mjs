import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { join, dirname } from 'node:path';
import {
  assertSafeRunnerEnvironment,
  assertRunnerVersions,
  assertRunnerPrerequisites,
  assertBootstrapIdentity,
  initializeEmailMysqlLayout,
  guardMysqlSession,
  stopOwnedChild,
  assertCleanupLayout,
} from './helpers/event-reminder-email-mysql-lifecycle.mjs';
import { EMAIL_MYSQL_OWNER } from './helpers/event-reminder-email-mysql-guard.mjs';

const expected = {
  port: 44061,
  datadir: 'C:/Temp/private/data',
  uuid: '12345678-1234-1234-1234-123456789abc',
};
const identityLine = `${expected.port}\t${expected.datadir}\t${expected.uuid}\t8.4.13\n`;
function childFixture() {
  const child = new EventEmitter();
  Object.assign(child, {
    exitCode: null,
    signalCode: null,
    stdout: new EventEmitter(),
    inputs: [],
    kills: 0,
    stdin: {
      write: (value) => child.inputs.push(value),
      end: (value) => child.inputs.push(value),
    },
    kill: () => {
      child.kills++;
      return true;
    },
  });
  return child;
}

test('initialization sees empty data directory, sibling manifest, and failure retains layout', async () => {
  const files = new Map(),
    directories = [],
    root = join('fixture-temp', 'unihub-email-mysql-ABC123');
  let retained;
  const fs = {
    mkdtemp: async () => root,
    mkdir: async (path) => directories.push(path),
    writeFile: async (path, value) => files.set(path, value),
  };
  await assert.rejects(
    initializeEmailMysqlLayout(
      fs,
      'fixture-temp',
      async (data) => {
        assert.deepEqual(directories, [join(root, 'data')]);
        assert.equal(data, join(root, 'data'));
        assert.equal(files.size, 1);
        assert.equal(dirname([...files.keys()][0]), root);
        assert.equal(
          [...files.keys()].some((path) => dirname(path) === data),
          false,
        );
        assert.equal(retained.datadir, data);
        throw new Error('Fake initialization failure');
      },
      (value) => {
        retained = value;
      },
    ),
    /Fake initialization/,
  );
  assert.equal(retained.manifest.stopped, false);
});

test('identity gate releases bootstrap/shutdown only on the same verified session', () => {
  for (const sql of [
    'ALTER USER synthetic;',
    'CREATE DATABASE synthetic;',
    'SHUTDOWN;',
  ]) {
    const child = childFixture();
    const state = guardMysqlSession(child, expected, () => true, sql);
    assert.equal(child.inputs.length, 1);
    assert.match(child.inputs[0], /^SELECT /);
    child.stdout.emit('data', identityLine.slice(0, 10));
    assert.equal(child.inputs.length, 1);
    child.stdout.emit('data', identityLine.slice(10));
    assert.equal(child.inputs[1], sql);
    assert.equal(state().released, true);
  }
});

test('mismatched identity or dead owned server never receives privileged SQL', () => {
  for (const [line, alive] of [
    [identityLine.replace('44061', '3306'), true],
    [identityLine.replace(expected.uuid, 'foreign'), true],
    [identityLine.replace(expected.datadir, 'C:/Shared/data'), true],
    [identityLine.replace('8.4.13', '8.0.40'), true],
    [identityLine, false],
    ['x'.repeat(16385), true],
  ]) {
    const child = childFixture();
    const state = guardMysqlSession(child, expected, () => alive, 'SHUTDOWN;');
    child.stdout.emit('data', line);
    assert.equal(child.inputs.length, 1);
    assert.equal(child.kills, 1);
    assert.equal(state().refused, true);
  }
  assert.throws(
    () => assertBootstrapIdentity('malformed', expected),
    /MISMATCH/,
  );
});

test('shutdown falls back only to the owned child and requires observed exit', async () => {
  const child = childFixture(),
    unrelated = childFixture();
  assert.equal(
    await stopOwnedChild(
      child,
      async () => {
        throw new Error('Identity refused');
      },
      1,
    ),
    false,
  );
  assert.equal(child.kills, 1);
  assert.equal(unrelated.kills, 0);
  const graceful = childFixture();
  assert.equal(
    await stopOwnedChild(
      graceful,
      async () => {
        graceful.exitCode = 0;
        graceful.emit('exit');
      },
      1,
    ),
    true,
  );
  assert.equal(graceful.kills, 0);
  const forced = childFixture();
  forced.kill = () => {
    forced.signalCode = 'SIGTERM';
    forced.emit('exit');
  };
  assert.equal(await stopOwnedChild(forced, async () => {}, 1), true);
});

test('preconditions reject unsafe inherited configuration and unsupported versions', () => {
  for (const key of [
    'DATABASE_URL',
    'MIGRATION_DATABASE_URL',
    'TEST_OTHER_URL',
    'MYSQL_PWD',
    'NODE_OPTIONS',
    'NODE_PATH',
    'PRISMA_SCHEMA_ENGINE_BINARY',
    'RESEND_API_KEY',
  ])
    assert.throws(
      () => assertSafeRunnerEnvironment({ [key]: 'fake-only' }),
      /Refusing/,
    );
  assertSafeRunnerEnvironment({ NODE_ENV: 'test', TV4_MYSQL_BIN: 'fake-path' });
  assertRunnerVersions('24.19.0', '11.9.0');
  for (const [node, npm] of [
    ['22.19.0', '11.9.0'],
    ['24.18.9', '11.9.0'],
    ['25.0.0', '11.9.0'],
    ['24.19.0', '11.8.0'],
    ['24.19.0', '12.0.0'],
    ['24.19.0', 'invalid'],
  ])
    assert.throws(() => assertRunnerVersions(node, npm), /required/);
});

test('missing executables/engine/build fail preflight without starting processes', async () => {
  const files = [
    'mysqld.exe',
    'mysql.exe',
    'schema-engine-windows.exe',
    'npm-cli.js',
    'prisma.js',
    'build.js',
  ];
  for (const missing of files) {
    await assert.rejects(
      assertRunnerPrerequisites(
        {
          stat: async (file) => {
            if (file === missing) throw new Error('missing');
            return { isFile: () => true };
          },
        },
        files,
      ),
      /Missing runner prerequisite/,
    );
  }
  await assert.rejects(
    assertRunnerPrerequisites(
      { stat: async () => ({ isFile: () => false }) },
      files,
    ),
    /Missing/,
  );
});

test('cleanup requires exact sibling manifest, direct temp child, data subdirectory and confirmed stop', () => {
  const temp = join(process.cwd(), 'fake-temp');
  const artifacts = join(temp, 'unihub-email-mysql-ABC123');
  const manifestPath = join(artifacts, 'harness-manifest.json');
  const manifest = {
    owner: EMAIL_MYSQL_OWNER,
    artifacts,
    datadir: join(artifacts, 'data'),
    stopped: true,
  };
  assert.equal(assertCleanupLayout(manifestPath, manifest, temp), artifacts);
  for (const patch of [
    { stopped: false },
    { owner: 'other' },
    { artifacts: temp },
    { datadir: temp },
    { artifacts: join(temp, 'nested', 'unihub-email-mysql-ABC123') },
  ])
    assert.throws(
      () => assertCleanupLayout(manifestPath, { ...manifest, ...patch }, temp),
      /REFUSED/,
    );
  assert.throws(
    () =>
      assertCleanupLayout(join(temp, 'harness-manifest.json'), manifest, temp),
    /REFUSED/,
  );
});
