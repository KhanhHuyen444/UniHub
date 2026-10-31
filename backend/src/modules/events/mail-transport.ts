import nodemailer from 'nodemailer';
import { isMailbox } from './reminder-email.js';

export const MAIL_TIMEOUT_MS = 10_000;

export interface MailTransport {
  send(
    payloadJson: string,
    options: { idempotencyKey: string; signal: AbortSignal },
  ): Promise<{ providerEmailId: string }>;
}

type FailureCode =
  | 'NETWORK_ERROR'
  | 'REQUEST_TIMEOUT'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'IDEMPOTENCY_UNKNOWN'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PROVIDER_REJECTED'
  | 'INVALID_ACCEPTANCE';

// Contains only allowlisted metadata; never retain a response, cause or message.
export class MailFailure extends Error {
  constructor(
    readonly code: FailureCode,
    readonly retryable: boolean,
    readonly retryAfterMs?: number,
    // Absolute HTTP-date fallback, compared against database time by policy.
    readonly retryAtMs?: number,
  ) {
    super(code);
    this.name = 'MailFailure';
  }
}

export function asMailFailure(error: unknown): MailFailure {
  return error instanceof MailFailure
    ? error
    : new MailFailure('NETWORK_ERROR', true);
}

export function isProviderEmailId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 255 &&
    !/[^a-zA-Z0-9_-]/.test(value)
  );
}

function httpDate(value: string | null): number | undefined {
  if (value === null) return undefined;
  // HTTP-date forms: IMF-fixdate, obsolete RFC 850 and ANSI C asctime.
  // Exclude permissive Date.parse inputs such as bare numbers/local dates.
  const day = '(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)';
  const month = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';
  const time = '\\d{2}:\\d{2}:\\d{2}';
  const forms = [
    `${day}, \\d{2} ${month} \\d{4} ${time} GMT`,
    `(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \\d{2}-${month}-\\d{2} ${time} GMT`,
    `${day} ${month} (?: \\d|\\d{2}) ${time} \\d{4}`,
  ];
  if (!new RegExp(`^(?:${forms.join('|')})$`).test(value)) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function retryAfter(
  value: string | null,
  providerDate: string | null,
): { retryAfterMs?: number; retryAtMs?: number } {
  if (value === null) return {};
  if (/^\d+$/.test(value)) {
    const delay = Number(value) * 1000;
    return {
      retryAfterMs: Number.isFinite(delay) ? delay : Number.MAX_SAFE_INTEGER,
    };
  }
  const target = httpDate(value);
  if (target === undefined) return {};
  const origin = httpDate(providerDate);
  // Never use the application's wall clock to interpret an absolute header.
  // Without a provider clock, preserve the instant for database-time comparison.
  return origin === undefined
    ? { retryAtMs: target }
    : { retryAfterMs: Math.max(0, target - origin) };
}

export function createResendTransport(
  apiKey: string,
  dependencies: { fetch?: typeof fetch } = {},
): MailTransport {
  if (!apiKey || /\s|[^\x21-\x7e]/.test(apiKey)) {
    throw new Error('REMINDER_EMAIL_PROVIDER_CONFIG_INVALID');
  }
  const request = dependencies.fetch ?? globalThis.fetch;
  return {
    async send(payloadJson, { idempotencyKey, signal }) {
      // Fetch makes one request: no SDK, redirects or automatic application retry.
      const combined = AbortSignal.any([
        signal,
        AbortSignal.timeout(MAIL_TIMEOUT_MS),
      ]);
      try {
        combined.throwIfAborted();
        const response = await request('https://api.resend.com/emails', {
          method: 'POST',
          redirect: 'error',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: payloadJson,
          signal: combined,
        });
        if (response.status === 429) {
          const retry = retryAfter(
            response.headers.get('Retry-After'),
            response.headers.get('Date'),
          );
          // Release the body without awaiting it: a stalled body must not hide
          // a rate-limit instruction already received in the response headers.
          void response.body?.cancel().catch(() => {});
          throw new MailFailure(
            'RATE_LIMITED',
            true,
            retry.retryAfterMs,
            retry.retryAtMs,
          );
        }
        // Parse only the two allowlisted fields below; nothing is logged/stored.
        const body: unknown = await response.json().catch(() => null);
        const fields =
          body !== null && typeof body === 'object'
            ? (body as Record<string, unknown>)
            : {};
        if (response.ok) {
          if (!isProviderEmailId(fields.id)) {
            throw new MailFailure('INVALID_ACCEPTANCE', true);
          }
          return { providerEmailId: fields.id };
        }
        if (response.status === 408) {
          throw new MailFailure('REQUEST_TIMEOUT', true);
        }
        if (response.status >= 500) {
          throw new MailFailure('PROVIDER_UNAVAILABLE', true);
        }
        if (response.status === 409) {
          if (fields.name === 'invalid_idempotent_request') {
            throw new MailFailure('IDEMPOTENCY_CONFLICT', false);
          }
          throw new MailFailure(
            fields.name === 'concurrent_idempotent_requests'
              ? 'IDEMPOTENCY_IN_PROGRESS'
              : 'IDEMPOTENCY_UNKNOWN',
            true,
          );
        }
        throw new MailFailure('PROVIDER_REJECTED', false);
      } catch (error) {
        if (error instanceof MailFailure) throw error;
        throw new MailFailure(
          combined.aborted ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
          true,
        );
      }
    },
  };
}

export interface GmailSmtpCredentials {
  user: string;
  pass: string;
  host?: string;
  port?: number;
  secure?: boolean;
  fromName?: string;
}

export interface SmtpTransporter {
  sendMail(options: {
    from: string | { name: string; address: string };
    to: string[];
    subject: string;
    html: string;
    text: string;
    headers?: Record<string, string>;
  }): Promise<{ messageId?: string; response?: string }>;
}

export function mapSmtpError(
  error: unknown,
  signal?: AbortSignal,
): MailFailure {
  if (error instanceof MailFailure) return error;
  if (signal?.aborted) return new MailFailure('REQUEST_TIMEOUT', true);

  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    const responseCode =
      typeof err.responseCode === 'number'
        ? err.responseCode
        : typeof err.status === 'number'
          ? err.status
          : 0;

    // 5xx permanent SMTP errors (authentication failure 535, bad address 550, 553, etc.)
    if (responseCode >= 500 && responseCode < 600) {
      return new MailFailure('PROVIDER_REJECTED', false);
    }
    // 421 / 450 / 452: Rate limited / Daily quota exceeded / Mailbox busy
    if (responseCode === 421 || responseCode === 450 || responseCode === 452) {
      return new MailFailure('RATE_LIMITED', true);
    }
    // Other 4xx temporary SMTP errors
    if (responseCode >= 400 && responseCode < 500) {
      return new MailFailure('PROVIDER_UNAVAILABLE', true);
    }

    const code = typeof err.code === 'string' ? err.code : '';
    if (
      code === 'ETIMEDOUT' ||
      code === 'ESOCKETTIMEDOUT' ||
      code === 'ETIME'
    ) {
      return new MailFailure('REQUEST_TIMEOUT', true);
    }
    if (
      [
        'ECONNREFUSED',
        'ECONNRESET',
        'ENOTFOUND',
        'EAI_AGAIN',
        'EHOSTUNREACH',
        'EPIPE',
      ].includes(code)
    ) {
      return new MailFailure('NETWORK_ERROR', true);
    }
  }

  return new MailFailure('NETWORK_ERROR', true);
}

