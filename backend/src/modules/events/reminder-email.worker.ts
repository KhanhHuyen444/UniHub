import {
  MAIL_TIMEOUT_MS,
  MailFailure,
  asMailFailure,
  createResendTransport,
  isProviderEmailId,
  type MailTransport,
} from './mail-transport.js';
import { getPrismaClient } from '../../lib/prisma.js';
import { readReminderEmailConfig } from './reminder-email.js';
import {
  createPrismaEmailStore,
  EMAIL_DIAGNOSTIC_CODES,
  type EmailClaim,
  type EmailDiagnostic,
  type EmailDiagnosticObserver,
  type EmailStore,
  type SendOutcome,
} from './reminder-email.store.js';

export const EMAIL_POLL_INTERVAL_MS = 5_000;
export const EMAIL_CONCURRENCY = 2;

export type EmailWorkerLogEvent =
  | 'claim'
  | 'retry'
  | 'cancellation'
  | 'provider_acceptance'
  | 'accepted'
  | 'permanent_failure'
  | 'lease_recovery'
  | 'settlement_failure'
  | 'send_failure'
  | 'worker_failure';
const WORKER_ERROR_CODES = [
  ...EMAIL_DIAGNOSTIC_CODES,
  'CLAIM_FAILED',
  'PREFLIGHT_FAILED',
  'POLL_FAILED',
  'SETTLEMENT_FAILED',
  'SETTLEMENT_NOT_APPLIED',
] as const;
type WorkerErrorCode = (typeof WORKER_ERROR_CODES)[number];
export interface EmailWorkerDiagnostic {
  readonly notification_id: number | null;
  readonly attempt_count: number | null;
  readonly state: EmailDiagnostic['state'] | null;
  readonly error_code: WorkerErrorCode | null;
}
export type EmailWorkerLogger = (
  event: EmailWorkerLogEvent,
  diagnostic: Readonly<EmailWorkerDiagnostic>,
) => void;

function consoleLogger(
  event: EmailWorkerLogEvent,
  diagnostic: Readonly<EmailWorkerDiagnostic>,
) {
  const write = event.endsWith('_failure') ? console.error : console.info;
  write(`event_reminder_email.${event}`, diagnostic);
}

