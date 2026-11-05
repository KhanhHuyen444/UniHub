import { getPrismaClient } from '../../lib/prisma.js';
import {
  runDeadlineReminders,
  type ReminderClient,
  type ReminderScanState,
} from './reminders.service.js';

export const REMINDER_INTERVAL_MS = 60_000;

export function createReminderScheduler(
  dependencies: {
    getClient?: () => ReminderClient;
    now?: () => Date;
    reportError?: () => void;
    setInterval?: typeof globalThis.setInterval;
    clearInterval?: typeof globalThis.clearInterval;
  } = {},
) {
  const reportError =
    dependencies.reportError ??
    (() => console.error('Không thể xử lý nhắc hạn; sẽ thử lại ở chu kỳ sau.'));
  let timer: ReturnType<typeof setInterval> | undefined;
  let active: Promise<void> | undefined;
  let stopped = true;
  let closed = false;
  const scanState: ReminderScanState = {};

  function tick() {
    if (stopped || active) return;
    active = Promise.resolve()
      .then(() => {
        if (stopped) return;
        return runDeadlineReminders(
          (dependencies.getClient ?? getPrismaClient)(),
          {
            now: dependencies.now,
            shouldStop: () => stopped,
            onEventError: reportError,
            scanState,
          },
        );
      })
      .catch(reportError)
      .finally(() => {
        active = undefined;
      });
  }

  return {
    start() {
      if (closed || !stopped) return;
      stopped = false;
      timer = (dependencies.setInterval ?? globalThis.setInterval)(
        tick,
        REMINDER_INTERVAL_MS,
      );
      timer.unref();
      tick();
    },
    async stop() {
      closed = true;
      stopped = true;
      if (timer !== undefined) {
        (dependencies.clearInterval ?? globalThis.clearInterval)(timer);
        timer = undefined;
      }
      await active;
    },
  };
}
