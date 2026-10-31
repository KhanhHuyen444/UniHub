import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { MailFailure } from './mail-transport.js';
import {
  EMAIL_LEASE_MS,
  MAX_EMAIL_ATTEMPTS,
  ineligibility,
  requestCutoff,
  retryDecision,
  type EmailDecision,
  type EmailRow,
  type EmailState,
} from './reminder-email-policy.js';

export type EmailClient = Pick<PrismaClient, '$transaction'>;
type Transaction = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;
export interface EmailClaim {
  notificationId: number;
  leaseToken: string;
}
export interface PreparedEmail extends EmailClaim {
  payloadJson: string;
  idempotencyKey: string;
  databaseNow: Date;
  sendBefore: Date;
}
export type SendOutcome =
  | { accepted: true; providerEmailId: string }
  | { accepted: false; failure: MailFailure };

export const EMAIL_DIAGNOSTIC_CODES = [
  'NETWORK_ERROR',
  'REQUEST_TIMEOUT',
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'IDEMPOTENCY_IN_PROGRESS',
  'IDEMPOTENCY_UNKNOWN',
  'IDEMPOTENCY_CONFLICT',
  'PROVIDER_REJECTED',
  'INVALID_ACCEPTANCE',
  'NOT_A_REMINDER',
  'OWNER_INELIGIBLE',
  'EVENT_INELIGIBLE',
  'DEADLINE_PASSED',
  'REMINDER_INELIGIBLE',
  'INVALID_PAYLOAD_OR_KEY',
  'RECIPIENT_CHANGED',
  'DEADLINE_TOO_CLOSE',
  'IDEMPOTENCY_WINDOW_EXPIRED',
  'ATTEMPTS_EXHAUSTED',
  'RETRY_AFTER_EXCEEDS_LIMIT',
  'UNKNOWN_FAILURE',
] as const;
export type EmailDiagnosticCode = (typeof EMAIL_DIAGNOSTIC_CODES)[number];
export interface EmailDiagnostic {
  readonly notification_id: number;
  readonly attempt_count: number;
  readonly state: EmailState;
  readonly error_code: EmailDiagnosticCode | null;
}
export type EmailDiagnosticOperation =
  | 'claim'
  | 'preflight'
  | 'settle'
  | 'lease_recovery';
export type EmailDiagnosticObserver = (
  operation: EmailDiagnosticOperation,
  diagnostic: Readonly<EmailDiagnostic>,
) => void;

function diagnostic(
  row: EmailRow,
  state: EmailState,
  code: string | null,
  attemptCount = row.attempt_count,
): Readonly<EmailDiagnostic> {
  return Object.freeze({
    notification_id: row.notification_id,
    attempt_count: attemptCount,
    state,
    error_code:
      code === null
        ? null
        : (EMAIL_DIAGNOSTIC_CODES.find((allowed) => allowed === code) ??
          'UNKNOWN_FAILURE'),
  });
}

export interface EmailStore {
  claim(observe?: EmailDiagnosticObserver): Promise<EmailClaim | null>;
  preflight(
    claim: EmailClaim,
    observe?: EmailDiagnosticObserver,
  ): Promise<PreparedEmail | null>;
  settle(
    claim: EmailClaim,
    outcome: SendOutcome,
    observe?: EmailDiagnosticObserver,
  ): Promise<boolean>;
  recoverExpired(observe?: EmailDiagnosticObserver): Promise<void>;
}

// One coherent non-locking joined read, after locking ONLY the job row. Avoid
// taking parent locks in reverse order to Calendar's Event -> Notification order.
async function readRow(tx: Transaction, id: number): Promise<EmailRow | null> {
  const rows = await tx.$queryRaw<EmailRow[]>`
    SELECT r.*, UTC_TIMESTAMP(3) AS db_now,
      n.type AS notification_type, n.user_id AS notification_user_id,
      e.event_id, e.user_id AS event_user_id, e.status AS event_status,
      e.due_date, e.remind_before, e.reminded_at,
      u.user_id, u.role AS user_role, u.email AS recipient
    FROM event_reminder_emails r
    LEFT JOIN notifications n ON n.notification_id = r.notification_id
    LEFT JOIN events e ON e.event_id = n.event_id
    LEFT JOIN users u ON u.user_id = n.user_id
    WHERE r.notification_id = ${id}
  `;
  return rows[0] ?? null;
}

