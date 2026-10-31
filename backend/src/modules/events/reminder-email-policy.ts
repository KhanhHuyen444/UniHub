import { isMailbox } from './reminder-email.js';
import { MAIL_TIMEOUT_MS, type MailFailure } from './mail-transport.js';

export const MAX_EMAIL_ATTEMPTS = 6;
export const EMAIL_LEASE_MS = 60_000;
export const IDEMPOTENCY_WINDOW_MS = 23 * 3_600_000;
export const MAX_RETRY_DELAY_MS = 6 * 3_600_000;
export const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 1_800_000, 7_200_000];

export type EmailState =
  | 'Pending'
  | 'Processing'
  | 'Retry'
  | 'Accepted'
  | 'Cancelled'
  | 'Dead';

export interface EmailRow {
  notification_id: number;
  payload_json: string;
  idempotency_key: string;
  state: EmailState;
  attempt_count: number;
  next_attempt_at: Date;
  lease_token: string | null;
  lease_expires_at: Date | null;
  first_attempt_at: Date | null;
  db_now: Date;
  notification_type: string | null;
  notification_user_id: number | null;
  event_id: number | null;
  event_user_id: number | null;
  event_status: string | null;
  due_date: Date | null;
  remind_before: number | null;
  reminded_at: Date | null;
  user_id: number | null;
  user_role: string | null;
  recipient: string | null;
}

export interface EmailDecision {
  state: 'Retry' | 'Cancelled' | 'Dead';
  code: string;
  nextAttemptAt?: Date;
}

type Payload = {
  from: string;
  to: [string];
  subject: string;
  html: string;
  text: string;
};

function parsePayload(raw: string): Payload | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return null;
    const p = value as Record<string, unknown>;
    if (
      Object.keys(p).sort().join(',') !== 'from,html,subject,text,to' ||
      typeof p.from !== 'string' ||
      !isMailbox(p.from) ||
      !Array.isArray(p.to) ||
      p.to.length !== 1 ||
      typeof p.to[0] !== 'string' ||
      !isMailbox(p.to[0]) ||
      typeof p.subject !== 'string' ||
      !p.subject ||
      /[\r\n\x00]/.test(p.subject) ||
      typeof p.html !== 'string' ||
      !p.html ||
      typeof p.text !== 'string' ||
      !p.text
    )
      return null;
    return p as Payload;
  } catch {
    return null;
  }
}

export function requestCutoff(row: EmailRow): number {
  return Math.min(
    row.due_date?.getTime() ?? 0,
    row.first_attempt_at
      ? row.first_attempt_at.getTime() + IDEMPOTENCY_WINDOW_MS
      : Number.POSITIVE_INFINITY,
  );
}

// Current relational data is authoritative. Deliberately ignore title/notes.
export function ineligibility(row: EmailRow): EmailDecision | null {
  const cancel = (code: string): EmailDecision => ({
    state: 'Cancelled',
    code,
  });
  if (row.notification_type !== 'Reminder' || row.event_id === null) {
    return cancel('NOT_A_REMINDER');
  }
  if (
    row.user_id === null ||
    row.user_id !== row.notification_user_id ||
    row.user_id !== row.event_user_id ||
    row.user_role !== 'Student'
  )
    return cancel('OWNER_INELIGIBLE');
  if (row.event_status !== 'Upcoming') return cancel('EVENT_INELIGIBLE');
  if (!row.due_date || row.due_date.getTime() <= row.db_now.getTime()) {
    return cancel('DEADLINE_PASSED');
  }
  if (
    row.reminded_at === null ||
    row.remind_before === null ||
    row.remind_before <= 0 ||
    row.due_date.getTime() - row.db_now.getTime() >
      row.remind_before * 3_600_000
  )
    return cancel('REMINDER_INELIGIBLE');
  const payload = parsePayload(row.payload_json);
  const key = /^unihub\/[a-z0-9-]{1,64}\/event-reminder\/([1-9][0-9]*)$/.exec(
    row.idempotency_key,
  );
  if (
    !payload ||
    !key ||
    key[0] !== row.idempotency_key ||
    Number(key[1]) !== row.notification_id
  ) {
    return { state: 'Dead', code: 'INVALID_PAYLOAD_OR_KEY' };
  }
  if (
    !row.recipient ||
    !isMailbox(row.recipient) ||
    row.recipient !== payload.to[0]
  ) {
    return cancel('RECIPIENT_CHANGED');
  }
  if (row.db_now.getTime() + MAIL_TIMEOUT_MS >= row.due_date.getTime()) {
    return cancel('DEADLINE_TOO_CLOSE');
  }
  if (row.db_now.getTime() + MAIL_TIMEOUT_MS >= requestCutoff(row)) {
    return { state: 'Dead', code: 'IDEMPOTENCY_WINDOW_EXPIRED' };
  }
  return null;
}

export function retryDecision(
  row: EmailRow,
  failure: MailFailure,
  // Expired claims back off from their lease expiry, not recovery time.
  base: Date = row.db_now,
): EmailDecision {
  const invalid = ineligibility(row);
  if (invalid) return invalid;
  if (!failure.retryable) return { state: 'Dead', code: failure.code };
  if (row.attempt_count >= MAX_EMAIL_ATTEMPTS) {
    return { state: 'Dead', code: 'ATTEMPTS_EXHAUSTED' };
  }
  const delay = Math.max(
    RETRY_DELAYS_MS[row.attempt_count - 1],
    failure.retryAfterMs ?? 0,
    // An HTTP-date with no valid provider Date header uses authoritative DB
    // time, never the application's potentially skewed wall clock.
    failure.retryAtMs === undefined
      ? 0
      : Math.max(0, failure.retryAtMs - base.getTime()),
  );
  if (!Number.isFinite(delay) || delay > MAX_RETRY_DELAY_MS) {
    return { state: 'Dead', code: 'RETRY_AFTER_EXCEEDS_LIMIT' };
  }
  // Round upward to DATETIME(0) so retries never happen early.
  const next = new Date(Math.ceil((base.getTime() + delay) / 1000) * 1000);
  const earliest = Math.max(next.getTime(), row.db_now.getTime());
  if (earliest + MAIL_TIMEOUT_MS >= row.due_date!.getTime()) {
    return { state: 'Cancelled', code: 'DEADLINE_TOO_CLOSE' };
  }
  if (earliest + MAIL_TIMEOUT_MS >= requestCutoff(row)) {
    return { state: 'Dead', code: 'IDEMPOTENCY_WINDOW_EXPIRED' };
  }
  return { state: 'Retry', code: failure.code, nextAttemptAt: next };
}
