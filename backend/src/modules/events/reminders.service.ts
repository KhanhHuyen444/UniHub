import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import {
  freezeReminderEmail,
  type ReminderEmailConfig,
} from './reminder-email.js';

export type ReminderClient = Pick<PrismaClient, '$queryRaw' | '$transaction'>;
export const REMINDER_BATCH_SIZE = 100;
const MAX_CONSECUTIVE_ERRORS = 3;

export interface ReminderScanState {
  maxId?: number;
  after?: { event_id: number; due_date: Date };
}

export interface ReminderRunOptions {
  email?: ReminderEmailConfig;
  now?: () => Date;
  shouldStop?: () => boolean;
  onEventError?: (eventId: number) => void;
  scanState?: ReminderScanState;
}

/** One transaction per event; never retain a candidate's stale deadline. */
export async function processReminderEvent(
  client: ReminderClient,
  eventId: number,
  now: () => Date = () => new Date(),
  shouldStop: () => boolean = () => false,
  email: ReminderEmailConfig = { enabled: false },
): Promise<'reminded' | 'overdue' | 'skipped'> {
  for (let attempt = 0; ; attempt++) {
    if (shouldStop()) return 'skipped';
    try {
      return await client.$transaction(
        async (tx) => {
          if (shouldStop()) return 'skipped';
          const event = await tx.event.findUnique({
            where: { event_id: eventId },
          });
          if (!event || event.status !== 'Upcoming') return 'skipped';
          const evaluatedAt = now();
          const remaining = event.due_date.getTime() - evaluatedAt.getTime();
          const expired = remaining <= 0;
          if (
            !expired &&
            (event.reminded_at !== null ||
              remaining > event.remind_before * 3_600_000)
          ) {
            return 'skipped';
          }

          // Serializable read + conditional write serialize with workers and
          // Calendar PATCH. The write lock is held until notification commit.
          const claimed = await tx.event.updateMany({
            where: {
              event_id: eventId,
              status: 'Upcoming',
              due_date: event.due_date,
              remind_before: event.remind_before,
              reminded_at: event.reminded_at,
            },
            data: expired
              ? { status: 'Overdue' }
              : { reminded_at: evaluatedAt },
          });
          if (claimed.count !== 1) return 'skipped';
          if (expired) return 'overdue';

          const notification = await tx.notification.create({
            data: {
              user_id: event.user_id,
              event_id: event.event_id,
              type: 'Reminder',
              content: `Nhắc hạn sự kiện: ${event.title}`,
              is_read: false,
            },
          });
          if (email.enabled) {
            const owner = await tx.user.findUnique({
              where: { user_id: event.user_id },
              select: { user_id: true, role: true, email: true },
            });
            if (
              !owner ||
              owner.user_id !== event.user_id ||
              owner.role !== 'Student'
            ) {
              throw new Error('REMINDER_EMAIL_OWNER_INVALID');
            }
            const frozen = freezeReminderEmail(
              email,
              event,
              owner.email,
              notification.notification_id,
            );
            // Do not catch: any failure must roll back the bell and reminded_at.
            await tx.eventReminderEmail.create({
              data: {
                notification_id: notification.notification_id,
                ...frozen,
              },
            });
          }
          return 'reminded';
        },
        { isolationLevel: 'Serializable', maxWait: 5_000, timeout: 5_000 },
      );
    } catch (error) {
      if (
        attempt >= 2 ||
        typeof error !== 'object' ||
        error === null ||
        !('code' in error) ||
        error.code !== 'P2034'
      ) {
        throw error;
      }
    }
  }
}

export async function runDeadlineReminders(
  client: ReminderClient,
  options: ReminderRunOptions = {},
): Promise<void> {
  if (options.shouldStop?.()) return;
  const scan = options.scanState ?? {};
  if (scan.maxId === undefined) {
    const [row] = await client.$queryRaw<Array<{ max_id: number | null }>>`
      SELECT MAX(event_id) AS max_id FROM events
    `;
    scan.maxId = row.max_id ?? 0;
  }
  if (options.shouldStop?.()) return;
  const evaluatedAt = (options.now ?? (() => new Date()))();
  // Column-dependent lead time cannot be expressed with Prisma's findMany.
  // Parameterized SQL avoids overflow from DATE_ADD with very large lead times.
  // Freeze the ID watermark for this sweep, so new inserts cannot postpone its
  // wrap forever. Advance past attempts (including failures), then wrap to retry
  // failures and deadlines moved behind the cursor. Never persist this cursor.
  const after = scan.after
    ? Prisma.sql`AND (due_date > ${scan.after.due_date}
        OR (due_date = ${scan.after.due_date} AND event_id > ${scan.after.event_id}))`
    : Prisma.empty;
  const candidates = await client.$queryRaw<
    Array<{ event_id: number; due_date: Date }>
  >`
    SELECT event_id, due_date FROM events
    WHERE status COLLATE utf8mb4_0900_as_cs = 'Upcoming'
      AND event_id <= ${scan.maxId}
      ${after}
      AND (due_date <= ${evaluatedAt}
        OR (reminded_at IS NULL AND due_date > ${evaluatedAt}
          AND TIMESTAMPDIFF(MICROSECOND, ${evaluatedAt}, due_date)
            <= CAST(remind_before AS SIGNED) * 3600000000))
    ORDER BY due_date ASC, event_id ASC
    LIMIT ${REMINDER_BATCH_SIZE}
  `;
  let consecutiveErrors = 0;
  for (const candidate of candidates) {
    if (options.shouldStop?.()) return;
    scan.after = { event_id: candidate.event_id, due_date: candidate.due_date };
    try {
      await processReminderEvent(
        client,
        candidate.event_id,
        options.now,
        options.shouldStop,
        options.email,
      );
      consecutiveErrors = 0;
    } catch {
      // Bound outage work/logging; remaining candidates are retried next tick.
      options.onEventError?.(candidate.event_id);
      if (++consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) return;
    }
  }
  if (candidates.length < REMINDER_BATCH_SIZE) {
    scan.maxId = undefined;
    scan.after = undefined;
  }
}
