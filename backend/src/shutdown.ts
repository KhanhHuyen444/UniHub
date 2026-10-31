export const SHUTDOWN_TIMEOUT_MS = 30_000;

/** A hard deadline bounds shutdown without disconnecting a live transaction. */
export async function shutdownServer(dependencies: {
  stopScheduler: () => Promise<void>;
  closeHttp: () => Promise<void>;
  disconnectDatabase: () => Promise<void>;
  forceCloseHttp: () => void;
  forceExit: () => void;
  reportError: () => void;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
}): Promise<void> {
  let timedOut = false;
  const timer = (dependencies.setTimeout ?? globalThis.setTimeout)(() => {
    timedOut = true;
    dependencies.reportError();
    dependencies.forceCloseHttp();
    // Do not call Prisma.$disconnect on a live scheduler transaction. If the
    // grace period expires, terminate the process; MySQL settles/rolls back the
    // lost connection. Do not assume the outcome of an interrupted commit.
    dependencies.forceExit();
  }, SHUTDOWN_TIMEOUT_MS);
  try {
    // stopScheduler synchronously disables new work before its first await.
    const stopped = dependencies.stopScheduler();
    await Promise.all([stopped, dependencies.closeHttp()]);
    if (!timedOut) await dependencies.disconnectDatabase();
  } catch {
    dependencies.reportError();
    // Keep the deadline armed on failure; avoid disconnecting unfinished work.
    return;
  }
  (dependencies.clearTimeout ?? globalThis.clearTimeout)(timer);
}