export function createReminderEmailWorker(dependencies: {
  enabled: boolean;
  getStore: () => EmailStore;
  transport?: MailTransport;
  reportError?: () => void;
  log?: EmailWorkerLogger;
  monotonicNow?: () => number;
  setInterval?: typeof globalThis.setInterval;
  clearInterval?: typeof globalThis.clearInterval;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
}) {
  if (dependencies.enabled && !dependencies.transport) {
    throw new Error('REMINDER_EMAIL_TRANSPORT_REQUIRED');
  }
  // Retain the existing no-argument error hook; default console output is now
  // structured. Never hand an exception or whole store/provider object to it.
  const report = dependencies.reportError ?? (() => {});
  const logger = dependencies.log ?? consoleLogger;
  function emit(
    event: EmailWorkerLogEvent,
    value: Partial<EmailWorkerDiagnostic> = {},
  ) {
    try {
      const states = [
        'Pending',
        'Processing',
        'Retry',
        'Accepted',
        'Cancelled',
        'Dead',
      ];
      // Project fresh primitive fields, validate at runtime, and freeze the copy.
      // Extra fields and unknown error strings can never reach the logger.
      const safe: Readonly<EmailWorkerDiagnostic> = Object.freeze({
        notification_id:
          typeof value.notification_id === 'number' &&
          Number.isInteger(value.notification_id) &&
          value.notification_id > 0 &&
          value.notification_id <= 2_147_483_647
            ? value.notification_id
            : null,
        attempt_count:
          typeof value.attempt_count === 'number' &&
          Number.isInteger(value.attempt_count) &&
          value.attempt_count >= 0 &&
          value.attempt_count <= 6
            ? value.attempt_count
            : null,
        state: value.state && states.includes(value.state) ? value.state : null,
        error_code:
          value.error_code == null
            ? null
            : (WORKER_ERROR_CODES.find(
                (allowed) => allowed === value.error_code,
              ) ?? 'UNKNOWN_FAILURE'),
      });
      logger(event, safe);
    } catch {
      /* Logging cannot change a claim, send or settlement outcome. */
    }
  }
  const observeTransition: EmailDiagnosticObserver = (operation, value) => {
    if (operation === 'lease_recovery') emit('lease_recovery', value);
    switch (value.state) {
      case 'Processing':
        if (operation === 'claim') emit('claim', value);
        break;
      case 'Retry':
        emit('retry', value);
        break;
      case 'Cancelled':
        emit('cancellation', value);
        break;
      case 'Accepted':
        emit('accepted', value);
        break;
      case 'Dead':
        emit('permanent_failure', value);
        break;
    }
  };
  const monotonic = dependencies.monotonicNow ?? (() => performance.now());
  const active = new Set<Promise<void>>();
  const controllers = new Set<AbortController>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let polling: Promise<void> | undefined;
  let stopped = true;
  let closed = false;

  async function sendOne(store: EmailStore) {
    if (stopped) return;
    let claimDiagnostic: Readonly<EmailDiagnostic> | undefined;
    const observe: EmailDiagnosticObserver = (operation, value) => {
      if (operation === 'claim' && value.state === 'Processing')
        claimDiagnostic = value;
      observeTransition(operation, value);
    };
    const claim = await store.claim(observe).catch((error: unknown) => {
      emit('worker_failure', { error_code: 'CLAIM_FAILED' });
      throw error;
    });
    if (!claim || stopped) return; // A committed claim remains recoverable.
    const context = (
      code: WorkerErrorCode | null,
    ): Partial<EmailWorkerDiagnostic> => ({
      notification_id: claim.notificationId,
      attempt_count: claimDiagnostic?.attempt_count ?? null,
      // An unacknowledged operation cannot prove the current DB state.
      state: null,
      error_code: code,
    });
    async function settle(claimed: EmailClaim, result: SendOutcome) {
      try {
        const changed = await store.settle(claimed, result, observe);
        if (!changed)
          emit('settlement_failure', context('SETTLEMENT_NOT_APPLIED'));
      } catch (error) {
        emit('settlement_failure', context('SETTLEMENT_FAILED'));
        throw error;
      }
    }
    // Start before the DB read so time spent waiting/committing is included.
    const began = monotonic();
    const prepared = await store
      .preflight(claim, observe)
      .catch((error: unknown) => {
        emit('worker_failure', context('PREFLIGHT_FAILED'));
        throw error;
      });
    if (!prepared || stopped) return;
    const estimatedNow = prepared.databaseNow.getTime() + (monotonic() - began);
    if (estimatedNow + MAIL_TIMEOUT_MS >= prepared.sendBefore.getTime()) {
      await settle(claim, {
        accepted: false,
        failure: new MailFailure('REQUEST_TIMEOUT', true),
      });
      return;
    }
    const controller = new AbortController();
    controllers.add(controller);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let rejectAbort: (() => void) | undefined;
    let outcome: SendOutcome;
    try {
      const aborted = new Promise<never>((_, reject) => {
        rejectAbort = () => reject(new MailFailure('REQUEST_TIMEOUT', true));
        controller.signal.addEventListener('abort', rejectAbort, {
          once: true,
        });
        timeout = (dependencies.setTimeout ?? globalThis.setTimeout)(
          () => controller.abort(),
          MAIL_TIMEOUT_MS,
        );
      });
      const accepted = await Promise.race([
        dependencies.transport!.send(prepared.payloadJson, {
          idempotencyKey: prepared.idempotencyKey,
          signal: controller.signal,
        }),
        aborted,
      ]);
      if (!isProviderEmailId(accepted.providerEmailId))
        throw new MailFailure('INVALID_ACCEPTANCE', true);
      // Provider acceptance is observable even when local settlement later
      // fails. Do not label it as a committed Accepted state or inbox delivery.
      emit('provider_acceptance', context(null));
      outcome = { accepted: true, providerEmailId: accepted.providerEmailId };
    } catch (error) {
      outcome = { accepted: false, failure: asMailFailure(error) };
      emit('send_failure', context(outcome.failure.code));
      report(); // No exception, address, body or key is passed to the logger.
    } finally {
      if (timeout !== undefined)
        (dependencies.clearTimeout ?? globalThis.clearTimeout)(timeout);
      if (rejectAbort)
        controller.signal.removeEventListener('abort', rejectAbort);
      controllers.delete(controller);
    }
    // A failed/ambiguous DB commit is recovered by lease expiry. Never resend
    // here: one claim authorizes at most one provider request.
    await settle(claim, outcome);
  }

  function tick() {
    if (stopped || polling) return;
    polling = Promise.resolve()
      .then(async () => {
        if (stopped) return;
        const store = dependencies.getStore();
        await store.recoverExpired(observeTransition);
        if (stopped) return;
        const slots = EMAIL_CONCURRENCY - active.size;
        for (let slot = 0; slot < slots; slot++) {
          const task = sendOne(store)
            .catch(() => report())
            .finally(() => active.delete(task));
          active.add(task);
        }
      })
      .catch(() => {
        emit('worker_failure', { error_code: 'POLL_FAILED' });
        report();
      })
      .finally(() => {
        polling = undefined;
      });
  }
  return {
    start() {
      if (closed || !stopped || !dependencies.enabled) return;
      stopped = false;
      timer = (dependencies.setInterval ?? globalThis.setInterval)(
        tick,
        EMAIL_POLL_INTERVAL_MS,
      );
      timer.unref();
      tick();
    },
    async stop() {
      closed = true;
      stopped = true;
      if (timer !== undefined)
        (dependencies.clearInterval ?? globalThis.clearInterval)(timer);
      for (const controller of controllers) controller.abort();
      await polling;
      await Promise.all(active);
    },
  };
}

// Lazy store: disabled mode never instantiates a DB client or a transport.
export function createConfiguredReminderEmailWorker(
  env: NodeJS.ProcessEnv = process.env,
) {
  const config = readReminderEmailConfig(env);
  const transport = config.enabled
    ? createResendTransport(env.RESEND_API_KEY ?? '')
    : undefined;
  return createReminderEmailWorker({
    enabled: config.enabled,
    transport,
    getStore: () => createPrismaEmailStore(getPrismaClient()),
  });
}