// Every state write is fenced by the locked row's state, attempt and lease token.
// Processing transitions additionally check live/expired lease using DB time.
async function decide(
  tx: Transaction,
  row: EmailRow,
  decision: EmailDecision,
  expired = false,
): Promise<boolean> {
  const lease =
    row.state === 'Processing'
      ? expired
        ? Prisma.sql`AND lease_expires_at <= UTC_TIMESTAMP(3)`
        : Prisma.sql`AND lease_expires_at > UTC_TIMESTAMP(3)`
      : Prisma.empty;
  const changed = await tx.$executeRaw(Prisma.sql`
    UPDATE event_reminder_emails
    SET state = ${decision.state}, last_error_code = ${decision.code},
      next_attempt_at = ${decision.nextAttemptAt ?? row.next_attempt_at},
      lease_token = NULL, lease_expires_at = NULL
    WHERE notification_id = ${row.notification_id}
      AND state = ${row.state} AND attempt_count = ${row.attempt_count}
      AND lease_token <=> ${row.lease_token} ${lease}
  `);
  return changed === 1;
}

async function lockClaim(
  tx: Transaction,
  claim: EmailClaim,
): Promise<EmailRow | null> {
  const locked = await tx.$queryRaw<Array<{ notification_id: number }>>`
    SELECT notification_id FROM event_reminder_emails
    WHERE notification_id = ${claim.notificationId}
      AND state COLLATE utf8mb4_0900_as_cs = 'Processing'
      AND lease_token = ${claim.leaseToken}
      AND lease_expires_at > UTC_TIMESTAMP(3)
    FOR UPDATE
  `;
  return locked.length ? readRow(tx, claim.notificationId) : null;
}

async function lockReadyEmail(tx: Transaction): Promise<number | null> {
  let after: { notification_id: number; next_attempt_at: Date } | undefined;
  // Keep sorting outside the locking read: a filesort can lock every scanned
  // eligible row before LIMIT 1. Keyset traversal preserves oldest-due ordering
  // while moving past locked/deleted/rescheduled candidates. The surrounding
  // five-second transaction deadline also bounds a heavily contended scan.
  for (;;) {
    const cursor = after
      ? Prisma.sql`AND (next_attempt_at > ${after.next_attempt_at}
          OR (next_attempt_at = ${after.next_attempt_at}
            AND notification_id > ${after.notification_id}))`
      : Prisma.empty;
    const candidates = await tx.$queryRaw<
      Array<{ notification_id: number; next_attempt_at: Date }>
    >(Prisma.sql`
      SELECT notification_id, next_attempt_at FROM event_reminder_emails
      WHERE state IN ('Pending', 'Retry')
        AND next_attempt_at <= UTC_TIMESTAMP(3) ${cursor}
      ORDER BY next_attempt_at, notification_id LIMIT 1
    `);
    if (!candidates.length) return null;
    after = candidates[0];
    const locked = await tx.$queryRaw<Array<{ notification_id: number }>>`
      SELECT notification_id FROM event_reminder_emails FORCE INDEX (PRIMARY)
      WHERE notification_id = ${after.notification_id}
        AND state IN ('Pending', 'Retry')
        AND next_attempt_at <= UTC_TIMESTAMP(3)
      FOR UPDATE SKIP LOCKED
    `;
    if (locked.length) return locked[0].notification_id;
  }
}

