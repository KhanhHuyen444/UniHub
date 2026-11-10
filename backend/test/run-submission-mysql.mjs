// Windows isolated runner. Never loads .env or uses DATABASE_URL.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';

// Node --test may discover helper .mjs files under test/. Never provision a
// server unless the operator invokes this runner with its explicit flag.
if (!process.argv.includes('--run-isolated')) {
  console.log('Isolated submission runner inactive (requires --run-isolated).');
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
  const datadir = await mkdtemp(join(tmpdir(), 'unihub-submission-mysql-'));
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
  function command(
    exe,
    args,
    { input, extraEnv = {}, echo = false, allowFailure = false } = {},
  ) {
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
        code === 0 || allowFailure
          ? resolveRun({ code, stdout, stderr })
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
    const schema = 'unihub_auth_test_submission_' + nonce;
    await mysql(
      'CREATE DATABASE ' +
        schema +
        ' CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;',
    );
    const migratorPassword = randomBytes(20).toString('hex') + '!@#';
    const runtimePassword = randomBytes(20).toString('hex') + '!@#';
    await mysql(`CREATE USER 'unihub_demo_migrator'@'127.0.0.1' IDENTIFIED BY '${migratorPassword}';
      CREATE USER 'unihub_demo_app'@'127.0.0.1' IDENTIFIED BY '${runtimePassword}';
      GRANT ALL PRIVILEGES ON ${schema}.* TO 'unihub_demo_migrator'@'127.0.0.1';`);
    const connectionUrl = (user, secret) =>
      'mysql://' +
      user +
      ':' +
      encodeURIComponent(secret) +
      '@127.0.0.1:' +
      port +
      '/' +
      schema;
    await command(
      process.execPath,
      [
        join(root, 'node_modules/prisma/build/index.js'),
        'migrate',
        'deploy',
        '--config',
        'backend/prisma.config.ts',
      ],
      {
        extraEnv: {
          MIGRATION_DATABASE_URL: connectionUrl(
            'unihub_demo_migrator',
            migratorPassword,
          ),
        },
      },
    );
    console.log(
      'Verified fresh isolated MySQL ' +
        identity[3] +
        ' with existing migrations.',
    );
    const readme = await readFile(join(root, 'README.md'), 'utf8');
    const grants = readme
      .split('\n')
      .filter((line) => /^GRANT SELECT.* ON unihub_demo\./.test(line));
    if (grants.length !== 13)
      throw new Error('Expected 13 per-table runtime grants in README.');
    await mysql(grants.join('\n').replaceAll('unihub_demo.', schema + '.'));
    const runtime = (sql) =>
      command(
        join(bin, 'mysql.exe'),
        mysqlArgs.map((arg) =>
          arg === '--user=root' ? '--user=unihub_demo_app' : arg,
        ),
        {
          input: sql,
          extraEnv: { MYSQL_PWD: runtimePassword },
          allowFailure: true,
        },
      );
    const rights = {
      users: ['SELECT', 'INSERT', 'UPDATE'],
      categories: ['SELECT', 'INSERT', 'UPDATE'],
      opportunities: ['SELECT', 'INSERT', 'UPDATE'],
      events: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      forum_posts: ['SELECT', 'INSERT', 'UPDATE'],
      comments: ['SELECT', 'INSERT', 'UPDATE'],
      activity_logs: ['SELECT', 'INSERT'],
      notifications: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      user_skills: ['SELECT', 'INSERT', 'DELETE'],
      opportunity_majors: ['SELECT', 'INSERT', 'DELETE'],
      opportunity_skills: ['SELECT', 'INSERT', 'DELETE'],
      opportunity_years: ['SELECT', 'INSERT', 'DELETE'],
      auth_sessions: ['SELECT', 'INSERT', 'UPDATE'],
    };
    let checks = 0;
    for (const [table, allowed] of Object.entries(rights)) {
      const column = (
        await mysql(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${schema}' AND TABLE_NAME='${table}' ORDER BY ORDINAL_POSITION LIMIT 1;`,
        )
      ).stdout.trim();
      const target = '`' + schema + '`.`' + table + '`';
      const operations = {
        SELECT: 'SELECT * FROM ' + target + ' WHERE 1=0;',
        INSERT:
          'INSERT INTO ' + target + ' SELECT * FROM ' + target + ' WHERE 1=0;',
        UPDATE:
          'UPDATE ' +
          target +
          ' SET `' +
          column +
          '`=`' +
          column +
          '` WHERE 1=0;',
        DELETE: 'DELETE FROM ' + target + ' WHERE 1=0;',
      };
      for (const [operation, sql] of Object.entries(operations)) {
        const result = await runtime(sql);
        if (
          allowed.includes(operation)
            ? result.code !== 0
            : result.code === 0 || !/ERROR (1142|1143|1044)/.test(result.stderr)
        )
          throw new Error(
            'Runtime privilege mismatch: ' + operation + ' ' + table,
          );
        checks++;
      }
    }
    for (const sql of [
      `SELECT * FROM ${schema}._prisma_migrations;`,
      `CREATE TABLE ${schema}.forbidden_table (id INT);`,
      `ALTER TABLE ${schema}.users ADD COLUMN forbidden_column INT;`,
    ]) {
      const result = await runtime(sql);
      if (result.code === 0 || !/ERROR (1142|1143|1044)/.test(result.stderr))
        throw new Error(
          'Runtime unexpectedly permitted setup/migration access.',
        );
      checks++;
    }
    console.log(
      'PASS: README runtime GRANT matrix (' +
        checks +
        ' allowed/denied SQL checks).',
    );
    await command(
      process.execPath,
      ['--test', 'backend/test/auth-refresh-mysql.test.mjs'],
      {
        extraEnv: {
          TEST_AUTH_DATABASE_URL: connectionUrl('root', password),
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
