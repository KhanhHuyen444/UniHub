export type ReminderEmailProvider = 'resend' | 'gmail-smtp';

export type ReminderEmailConfig =
  | { readonly enabled: false }
  | {
      readonly enabled: true;
      readonly provider: ReminderEmailProvider;
      readonly from: string;
      readonly fromName: string;
      readonly namespace: string;
      readonly calendarUrl: string;
    };

// One unquoted ASCII dot-atom mailbox with DNS labels; no display names/lists.
// Reject controls/whitespace before anchored matching (including final newlines).
export function isMailbox(value: string): boolean {
  if (value.length > 255 || /[^\x21-\x7e]/.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (
    local.length > 64 ||
    !/^[a-z0-9!#$%&'*+\-/=?^_`{|}~]+(?:\.[a-z0-9!#$%&'*+\-/=?^_`{|}~]+)*$/i.test(
      local,
    ) ||
    domain.length > 253
  ) {
    return false;
  }
  const labels = domain.split('.');
  return (
    labels.length >= 2 &&
    labels.every(
      (label) =>
        label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
    )
  );
}

export function readReminderEmailConfig(
  env: NodeJS.ProcessEnv = process.env,
): ReminderEmailConfig {
  const flag = env.EVENT_REMINDER_EMAIL_ENABLED;
  if (flag === undefined || flag === 'false') return { enabled: false };
  if (flag !== 'true') throw new Error('REMINDER_EMAIL_CONFIG_INVALID');

  const rawProvider = env.EMAIL_PROVIDER ?? 'resend';
  if (rawProvider !== 'resend' && rawProvider !== 'gmail-smtp') {
    throw new Error('REMINDER_EMAIL_CONFIG_INVALID');
  }
  const provider: ReminderEmailProvider = rawProvider;

  const from = env.EMAIL_FROM;
  const rawFromName = env.EMAIL_FROM_NAME;
  let fromName = 'UniHub';
  if (rawFromName !== undefined) {
    const trimmed = rawFromName.trim();
    if (trimmed.length > 0) {
      if (/[\r\n]/.test(rawFromName) || trimmed.length > 100) {
        throw new Error('REMINDER_EMAIL_CONFIG_INVALID');
      }
      fromName = trimmed;
    }
  }
  const namespace = env.EMAIL_IDEMPOTENCY_NAMESPACE;
  if (
    !from ||
    !isMailbox(from) ||
    !namespace ||
    namespace.length > 64 ||
    /[^a-z0-9-]/.test(namespace)
  ) {
    throw new Error('REMINDER_EMAIL_CONFIG_INVALID');
  }

  let base: URL;
  try {
    base = new URL(env.APP_BASE_URL ?? '');
  } catch {
    throw new Error('REMINDER_EMAIL_CONFIG_INVALID');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (
    (base.protocol !== 'https:' &&
      !(base.protocol === 'http:' && local && env.NODE_ENV !== 'production')) ||
    base.username ||
    base.password ||
    base.pathname !== '/' ||
    base.search ||
    base.hash
  ) {
    throw new Error('REMINDER_EMAIL_CONFIG_INVALID');
  }

  return Object.freeze({
    enabled: true,
    provider,
    from,
    fromName,
    namespace,
    calendarUrl: new URL('/calendar', base).href,
  });
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

export function freezeReminderEmail(
  config: Extract<ReminderEmailConfig, { enabled: true }>,
  event: { title: string; due_date: Date },
  recipient: string,
  notificationId: number,
): { payload_json: string; idempotency_key: string } {
  if (!isMailbox(recipient)) {
    throw new Error('REMINDER_EMAIL_RECIPIENT_INVALID');
  }
  if (
    !Number.isInteger(notificationId) ||
    notificationId <= 0 ||
    notificationId > 2_147_483_647 ||
    !Number.isFinite(event.due_date.getTime())
  ) {
    throw new Error('REMINDER_EMAIL_PAYLOAD_INVALID');
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(event.due_date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)!.value;
  const deadline = `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}:${part('second')} (Asia/Ho_Chi_Minh, UTC+07:00)`;

  return {
    payload_json: JSON.stringify({
      from: config.from,
      to: [recipient],
      subject: 'UniHub — Nhắc hạn sự kiện',
      html: `<p>Nhắc hạn sự kiện: ${escapeHtml(event.title)}</p><p>Hạn chót: ${deadline}</p><p><a href="${escapeHtml(config.calendarUrl)}">Mở lịch UniHub</a></p>`,
      text: `Nhắc hạn sự kiện: ${event.title}\nHạn chót: ${deadline}\nMở lịch UniHub: ${config.calendarUrl}`,
    }),
    idempotency_key: `unihub/${config.namespace}/event-reminder/${notificationId}`,
  };
}
