import { ApiError } from '../../lib/api';

export type EventStatus = 'Upcoming' | 'Overdue' | 'Completed';
export interface CalendarEvent {
  id: number;
  title: string;
  dueDate: string;
  remindBefore: number;
  notes: string | null;
  status: EventStatus;
  remindedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export type EventInput = Pick<
  CalendarEvent,
  'title' | 'dueDate' | 'remindBefore' | 'notes'
>;
export type EventDraft = {
  title: string;
  date: string;
  time: string;
  remindBefore: string;
  notes: string;
};
const DAY = 86400000;
export const statusLabels: Record<EventStatus, string> = {
  Upcoming: 'Sắp đến hạn',
  Overdue: 'Quá hạn',
  Completed: 'Đã hoàn thành',
};
export function localDate(instant: string | Date): string {
  return new Date(new Date(instant).getTime() + 7 * 3600000)
    .toISOString()
    .slice(0, 10);
}
export function localTime(instant: string): string {
  return new Date(new Date(instant).getTime() + 7 * 3600000)
    .toISOString()
    .slice(11, 19);
}
export function displayDate(instant: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(instant));
}
export function calendarRange(month: string) {
  const first = new Date(`${month}-01T00:00:00Z`);
  const start = first.getTime() - ((first.getUTCDay() + 6) % 7) * DAY;
  const next = new Date(first);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const count = Math.ceil((next.getTime() - start) / DAY / 7) * 7;
  const days = Array.from({ length: count }, (_, i) =>
    new Date(start + i * DAY).toISOString().slice(0, 10),
  );
  return {
    days,
    from: new Date(start - 7 * 3600000).toISOString(),
    to: new Date(start + count * DAY - 7 * 3600000).toISOString(),
  };
}
export function shiftMonth(month: string, delta: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}
export function eventDraft(
  event?: CalendarEvent,
  date = localDate(new Date()),
): EventDraft {
  return {
    title: event?.title ?? '',
    date: event ? localDate(event.dueDate) : date,
    time: event ? localTime(event.dueDate) : '23:59:00',
    remindBefore: String(event?.remindBefore ?? 24),
    notes: event?.notes ?? '',
  };
}
export function prepareEvent(
  draft: EventDraft,
  original?: CalendarEvent,
  now = Date.now(),
) {
  const errors: Partial<Record<keyof EventDraft, string>> = {};
  const title = draft.title.trim();
  if (!title || title.length > 255)
    errors.title = 'Tiêu đề phải từ 1 đến 255 ký tự.';
  const due = new Date(`${draft.date}T${draft.time}+07:00`);
  const validDate =
    Number.isFinite(due.getTime()) && localDate(due) === draft.date;
  const dueChanged =
    !original || (validDate && due.getTime() !== Date.parse(original.dueDate));
  if (!validDate) errors.date = 'Vui lòng nhập ngày và giờ hợp lệ.';
  else if (dueChanged && due.getTime() <= now)
    errors.date =
      'Hạn chót mới phải lớn hơn thời điểm hiện tại (giờ Việt Nam).';
  const remindBefore = Number(draft.remindBefore);
  if (
    !draft.remindBefore.trim() ||
    !Number.isInteger(remindBefore) ||
    remindBefore < 0 ||
    remindBefore > 2147483647
  )
    errors.remindBefore = 'Nhập số nguyên từ 0 đến 2147483647.';
  if (draft.notes.length > 1000) errors.notes = 'Ghi chú tối đa 1000 ký tự.';
  const input: EventInput = {
    title,
    dueDate: validDate ? due.toISOString() : '',
    remindBefore,
    notes: draft.notes === '' ? null : draft.notes,
  };
  const patch: Partial<EventInput> = {};
  if (original) {
    if (title !== original.title) patch.title = title;
    if (dueChanged) patch.dueDate = input.dueDate;
    if (remindBefore !== original.remindBefore)
      patch.remindBefore = remindBefore;
    if (
      input.notes !== original.notes &&
      !(original.notes === '' && input.notes === null)
    )
      patch.notes = input.notes;
  }
  return { errors, input, patch };
}
function invalid(): never {
  throw new ApiError('Dữ liệu sự kiện không hợp lệ.', {
    code: 'INVALID_RESPONSE',
    kind: 'response',
  });
}
function instant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 19) === value.slice(0, 19)
  );
}
export function parseEvent(value: unknown): CalendarEvent {
  if (!value || typeof value !== 'object') return invalid();
  const v = value as CalendarEvent;
  if (
    !Number.isInteger(v.id) ||
    v.id < 1 ||
    v.id > 2147483647 ||
    typeof v.title !== 'string' ||
    !v.title.trim() ||
    v.title.length > 255 ||
    !instant(v.dueDate) ||
    !instant(v.createdAt) ||
    !instant(v.updatedAt) ||
    !(v.remindedAt === null || instant(v.remindedAt)) ||
    !Number.isInteger(v.remindBefore) ||
    v.remindBefore < 0 ||
    v.remindBefore > 2147483647 ||
    !(
      v.notes === null ||
      (typeof v.notes === 'string' && v.notes.length <= 1000)
    ) ||
    !Object.hasOwn(statusLabels, v.status)
  )
    return invalid();
  return {
    id: v.id,
    title: v.title,
    dueDate: v.dueDate,
    remindBefore: v.remindBefore,
    notes: v.notes,
    status: v.status,
    remindedAt: v.remindedAt,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}
export function parseEvents(value: unknown): CalendarEvent[] {
  if (
    !value ||
    typeof value !== 'object' ||
    !('items' in value) ||
    !Array.isArray(value.items)
  )
    return invalid();
  const items = value.items.map(parseEvent);
  if (new Set(items.map((e) => e.id)).size !== items.length) return invalid();
  return items;
}
export function eventError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (error.status === 403) return 'Chức năng này chỉ dành cho Student.';
    if (error.status === 404)
      return 'Sự kiện không còn tồn tại hoặc bạn không có quyền truy cập. Hãy tải lại lịch.';
    return error.message;
  }
  return 'Không thể xử lý sự kiện. Vui lòng thử lại.';
}
