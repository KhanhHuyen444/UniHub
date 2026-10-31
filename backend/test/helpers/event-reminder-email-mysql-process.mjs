// Signal only owned ChildProcess handles, never numeric PIDs or process groups.
export async function deadline(operation, ms, label = 'PROCESS_TIMEOUT') {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function createProcessOwner(
  spawn,
  {
    executionMs = 120000,
    gracefulMs = 5000,
    forceMs = 5000,
    drainMs = 1000,
  } = {},
) {
  const records = new Set();
  let interrupted = false;
  function track(child, stage = 'server-start') {
    const record = {
      child,
      stage,
      exited: false,
      spawnFailed: false,
      closed: false,
      killFailed: false,
      error: false,
      exitCode: null,
    };
    records.add(record);
    let exitResolve, closeResolve;
    record.exit = new Promise((r) => {
      exitResolve = r;
    });
    record.close = new Promise((r) => {
      closeResolve = r;
    });
    const onError = (error) => {
      record.error = true;
      record.errorCause = error;
      if (/^kill/.test(error.syscall ?? '')) record.killFailed = true;
      if (
        child.pid === undefined &&
        !record.spawned &&
        /^spawn /.test(error.syscall ?? '')
      ) {
        record.spawnFailed = true;
        exitResolve();
      }
    };
    const onSpawn = () => {
      record.spawned = true;
    };
    const onExit = (code, signal) => {
      record.exited = true;
      record.exitCode = code;
      record.signal = signal;
      exitResolve();
    };
    const onClose = () => {
      record.closed = true;
      closeResolve();
    };
    child.on('error', onError);
    child.on('spawn', onSpawn);
    child.on('exit', onExit);
    child.on('close', onClose);
    record.dispose = () => {
      for (const stream of [child.stdin, child.stdout, child.stderr])
        stream?.destroy?.();
      child.unref?.();
      child.removeListener('error', onError);
      child.removeListener('spawn', onSpawn);
      child.removeListener('exit', onExit);
      child.removeListener('close', onClose);
    };
    return record;
  }
  const done = (r) => r.exited || r.spawnFailed;
  function kill(record) {
    if (done(record)) return;
    try {
      if (!record.child.kill('SIGKILL')) record.killFailed = true;
    } catch {
      record.killFailed = true;
    }
  }
  async function stop(record, graceful = async () => {}) {
    if (done(record)) return true;
    try {
      await deadline(graceful, gracefulMs, 'GRACEFUL_TIMEOUT');
    } catch {
      /* force below */
    }
    if (!done(record)) {
      try {
        await deadline(() => record.exit, gracefulMs);
      } catch {
        /* force below */
      }
    }
    if (!done(record)) {
      kill(record);
      try {
        await deadline(() => record.exit, forceMs, 'FORCE_TIMEOUT');
      } catch {
        /* uncertain */
      }
    }
    return done(record);
  }
  async function command(
    executable,
    args,
    {
      options,
      input,
      setup,
      show,
      report,
      stage = 'helper',
      timeoutMs = executionMs,
    } = {},
  ) {
    if (interrupted) throw new Error('Interrupted.');
    const record = track(spawn(executable, args, options), stage);
    const child = record.child;
    let output = '',
      stdout = '',
      stderr = '',
      overflow = false,
      failure;
    const collect = (stream) => (chunk) => {
      if (output.length + chunk.length > 8000000) {
        overflow = true;
        kill(record);
      } else {
        const text = chunk.toString();
        output += text;
        if (stream === 'stdout') stdout += text;
        else stderr += text;
      }
    };
    const collectOut = collect('stdout'),
      collectErr = collect('stderr');
    const ignoreInputError = () => {};
    const onOutputError = (error) => {
      record.error = true;
      record.errorCause = error;
    };
    child.stdout.setEncoding?.('utf8');
    child.stderr.setEncoding?.('utf8');
    child.stdout.on('error', onOutputError);
    child.stderr.on('error', onOutputError);
    child.stdout.on('data', collectOut);
    child.stderr.on('data', collectErr);
    child.stdin.on('error', ignoreInputError);
    let state = () => ({ released: true, refused: false });
    try {
      if (setup) state = setup(child);
      else child.stdin.end(input);
      await deadline(() => record.exit, timeoutMs, 'EXECUTION_TIMEOUT');
      await deadline(() => record.close, drainMs, 'OUTPUT_CLOSE_TIMEOUT');
      if (state().refused) throw new Error('EMAIL_MYSQL_IDENTITY_MISMATCH');
      if (
        record.spawnFailed ||
        record.error ||
        record.exitCode !== 0 ||
        overflow ||
        !state().released
      )
        throw new Error(
          record.errorCause?.message ??
            `ISOLATED_HELPER_FAILED (exit code ${record.exitCode}, signal ${record.signal ?? 'none'}): ${stderr || stdout || 'No child output.'}`,
        );
      show?.(output);
      return output;
    } catch (error) {
      failure = state().refused
        ? new Error('EMAIL_MYSQL_IDENTITY_MISMATCH')
        : error;
    } finally {
      const stopped = await stop(record);
      child.stdout.removeListener('data', collectOut);
      child.stderr.removeListener('data', collectErr);
      state.dispose?.();
      for (const stream of [child.stdin, child.stdout, child.stderr])
        stream?.destroy?.();
      child.stdin.removeListener('error', ignoreInputError);
      child.stdout.removeListener('error', onOutputError);
      child.stderr.removeListener('error', onOutputError);
      if (!stopped)
        failure = Object.assign(new Error('ISOLATED_PROCESS_STATE_UNCERTAIN'), {
          commandFailure: failure,
        });
      if (failure)
        Object.assign(failure, {
          stage,
          exitCode: record.exitCode,
          signal: record.signal ?? null,
        });
      try {
        if (report)
          await deadline(
            () =>
              report({
                stdout,
                stderr,
                failure,
                overflow,
                stopped,
                exitCode: record.exitCode,
                signal: record.signal ?? null,
                exited: record.exited,
                spawnFailed: record.spawnFailed,
                closed: record.closed,
              }),
            5000,
            'DIAGNOSTIC_WRITE_TIMEOUT',
          );
      } catch (error) {
        if (failure) failure.diagnosticFailure = error;
        else failure = Object.assign(error, { stage: 'diagnostic-write' });
      }
      if (failure) throw failure;
    }
  }
  return {
    records,
    track,
    command,
    stop,
    signal() {
      interrupted = true;
      for (const record of records) kill(record);
    },
    async cleanup(server, graceful) {
      for (const record of [...records])
        if (record !== server) await stop(record);
      if (server) await stop(server, graceful);
      return {
        stopped: [...records].every(done),
        processes: [...records].map(
          ({
            child,
            stage,
            exited,
            spawnFailed,
            closed,
            killFailed,
            error,
            exitCode,
            signal,
          }) => ({
            pid: child.pid ?? null,
            stage,
            exited,
            spawnFailed,
            closed,
            killFailed,
            error,
            exitCode,
            signal,
          }),
        ),
      };
    },
    dispose() {
      for (const record of records) record.dispose();
    },
  };
}

export async function startOnReservedPort(reservation, start, interrupted) {
  await deadline(
    () =>
      new Promise((resolve, reject) =>
        reservation.close((error) => (error ? reject(error) : resolve())),
      ),
    5000,
    'PORT_RELEASE_TIMEOUT',
  );
  if (interrupted()) throw new Error('Interrupted.');
  return start();
}
