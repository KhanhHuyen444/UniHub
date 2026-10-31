// Windows isolated runner. Never loads .env or uses DATABASE_URL.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { createServer } from 'node:net';

// Node --test may discover helper .mjs files under test/. Never provision a
// server unless the operator invokes this runner with its explicit flag.
if (!process.argv.includes('--run-isolated')) {
  console.log('Isolated dashboard runner inactive (requires --run-isolated).');
} else {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const bin =
    process.env.TV4_MYSQL_BIN ??
    'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin';
  const env = { ...process.env };
  delete env.MYSQL_PWD;
  for (const k of Object.keys(env))
    if (
      k === 'DATABASE_URL' ||
      k === 'MIGRATION_DATABASE_URL' ||
      k.startsWith('TEST_')
    )
      delete env[k];
  const datadir = await mkdtemp(join(tmpdir(), 'unihub-dashboard-mysql-'));
  const port = await new Promise((resolvePort, reject) => {
    const s = createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolvePort(p));
    });
  });
  const password = randomBytes(24).toString('hex');
  let server,
    verified = false,
    passwordSet = false;
  function command(exe, args, { input, extraEnv = {}, echo = false } = {}) {
    return new Promise((resolveRun, reject) => {
      const p = spawn(exe, args, {
        cwd: root,
        env: { ...env, ...extraEnv },
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let stdout = '',
        stderr = '';
      p.stdout.on('data', (x) => {
        stdout += x;
        if (echo) process.stdout.write(x);
      });
      p.stderr.on('data', (x) => {
        stderr += x;
        if (echo) process.stderr.write(x);
      });
      p.on('error', () =>
        reject(new Error('Isolated process could not start.')),
      );
      p.on('close', (code) =>
        code === 0
          ? resolveRun({ stdout, stderr })
          : reject(new Error('Isolated process failed (exit ' + code + ').')),
      );
      p.stdin.end(input);
    });
  }
  const mysqlArgs = [
    '--no-defaults',
    '--protocol=TCP',
    '--host=127.0.0.1',
    `--port=${port}`,
    '--user=root',
    '--connect-timeout=2',
    '--batch',
    '--raw',
    '--skip-column-names',
  ];
  const mysql = (sql) =>
    command(join(bin, 'mysql.exe'), mysqlArgs, {
      input: sql,
      extraEnv: passwordSet ? { MYSQL_PWD: password } : {},
    });
  try {
    console.log(
      'Initializing dedicated temporary MySQL instance (no personal config).',
    );
    await command(join(bin, 'mysqld.exe'), [
      '--no-defaults',
      '--initialize-insecure',
      `--basedir=${resolve(bin, '..')}`,
      `--datadir=${datadir}`,
      '--console',
    ]);
    server = spawn(
      join(bin, 'mysqld.exe'),
      [
        '--no-defaults',
        `--basedir=${resolve(bin, '..')}`,
        `--datadir=${datadir}`,
        '--bind-address=127.0.0.1',
        `--port=${port}`,
        '--mysqlx=0',
        '--skip-log-bin',
        '--console',
        `--log-error=${join(datadir, 'server.log')}`,
      ],
      {
        windowsHide: true,
        cwd: datadir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
      },
    );
    let startupOutput = '';
    server.stdout.on('data', (x) => {
      startupOutput += x;
    });
    server.stderr.on('data', (x) => {
      startupOutput += x;
    });
    let identity;
    for (let i = 0; i < 80; i++) {
      if (server.exitCode !== null)
        throw new Error('Isolated mysqld exited: ' + startupOutput);
      try {
        identity = (
          await mysql('SELECT @@port, @@datadir, @@server_uuid, VERSION();')
        ).stdout
          .trim()
          .split('\t');
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    if (
      !identity ||
      Number(identity[0]) !== port ||
      normalize(resolve(identity[1])).toLowerCase() !==
        normalize(resolve(datadir)).toLowerCase() ||
      !/^8\.4\./.test(identity[3])
    )
      throw new Error('Isolated server identity check failed.');
    verified = true;
    // Bootstrap password on this brand-new root only. No GRANT/REVOKE changes.
    await mysql(`ALTER USER 'root'@'localhost' IDENTIFIED BY '${password}';`);
    passwordSet = true;
    const nonce = randomBytes(8).toString('hex');
    const schema = 'unihub_dashboard_test_' + nonce;
    await mysql(
      'CREATE DATABASE ' +
        schema +
        ' CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;',
    );
    const url =
      'mysql://root:' + password + '@127.0.0.1:' + port + '/' + schema;
    await command(
      process.execPath,
      [
        join(root, 'node_modules/prisma/build/index.js'),
        'migrate',
        'deploy',
        '--config',
        'backend/prisma.config.ts',
      ],
      { extraEnv: { MIGRATION_DATABASE_URL: url } },
    );
    console.log(
      'Verified fresh isolated MySQL ' +
        identity[3] +
        ' with existing migrations.',
    );
    await command(
      process.execPath,
      ['--test', 'backend/test/dashboard-mysql.test.mjs'],
      {
        extraEnv: {
          TEST_DASHBOARD_DATABASE_URL: url,
          TEST_DASHBOARD_MYSQL_IDENTITY: JSON.stringify({
            port,
            datadir,
            uuid: identity[2],
          }),
        },
        echo: true,
      },
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    if (server) {
      if (verified) {
        try {
          await command(
            join(bin, 'mysqladmin.exe'),
            [
              ...mysqlArgs.filter(
                (a) => !['--batch', '--raw', '--skip-column-names'].includes(a),
              ),
              'shutdown',
            ],
            { extraEnv: passwordSet ? { MYSQL_PWD: password } : {} },
          );
        } catch {
          server.kill();
        }
      } else server.kill();
      console.log(
        'Dedicated MySQL instance stopped; no personal/group database used. Temporary files retained outside Git.',
      );
    }
  }
}
