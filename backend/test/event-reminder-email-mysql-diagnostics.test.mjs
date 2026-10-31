import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { createProcessOwner } from './helpers/event-reminder-email-mysql-process.mjs';
import {
  createRunnerDiagnostics,
  runWithRunnerDiagnostics,
  redactEmailMysqlOutput,
} from './helpers/event-reminder-email-mysql-diagnostics.mjs';

const password = 'fake-private-password';
const url = `mysql://root:${password}@127.0.0.1:44444/private`;
function fixture() {
  const files = new Map(),
    printed = [];
  const diagnostics = createRunnerDiagnostics({
    writeFile: async (path, contents) => files.set(path, contents),
    print: (text) => printed.push(text),
  });
  diagnostics.addSecrets([password]);
  const child = new EventEmitter();
  Object.assign(child, { pid: 123, exitCode: null, signalCode: null });
  for (const key of ['stdin', 'stdout', 'stderr']) {
    child[key] = new EventEmitter();
    child[key].destroy = () => {};
  }
  child.stdin.end = () => {};
  child.kill = () => false;
  const owner = createProcessOwner(() => child, {
    executionMs: 5,
    gracefulMs: 5,
    forceMs: 5,
    drainMs: 5,
  });
  const command = () =>
    owner.command('fake-only', [], {
      stage: diagnostics.stage,
      report: (details) => diagnostics.capture(diagnostics.stage, details),
    });
  return { files, printed, diagnostics, child, owner, command };
}
function assertSafe(f) {
  const all = [...f.files.values(), ...f.printed].join('\n');
  for (const secret of [
    password,
    url,
    're_fakeProviderKey',
    'fakeBearerToken',
    'fakeAssignedToken',
  ])
    assert.equal(all.includes(secret), false, `Secret leaked: ${secret}`);
}

test('exit code 1 retains separate stdout/stderr, stage and sanitized failure after cleanup', async () => {
  const f = fixture();
  await f.diagnostics.attach('fake-artifacts');
  f.diagnostics.setStage('integration-test');
  f.child.stdin.end = () => {
    f.child.stdout.emit('data', 'not ok 1 - schema validation\n');
    f.child.stderr.emit('data', `AssertionError: expected int; ${url}\n`);
    f.child.emit('exit', 1, null);
    f.child.emit('close', 1);
  };
  await assert.rejects(
    runWithRunnerDiagnostics(f.diagnostics, f.command),
    (error) => {
      assert.equal(error.stage, 'integration-test');
      assert.equal(error.exitCode, 1);
      assert.match(error.message, /AssertionError: expected int/);
      assert.equal(error.message.includes(password), false);
      return true;
    },
  );
  assert.equal((await f.owner.cleanup()).stopped, true);
  f.owner.dispose();
  const report = JSON.parse(f.files.get(f.diagnostics.paths.diagnostics));
  assert.equal(report.failure.stage, 'integration-test');
  assert.equal(report.failure.exitCode, 1);
  assert.match(report.commands[0].stdout, /not ok 1/);
  assert.match(report.commands[0].stderr, /AssertionError/);
  assert.match(f.files.get(f.diagnostics.paths.integration), /exitCode=1/);
  assert.match(f.files.get(f.diagnostics.paths.integration), /not ok 1/);
  assertSafe(f);
});

test('exceptions retain useful sanitized messages without serializing stack, cause or environment', async () => {
  const f = fixture();
  f.diagnostics.setStage('migration-snapshot');
  await assert.rejects(
    runWithRunnerDiagnostics(f.diagnostics, async () => {
      throw Object.assign(
        new Error(
          `EACCES copying schema: password="${password}" token=fakeAssignedToken`,
        ),
        {
          cause: { token: 'unserialized-cause' },
          env: { key: 'unserialized-env' },
        },
      );
    }),
    /EACCES copying schema/,
  );
  assert.equal(f.diagnostics.report.failure.stage, 'migration-snapshot');
  assert.equal(f.printed.join('').includes('unserialized'), false);
  assertSafe(f);
  f.owner.dispose();
});

test('spawn errors propagate through diagnostic reporting with no raw path credentials', async () => {
  const f = fixture();
  await f.diagnostics.attach('fake-artifacts');
  f.diagnostics.setStage('mysql-initialize');
  f.child.pid = undefined;
  f.child.stdin.end = () => {
    f.child.emit(
      'error',
      Object.assign(new Error(`spawn ENOENT ${url}`), {
        syscall: 'spawn fake',
      }),
    );
    f.child.emit('close', -1);
  };
  await assert.rejects(
    runWithRunnerDiagnostics(f.diagnostics, f.command),
    /spawn ENOENT/,
  );
  assert.equal(f.diagnostics.report.commands[0].spawnFailed, true);
  assert.match(f.files.get(f.diagnostics.paths.integration), /not started/);
  assertSafe(f);
  f.owner.dispose();
});

