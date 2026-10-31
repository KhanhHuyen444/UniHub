import {
  createRunnerDiagnostics,
  runWithRunnerDiagnostics,
} from './helpers/event-reminder-email-mysql-diagnostics.mjs';
export { redactEmailMysqlOutput } from './helpers/event-reminder-email-mysql-diagnostics.mjs';
import {
  createProcessOwner,
  startOnReservedPort,
  deadline,
} from './helpers/event-reminder-email-mysql-process.mjs';
import {
  REVIEWED_MIGRATIONS,
  readReviewedMigrations,
  createMigrationSnapshot,
  validateMigrationSnapshot,
} from './helpers/event-reminder-email-mysql-migrations.mjs';
// Preparation only until explicitly invoked with --run-isolated AND both guards.
// Uses native Windows MySQL binaries, never Docker/services/.env/development URLs.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  writeFile,
  readdir,
  mkdir,
  stat,
  chmod,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import {
  assertSafeRunnerEnvironment,
  REQUIRED_BACKEND_EXPORTS,
  validateBackendEntryPoints,
  assertRunnerVersions,
  assertRunnerPrerequisites,
  guardMysqlSession,
  initializeEmailMysqlLayout,
} from './helpers/event-reminder-email-mysql-lifecycle.mjs';
import {
  EMAIL_MYSQL_OWNER,
  EMAIL_MYSQL_OPT_IN,
  datadirHash,
} from './helpers/event-reminder-email-mysql-guard.mjs';