export function createPrismaEmailStore(
  client: EmailClient,
  uuid: () => string = randomUUID,
): EmailStore {
  const transact = async <T>(
    operation: (
      tx: Transaction,
      record: (value: Readonly<EmailDiagnostic>) => void,
    ) => Promise<T>,
    source: EmailDiagnosticOperation,
    observe?: EmailDiagnosticObserver,
  ): Promise<T> => {
    const committed: Readonly<EmailDiagnostic>[] = [];
    const result = await client.$transaction(
      (tx) => operation(tx, (value) => committed.push(value)),
      {
        isolationLevel: 'ReadCommitted',
        maxWait: 5_000,
        timeout: 5_000,
      },
    );
    // A rejected/ambiguous commit never reaches this point. Diagnostic failures
    // must not turn a successful DB operation into a failed worker operation.
    for (const value of committed) {
      try {
        observe?.(source, value);
      } catch {
        /* Logging is best-effort only. */
      }
    }
    return result;
  };
  return {
    claim: (observe) =>
      transact(
        async (tx, record) => {
          const lockedId = await lockReadyEmail(tx);
          if (lockedId === null) return null;
          const row = await readRow(tx, lockedId);
          if (!row) return null;
          const invalid =
            ineligibility(row) ??
            (row.attempt_count >= MAX_EMAIL_ATTEMPTS
              ? { state: 'Dead' as const, code: 'ATTEMPTS_EXHAUSTED' }
              : null);
          if (invalid) {
            if (await decide(tx, row, invalid))
              record(diagnostic(row, invalid.state, invalid.code));
            return null;
          }
          const token = uuid();
          const changed = await tx.$executeRaw`
        UPDATE event_reminder_emails
        SET state = 'Processing', attempt_count = attempt_count + 1,
          first_attempt_at = COALESCE(first_attempt_at, UTC_TIMESTAMP(0)),
          lease_token = ${token},
          lease_expires_at = DATE_ADD(UTC_TIMESTAMP(0), INTERVAL ${EMAIL_LEASE_MS / 1000} SECOND)
        WHERE notification_id = ${row.notification_id}
          AND state = ${row.state} AND attempt_count = ${row.attempt_count}
          AND attempt_count < ${MAX_EMAIL_ATTEMPTS}
          AND lease_token IS NULL
          AND next_attempt_at <= UTC_TIMESTAMP(3)
      `;
          if (changed === 1)
            record(diagnostic(row, 'Processing', null, row.attempt_count + 1));
          return changed === 1
            ? { notificationId: row.notification_id, leaseToken: token }
            : null;
        },
        'claim',
        observe,
      ),
    preflight: (claim, observe) =>
      transact(
        async (tx, record) => {
          const row = await lockClaim(tx, claim);
          if (!row) return null;
          const invalid = ineligibility(row);
          if (invalid) {
            if (await decide(tx, row, invalid))
              record(diagnostic(row, invalid.state, invalid.code));
            return null;
          }
          return {
            ...claim,
            payloadJson: row.payload_json,
            idempotencyKey: row.idempotency_key,
            databaseNow: row.db_now,
            sendBefore: new Date(
              Math.min(requestCutoff(row), row.lease_expires_at!.getTime()),
            ),
          };
        },
        'preflight',
        observe,
      ),
    settle: (claim, outcome, observe) =>
      transact(
        async (tx, record) => {
          const row = await lockClaim(tx, claim);
          if (!row) return false;
          if (!outcome.accepted) {
            const decision = retryDecision(row, outcome.failure);
            const changed = await decide(tx, row, decision);
            if (changed) record(diagnostic(row, decision.state, decision.code));
            return changed;
          }
          // A request may have been accepted before a concurrent completion/edit.
          // Record acceptance while fenced, rather than claiming it was not sent.
          const changed = await tx.$executeRaw`
        UPDATE event_reminder_emails
        SET state = 'Accepted', provider_email_id = ${outcome.providerEmailId},
          accepted_at = UTC_TIMESTAMP(0), last_error_code = NULL,
          lease_token = NULL, lease_expires_at = NULL
        WHERE notification_id = ${claim.notificationId}
          AND state COLLATE utf8mb4_0900_as_cs = 'Processing'
          AND lease_token = ${claim.leaseToken}
          AND attempt_count = ${row.attempt_count}
          AND lease_expires_at > UTC_TIMESTAMP(3)
      `;
          if (changed === 1) record(diagnostic(row, 'Accepted', null));
          return changed === 1;
        },
        'settle',
        observe,
      ),
    async recoverExpired(observe) {
      // Bound outage work. Every recovered claim keeps its consumed attempt.
      for (let count = 0; count < 20; count++) {
        const recovered = await transact(
          async (tx, record) => {
            const locked = await tx.$queryRaw<
              Array<{ notification_id: number }>
            >`
            SELECT notification_id FROM event_reminder_emails
            WHERE state = 'Processing'
              AND lease_expires_at <= UTC_TIMESTAMP(3)
            ORDER BY lease_expires_at, notification_id
            LIMIT 1 FOR UPDATE SKIP LOCKED
          `;
            if (!locked.length) return false;
            const row = await readRow(tx, locked[0].notification_id);
            if (!row) return false;
            const decision = retryDecision(
              row,
              new MailFailure('REQUEST_TIMEOUT', true),
              row.lease_expires_at!,
            );
            const changed = await decide(tx, row, decision, true);
            if (changed) record(diagnostic(row, decision.state, decision.code));
            return changed;
          },
          'lease_recovery',
          observe,
        );
        if (!recovered) break;
      }
    },
  };
}