test('partial output survives missing close and uncertain termination', async () => {
  for (const exited of [true, false]) {
    const f = fixture();
    await f.diagnostics.attach('fake-artifacts');
    f.diagnostics.setStage('integration-test');
    f.child.stdin.end = () => {
      f.child.stdout.emit('data', `partial ${password.slice(0, 8)}`);
      f.child.stdout.emit('data', password.slice(8));
      if (exited) f.child.emit('exit', 1, null);
    };
    await assert.rejects(
      runWithRunnerDiagnostics(f.diagnostics, f.command),
      exited ? /OUTPUT_CLOSE_TIMEOUT/ : /ISOLATED_PROCESS_STATE_UNCERTAIN/,
    );
    assert.match(
      f.files.get(f.diagnostics.paths.integration),
      /partial \[redacted\]/,
    );
    assert.equal(f.diagnostics.report.commands[0].stopped, exited);
    assert.equal((await f.owner.cleanup()).stopped, exited);
    assertSafe(f);
    f.owner.dispose();
  }
});

test('diagnostic write failure does not replace the original child failure or bypass cleanup', async () => {
  const f = fixture();
  f.child.stdin.end = () => {
    f.child.emit('exit', 1, null);
    f.child.emit('close', 1);
  };
  await assert.rejects(
    f.owner.command('fake', [], {
      stage: 'integration-test',
      report: async () => {
        throw new Error('fake disk full');
      },
    }),
    (error) => {
      assert.equal(error.exitCode, 1);
      assert.equal(error.diagnosticFailure.message, 'fake disk full');
      assert.match(error.message, /exit code 1/);
      return true;
    },
  );
  assert.equal((await f.owner.cleanup()).stopped, true);
  f.owner.dispose();
});

test('cleanup failure is secondary and cannot overwrite the original stage', async () => {
  const f = fixture();
  await f.diagnostics.attach('fake-artifacts');
  await f.diagnostics.fail(
    Object.assign(new Error('schema validation failed'), {
      stage: 'integration-test',
      exitCode: 1,
    }),
  );
  f.diagnostics.setStage('cleanup');
  await f.diagnostics.fail(new Error(`write manifest failed: ${url}`), true);
  const report = JSON.parse(f.files.get(f.diagnostics.paths.diagnostics));
  assert.equal(report.failure.stage, 'integration-test');
  assert.equal(report.cleanupFailures[0].stage, 'cleanup');
  assertSafe(f);
  f.owner.dispose();
});

test('redaction covers database URLs, encoded credentials, SQL, JSON secrets, bearer, JWT and provider keys', () => {
  const secret = 'fake p@ss/word';
  const input =
    `${secret} ${encodeURIComponent(secret)} mysql://user:unknown@localhost/db\n` +
    'IDENTIFIED BY \'unknown-password\'; {"api_key":"unknown-key", "token":"fakeAssignedToken"}\n' +
    'Authorization: Bearer fakeBearerToken\nre_fakeProviderKey eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.signature';
  const safe = redactEmailMysqlOutput(input, [secret, '']);
  for (const value of [
    secret,
    encodeURIComponent(secret),
    'mysql://',
    'unknown-password',
    'unknown-key',
    'fakeAssignedToken',
    'fakeBearerToken',
    're_fakeProviderKey',
    'eyJhbGci',
  ])
    assert.equal(safe.includes(value), false, value);
  assert.match(
    redactEmailMysqlOutput('AssertionError: expected 4 migrations, actual 3'),
    /expected 4 migrations, actual 3/,
  );
});

test('stalled diagnostic writes are bounded and cannot prevent failure reporting from returning', async () => {
  const printed = [];
  const diagnostics = createRunnerDiagnostics({
    writeFile: () => new Promise(() => {}),
    writeMs: 5,
    print: (text) => printed.push(text),
  });
  await assert.rejects(
    diagnostics.attach('fake-artifacts'),
    /DIAGNOSTIC_WRITE_TIMEOUT/,
  );
  diagnostics.setStage('integration-test');
  await diagnostics.fail(new Error('original validation failure'));
  assert.equal(
    diagnostics.report.failure.message,
    'original validation failure',
  );
  assert.ok(printed.some((line) => line.includes('DIAGNOSTIC_WRITE_TIMEOUT')));
});