export function createGmailSmtpTransport(
  credentials: GmailSmtpCredentials,
  dependencies: { transporter?: SmtpTransporter } = {},
): MailTransport {
  const user = credentials.user?.trim();
  const pass = credentials.pass?.replace(/\s+/g, '');
  if (!user || !isMailbox(user) || !pass || pass.length < 8) {
    throw new Error('REMINDER_EMAIL_PROVIDER_CONFIG_INVALID');
  }
  const fromName = credentials.fromName?.trim() || 'UniHub';

  const transporter: SmtpTransporter =
    dependencies.transporter ??
    nodemailer.createTransport({
      host: credentials.host ?? 'smtp.gmail.com',
      port: credentials.port ?? 465,
      secure: credentials.secure ?? true,
      auth: { user, pass },
      connectionTimeout: MAIL_TIMEOUT_MS,
      greetingTimeout: MAIL_TIMEOUT_MS,
      socketTimeout: MAIL_TIMEOUT_MS,
      logger: false,
      debug: false,
    });

  return {
    async send(payloadJson, { idempotencyKey, signal }) {
      const combined = AbortSignal.any([
        signal,
        AbortSignal.timeout(MAIL_TIMEOUT_MS),
      ]);
      try {
        combined.throwIfAborted();

        let parsed: {
          from: string;
          to: string[];
          subject: string;
          html: string;
          text: string;
        };
        try {
          parsed = JSON.parse(payloadJson);
        } catch {
          throw new MailFailure('PROVIDER_REJECTED', false);
        }

        const sendPromise = transporter.sendMail({
          from: { name: fromName, address: parsed.from },
          to: parsed.to,
          subject: parsed.subject,
          html: parsed.html,
          text: parsed.text,
          headers: {
            'X-Idempotency-Key': idempotencyKey,
          },
        });

        const abortPromise = new Promise<never>((_, reject) => {
          if (combined.aborted) {
            reject(new MailFailure('REQUEST_TIMEOUT', true));
            return;
          }
          combined.addEventListener(
            'abort',
            () => reject(new MailFailure('REQUEST_TIMEOUT', true)),
            { once: true },
          );
        });

        const result = await Promise.race([sendPromise, abortPromise]);

        const rawId =
          typeof result?.messageId === 'string' && result.messageId.trim()
            ? result.messageId.trim()
            : '';
        const cleanId = rawId
          .replace(/^<|>$/g, '')
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .slice(0, 255);
        const providerEmailId =
          cleanId.length > 0 ? cleanId : `gmail_${Date.now()}`;
        if (!isProviderEmailId(providerEmailId)) {
          throw new MailFailure('INVALID_ACCEPTANCE', true);
        }

        return { providerEmailId };
      } catch (error) {
        if (error instanceof MailFailure) throw error;
        throw mapSmtpError(error, combined);
      }
    },
  };
}
