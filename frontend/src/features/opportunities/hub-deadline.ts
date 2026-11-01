import { formatOpportunityDate, type OpportunityDeadline } from './contracts';

function validInstant(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value))
    return false;
  const date = new Date(value);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 19) === value.slice(0, 19)
  );
}

function calendarDay(instant: string, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(instant));
    const get = (type: string) =>
      parts.find((part) => part.type === type)?.value;
    return (
      Date.parse(`${get('year')}-${get('month')}-${get('day')}T00:00:00Z`) /
      86_400_000
    );
  } catch {
    return null;
  }
}

export function hubDeadlineLabel(
  deadline: OpportunityDeadline | null,
  evaluatedAt: string,
): {
  text: string;
  variant: 'plain' | 'warning' | 'error';
} | null {
  if (
    !deadline ||
    deadline.precision === 'unknown' ||
    !validInstant(deadline.instant) ||
    !validInstant(evaluatedAt)
  )
    return null;
  const date = formatOpportunityDate(deadline.date);
  if (!date) return null;
  // Expiry is authoritative server state; never use the browser clock to override it.
  if (deadline.state === 'expired')
    return { text: `Hạn nộp: Đã hết hạn (${date})`, variant: 'error' };
  const zone =
    deadline.precision === 'date'
      ? 'Asia/Ho_Chi_Minh'
      : deadline.sourceTimeZone;
  const today = calendarDay(evaluatedAt, zone);
  // A date-only instant is next-day cutoff, not the date shown to the user.
  const due =
    deadline.precision === 'date'
      ? Date.parse(`${deadline.date}T00:00:00Z`) / 86_400_000
      : calendarDay(deadline.instant, zone);
  const days = today === null || due === null ? null : due - today;
  if (days !== null && Number.isFinite(days) && days >= 0 && days <= 7) {
    return {
      text: `Hạn nộp: ${days === 0 ? 'Hôm nay' : `Còn ${days} ngày`} (${date})`,
      variant: 'warning',
    };
  }
  return { text: `Hạn nộp: ${date}`, variant: 'plain' };
}