export function isolatedEmailMysqlChildEnvironment(parent) {
  const result = {};
  for (const key of [
    'SystemRoot',
    'WINDIR',
    'TEMP',
    'TMP',
    'PATH',
    'Path',
    'PATHEXT',
    'COMSPEC',
    'USERPROFILE',
    'LOCALAPPDATA',
    'APPDATA',
    'ProgramFiles',
    'ProgramFiles(x86)',
    'ALLUSERSPROFILE',
  ]) {
    if (parent[key] !== undefined) result[key] = parent[key];
  }
  return { ...result, NODE_ENV: 'test', EVENT_REMINDER_EMAIL_ENABLED: 'false' };
}
async function runIsolated(diagnostics) {
  if (
    process.platform !== 'win32' ||
    process.env.NODE_ENV !== 'test' ||
    process.env.UNIHUB_EMAIL_MYSQL_TEST !== EMAIL_MYSQL_OPT_IN
  ) {
    throw new Error(
      'Windows, NODE_ENV=test and UNIHUB_EMAIL_MYSQL_TEST=disposable-mysql84 are required.',
    );
  }
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major !== 24 || minor < 19)
    throw new Error(
      'Repository prerequisite: Node 24.19.0 or later in major 24.',
    );
  assertSafeRunnerEnvironment(process.env);
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const bin = resolve(
    process.env.TV4_MYSQL_BIN ?? 'C:/Program Files/MySQL/MySQL Server 8.4/bin',
  );
  const env = isolatedEmailMysqlChildEnvironment(process.env);
  const secrets = Array.from({ length: 3 }, () =>
    randomBytes(32).toString('hex'),
  );
  diagnostics.addSecrets(secrets);
  const [rootPassword, runtimePassword, deniedPassword] = secrets;
  const engine = join(
    root,
    'node_modules/@prisma/engines/schema-engine-windows.exe',
  );
  const npmCli = join(
    dirname(process.execPath),
    'node_modules/npm/bin/npm-cli.js',
  );
  diagnostics.setStage('preflight-files');
  await assertRunnerPrerequisites({ stat }, [
    join(bin, 'mysqld.exe'),
    join(bin, 'mysql.exe'),
    engine,
    npmCli,
    join(root, 'node_modules/prisma/build/index.js'),
    ...Object.keys(REQUIRED_BACKEND_EXPORTS).map((file) =>
      join(root, 'backend/dist', file),
    ),
    join(root, 'backend/test/event-reminder-email-mysql.test.mjs'),
    join(root, 'node_modules/prisma/config.js'),
  ]);
  let interrupted = false,
    layout,
    reservation,
    expected;
  const owner = createProcessOwner(spawn);
  const onSignal = () => {
    interrupted = true;
    process.exitCode = 1;
    owner.signal();
  };
  let server,
    serverRecord,
    verified = false,
    passwordSet = false,
    primaryFailure;
  async function command(
    executable,
    args,
    {
      input,
      extraEnv = {},
      show = false,
      identity,
      stage = diagnostics.stage,
    } = {},
  ) {
    if (interrupted && !identity?.shutdown)
      return Promise.reject(new Error('Interrupted.'));
    try {
      return await owner.command(executable, args, {
        stage,
        report: async (details) => {
          await diagnostics.capture(stage, details);
          if (show)
            process.stdout.write(
              diagnostics.sanitize(details.stdout + details.stderr),
            );
        },
        options: {
          cwd: root,
          env: { ...env, ...extraEnv },
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
        input,
        timeoutMs: identity ? (identity.shutdown ? 4000 : 3000) : 120000,
        setup: identity
          ? (child) =>
              guardMysqlSession(
                child,
                identity,
                () =>
                  serverRecord &&
                  !serverRecord.exited &&
                  !serverRecord.spawnFailed,
                input,
              )
          : undefined,
      });
    } catch (error) {
      if (error.diagnosticFailure)
        await diagnostics.fail(
          diagnostics.contextualize(
            error.diagnosticFailure,
            'diagnostic-write',
          ),
          true,
        );
      throw diagnostics.contextualize(error, stage);
    }
  }
  const connectionArgs = () => [
    '--no-defaults',
    '--no-login-paths',
    '--protocol=TCP',
    '--host=127.0.0.1',
    `--port=${expected.port}`,
    '--user=root',
    '--connect-timeout=2',
    '--skip-reconnect',
  ];
  const mysql = (sql, stage = diagnostics.stage) =>
    command(
      join(bin, 'mysql.exe'),
      [
        ...connectionArgs(),
        '--unbuffered',
        '--batch',
        '--raw',
        '--skip-column-names',
      ],
      {
        input: sql,
        stage,
        identity: expected,
        extraEnv: passwordSet ? { MYSQL_PWD: rootPassword } : {},
      },
    );
  const migrationHashes = REVIEWED_MIGRATIONS;
  const migrationRoot = join(root, 'backend/prisma/migrations');
  const snapshotFs = { readFile, readdir, mkdir, writeFile, chmod };
  diagnostics.setStage('preflight-migrations');
  await readReviewedMigrations(snapshotFs, migrationRoot);
  const schema = await readFile(join(root, 'backend/prisma/schema.prisma'));
  // Import only pure entry points; never server.ts, schedulers or client factories.
  diagnostics.setStage('preflight-backend');
  await validateBackendEntryPoints(
    (file) => import(pathToFileURL(join(root, 'backend/dist', file)).href),
  );
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  try {
    diagnostics.setStage('version-check');
    assertRunnerVersions(
      process.versions.node,
      await command(process.execPath, [npmCli, '--version']),
    );
    diagnostics.setStage('mysql-initialize');
    layout = await initializeEmailMysqlLayout(
      { mkdtemp, mkdir, writeFile },
      tmpdir(),
      async (datadir) => {
        await diagnostics.attach(layout.artifacts);
        Object.assign(layout.manifest, {
          diagnostics: diagnostics.paths.diagnostics,
          integrationReport: diagnostics.paths.integration,
        });
        await writeFile(
          layout.manifestPath,
          JSON.stringify(layout.manifest, null, 2),
        );
        await command(join(bin, 'mysqld.exe'), [
          '--no-defaults',
          '--initialize-insecure',
          `--basedir=${resolve(bin, '..')}`,
          `--datadir=${datadir}`,
          '--console',
        ]);
      },
      (value) => {
        layout = value;
      },
    );
    const { datadir, manifest, manifestPath } = layout;
    diagnostics.setStage('migration-snapshot');
    const snapshot = join(layout.artifacts, 'migrations');
    await createMigrationSnapshot(snapshotFs, migrationRoot, snapshot, schema);
    const privateConfig = join(layout.artifacts, 'prisma.config.mjs');
    await writeFile(
      privateConfig,
      `import { defineConfig } from ${JSON.stringify(pathToFileURL(join(root, 'node_modules/prisma/config.js')).href)};\nexport default defineConfig({ schema: './schema.prisma', migrations: { path: './migrations' }, datasource: { url: process.env.MIGRATION_DATABASE_URL } });\n`,
      { flag: 'wx', mode: 0o400 },
    );
    await chmod(privateConfig, 0o400);
    diagnostics.setStage('mysql-startup');
    reservation = createServer();
    let reservationError;
    try {
      await deadline(
        () =>
          new Promise((accept, reject) => {
            reservationError = reject;
            reservation.once('error', reservationError);
            reservation.listen(0, '127.0.0.1', accept);
          }),
        5000,
        'PORT_RESERVATION_TIMEOUT',
      );
    } finally {
      reservation.removeListener('error', reservationError);
    }
    const port = reservation.address().port;
    if (port < 1024 || port === 3306) throw new Error('Unsafe allocated port.');
    const auto = await readFile(join(datadir, 'auto.cnf'), 'utf8');
    const uuid = /server-uuid=([a-f0-9-]{36})/i.exec(auto)?.[1];
    if (!uuid) throw new Error('Missing fresh-instance identity.');
    expected = { port, datadir, uuid };
    Object.assign(manifest, {
      port,
      uuid,
      datadir_sha256: datadirHash(datadir),
    });
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    // Native mysqld cannot inherit Node's listener. Release immediately before spawn.
    serverRecord = await startOnReservedPort(
      reservation,
      () =>
        owner.track(
          spawn(
            join(bin, 'mysqld.exe'),
            [
              '--no-defaults',
              `--basedir=${resolve(bin, '..')}`,
              `--datadir=${datadir}`,
              '--bind-address=127.0.0.1',
              `--port=${port}`,
              '--mysqlx=0',
              '--skip-log-bin',
              '--performance-schema=ON',
              '--general-log=OFF',
              `--log-error=${join(datadir, 'server.log')}`,
              '--console',
            ],
            {
              cwd: datadir,
              env,
              windowsHide: true,
              stdio: ['ignore', 'ignore', 'ignore'],
            },
          ),
        ),
      () => interrupted,
    );
    server = serverRecord.child;
    // Process owner handles spawn errors and retains the server through cleanup.
    manifest.pid = server.pid ?? null;
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    diagnostics.setStage('mysql-readiness');
    for (let attempt = 0; attempt < 80; attempt++) {
      if (serverRecord.spawnFailed || serverRecord.exited) break;
      try {
        await mysql('');
        verified = true;
        break;
      } catch (error) {
        if (
          interrupted ||
          error.message === 'EMAIL_MYSQL_IDENTITY_MISMATCH' ||
          error.message === 'ISOLATED_PROCESS_STATE_UNCERTAIN'
        )
          throw error;
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    if (!verified)
      throw Object.assign(
        new Error(
          serverRecord.errorCause?.message ??
            `Fresh MySQL 8.4 identity could not be verified; server exit code=${serverRecord.exitCode}. No bootstrap SQL was sent. Inspect data/server.log.`,
        ),
        {
          stage: 'mysql-readiness',
          exitCode: serverRecord.exitCode,
          signal: serverRecord.signal,
        },
      );
    await validateMigrationSnapshot(snapshotFs, migrationRoot, snapshot);
    diagnostics.setStage('root-password');
    await mysql(
      `ALTER USER 'root'@'localhost' IDENTIFIED BY '${rootPassword}';`,
    );
    passwordSet = true;
    const nonce = randomBytes(8).toString('hex');
    const database = `unihub_email_test_${nonce}`;
    const runtimeUser = `uh_email_${nonce.slice(0, 8)}`;
    const deniedUser = `uh_noemail_${nonce.slice(0, 8)}`;
    diagnostics.setStage('database-create');
    await mysql(
      `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;`,
    );
    const url = (user, password) =>
      `mysql://${user}:${password}@127.0.0.1:${port}/${database}`;
    diagnostics.setStage('migration-deploy');
    await mysql(''); // Verify immediately before the separate migration connection.
    await validateMigrationSnapshot(snapshotFs, migrationRoot, snapshot);
    await command(
      process.execPath,
      [
        join(root, 'node_modules/prisma/build/index.js'),
        'migrate',
        'deploy',
        '--config',
        privateConfig,
      ],
      {
        extraEnv: {
          MIGRATION_DATABASE_URL: url('root', rootPassword),
          PRISMA_SCHEMA_ENGINE_BINARY: engine,
        },
      },
    );
    diagnostics.setStage('runtime-grants');
    await mysql('');
    for (const [user, password] of [
      [runtimeUser, runtimePassword],
      [deniedUser, deniedPassword],
    ]) {
      await mysql(`
        CREATE USER '${user}'@'localhost' IDENTIFIED BY '${password}';
        GRANT SELECT ON \`${database}\`.users TO '${user}'@'localhost';
        GRANT SELECT, INSERT, UPDATE, DELETE ON \`${database}\`.events TO '${user}'@'localhost';
        GRANT SELECT, INSERT, UPDATE, DELETE ON \`${database}\`.notifications TO '${user}'@'localhost';
        GRANT SELECT, INSERT ON \`${database}\`.activity_logs TO '${user}'@'localhost';
      `);
    }
    await mysql(
      `GRANT SELECT, INSERT, UPDATE ON \`${database}\`.event_reminder_emails TO '${runtimeUser}'@'localhost';`,
    );
    await validateMigrationSnapshot(snapshotFs, migrationRoot, snapshot);
    const identity = {
      owner: EMAIL_MYSQL_OWNER,
      nonce,
      database,
      port,
      uuid,
      datadir_sha256: datadirHash(datadir),
      migrationHashes,
    };
    Object.assign(manifest, identity, { pid: server.pid });
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.info(
      'Verified fresh disposable MySQL 8.4; running synthetic fake-mail integration tests.',
    );
    diagnostics.setStage('integration-test');
    await command(
      process.execPath,
      ['--test', 'backend/test/event-reminder-email-mysql.test.mjs'],
      {
        show: true,
        extraEnv: {
          UNIHUB_EMAIL_MYSQL_TEST: EMAIL_MYSQL_OPT_IN,
          TEST_EVENT_REMINDER_EMAIL_DATABASE_URL: url(
            runtimeUser,
            runtimePassword,
          ),
          TEST_EVENT_REMINDER_EMAIL_DENIED_URL: url(deniedUser, deniedPassword),
          TEST_EVENT_REMINDER_EMAIL_ADMIN_URL: url('root', rootPassword),
          TEST_EVENT_REMINDER_EMAIL_MYSQL_IDENTITY: JSON.stringify(identity),
        },
      },
    );
  } catch (error) {
    primaryFailure = diagnostics.contextualize(error);
    await diagnostics.fail(primaryFailure);
    throw primaryFailure;
  } finally {
    diagnostics.setStage('cleanup');
    try {
      if (reservation?.listening) {
        try {
          await startOnReservedPort(
            reservation,
            () => {},
            () => false,
          );
        } catch (error) {
          await diagnostics.fail(
            diagnostics.contextualize(error, 'port-release'),
            true,
          );
          process.exitCode = 1;
        }
      }
      const cleanup = await owner.cleanup(serverRecord, async () => {
        if (!verified || !expected) throw new Error('Unverified.');
        const saved = expected;
        expected = { ...saved, shutdown: true };
        try {
          await mysql('SHUTDOWN;', 'mysql-shutdown');
        } finally {
          expected = saved;
        }
      });
      const { stopped } = cleanup;
      if (!stopped)
        await diagnostics.fail(
          diagnostics.contextualize(
            new Error(
              'Owned process termination remains uncertain; artifacts must be preserved.',
            ),
          ),
          Boolean(primaryFailure),
        );
      if (layout) {
        Object.assign(layout.manifest, { ...cleanup, interrupted });
        await writeFile(
          layout.manifestPath,
          JSON.stringify(layout.manifest, null, 2),
        );
        console.info(
          `Disposable instance stopped=${stopped}. Cleanup manifest: ${layout.manifestPath}`,
        );
      }
    } catch (error) {
      const cleanupFailure = diagnostics.contextualize(error);
      await diagnostics.fail(cleanupFailure, true);
      process.exitCode = 1;
      if (!primaryFailure) throw cleanupFailure;
    } finally {
      owner.dispose();
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
    }
    if (layout?.manifest.stopped !== true) process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (!process.argv.includes('--run-isolated'))
    console.info(
      'Email MySQL runner inactive; explicit --run-isolated required.',
    );
  else {
    try {
      const diagnostics = createRunnerDiagnostics({ writeFile });
      await runWithRunnerDiagnostics(diagnostics, () =>
        runIsolated(diagnostics),
      );
    } catch {
      // runWithRunnerDiagnostics already printed a sanitized stage and message.
      process.exitCode = 1;
    }
  }
}
