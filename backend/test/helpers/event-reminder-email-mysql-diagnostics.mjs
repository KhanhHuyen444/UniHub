import { deadline } from './event-reminder-email-mysql-process.mjs';
import { join } from 'node:path';

// Redact complete captured text, not individual chunks (secrets can span chunks).
// Never serialize environment objects, command arguments, input SQL or raw Errors.
export function redactEmailMysqlOutput(value, secrets = []) {
  let text = String(value ?? '');
  for (const secret of secrets
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)) {
    for (const representation of new Set([secret, encodeURIComponent(secret)]))
      text = text.replaceAll(representation, '[redacted]');
  }
  return text
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(
      /(?:mysql|mariadb|postgres(?:ql)?):\/\/[^\s<>"'`]+/gi,
      '[redacted database URL]',
    )
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[redacted]@')
    .replace(/\bBearer\s+[^\s"'`,;]+/gi, 'Bearer [redacted]')
    .replace(
      /\b(?:eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|re_[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]+)\b/g,
      '[redacted token]',
    )
    .replace(
      /((?:["']?[\w.-]*(?:password|passwd|pwd|token|api[_-]?key|secret|authorization)[\w.-]*["']?)\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)/gi,
      '$1[redacted]',
    )
    .replace(/(IDENTIFIED\s+BY\s+)(?:'[^']*'|"[^"]*"|\S+)/gi, '$1[redacted]')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
}

export function createRunnerDiagnostics({
  writeFile,
  print = console.error,
  writeMs = 5000,
}) {
  const write = (...args) =>
    deadline(() => writeFile(...args), writeMs, 'DIAGNOSTIC_WRITE_TIMEOUT');
  const secrets = [];
  const report = {
    version: 1,
    commands: [],
    failure: null,
    cleanupFailures: [],
  };
  let stage = 'preflight',
    paths;
  const sanitize = (value) => redactEmailMysqlOutput(value, secrets);
  function describe(error, at = error?.stage ?? stage) {
    return {
      stage: sanitize(at),
      message: sanitize(error?.message ?? 'Unknown runner error.').slice(
        0,
        4000,
      ),
      ...((error?.commandFailure?.message ?? error?.originalMessage)
        ? {
            originalMessage: sanitize(
              error.commandFailure?.message ?? error.originalMessage,
            ).slice(0, 4000),
          }
        : {}),
      ...(Number.isInteger(error?.exitCode)
        ? { exitCode: error.exitCode }
        : {}),
      ...(error?.signal ? { signal: sanitize(error.signal) } : {}),
    };
  }
  async function persist() {
    if (!paths) return;
    await write(paths.diagnostics, JSON.stringify(report, null, 2) + '\n', {
      mode: 0o600,
    });
  }
  return {
    report,
    get paths() {
      return paths;
    },
    get stage() {
      return stage;
    },
    setStage(value) {
      stage = value;
    },
    addSecrets(values) {
      secrets.push(...values.filter(Boolean));
    },
    sanitize,
    async attach(artifacts) {
      paths = {
        diagnostics: join(artifacts, 'harness-diagnostics.json'),
        integration: join(artifacts, 'integration-test-output.log'),
      };
      await write(
        paths.integration,
        'Integration test not started. See harness-diagnostics.json for the failure stage.\n',
        { flag: 'wx', mode: 0o600 },
      );
      await persist();
    },
    async capture(at, details) {
      const entry = {
        stage: at,
        exitCode: details.exitCode,
        signal: details.signal ? sanitize(details.signal) : null,
        exited: details.exited,
        spawnFailed: details.spawnFailed,
        closed: details.closed,
        stopped: details.stopped,
        overflow: details.overflow,
        error: details.failure ? describe(details.failure, at).message : null,
        originalError: details.failure
          ? (describe(details.failure, at).originalMessage ?? null)
          : null,
        stdout: sanitize(details.stdout),
        stderr: sanitize(details.stderr),
      };
      report.commands.push(entry);
      // Retain output even for exit 1, timeout, missing close or uncertain stop.
      if (at === 'integration-test' && paths) {
        await write(
          paths.integration,
          `stage=${at} exitCode=${entry.exitCode} signal=${entry.signal} stopped=${entry.stopped}\n` +
            `--- stdout ---\n${entry.stdout}\n--- stderr ---\n${entry.stderr}\n` +
            `--- failure ---\n${entry.error ?? 'none'}\n`,
          { mode: 0o600 },
        );
        print(`Integration output: ${paths.integration}`);
      }
      await persist();
    },
    contextualize(error, at = stage) {
      const safe = describe(error, error?.stage ?? at);
      return Object.assign(new Error(safe.message), safe);
    },
    async fail(error, cleanup = false) {
      if (!cleanup && report.failure) return;
      const failure = describe(error);
      if (cleanup) report.cleanupFailures.push(failure);
      else if (!report.failure) report.failure = failure;
      print(
        `${cleanup ? 'Cleanup failure' : 'Runner failure'} [${failure.stage}]: ${failure.message}${failure.exitCode !== undefined ? ` (exit code ${failure.exitCode})` : ''}`,
      );
      try {
        await persist();
      } catch (writeError) {
        print(
          `Diagnostic write failed: ${describe(writeError, 'diagnostic-write').message}`,
        );
      }
      if (failure.originalMessage)
        print(
          `Original command error [${failure.stage}]: ${failure.originalMessage}`,
        );
      if (paths) print(`Diagnostics: ${paths.diagnostics}`);
    },
    persist,
  };
}

export async function runWithRunnerDiagnostics(diagnostics, operation) {
  try {
    return await operation();
  } catch (error) {
    const safe = diagnostics.contextualize(error);
    await diagnostics.fail(safe);
    throw safe;
  }
}
