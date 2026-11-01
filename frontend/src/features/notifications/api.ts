import { ApiError } from '../../lib/api';
import { protectedApiRequest } from '../auth/auth-api';

export interface NotificationItem {
  id: number;
  type: 'Reminder' | 'Violation';
  content: string;
  isRead: boolean;
  createdAt: string;
  eventId: number | null;
}
export interface NotificationPage {
  items: NotificationItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  unreadCount: number;
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (
  v: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
function invalid(): never {
  throw new ApiError('Dữ liệu thông báo không hợp lệ.', {
    code: 'INVALID_RESPONSE',
    kind: 'response',
  });
}
export function parseNotifications(value: unknown): NotificationPage {
  if (!record(value) || !Array.isArray(value.items) || !record(value.meta))
    return invalid();
  const { meta } = value;
  if (
    !integer(meta.page, 1, 1_000_000) ||
    !integer(meta.pageSize, 1, 100) ||
    !integer(meta.total) ||
    !integer(meta.totalPages) ||
    meta.totalPages !== Math.ceil(meta.total / meta.pageSize) ||
    !integer(value.unreadCount) ||
    value.unreadCount > meta.total ||
    value.items.length > meta.pageSize
  )
    return invalid();
  const items = value.items.map((v): NotificationItem => {
    if (
      !record(v) ||
      !integer(v.id, 1, 2147483647) ||
      typeof v.content !== 'string' ||
      v.content.length > 500 ||
      typeof v.isRead !== 'boolean' ||
      typeof v.createdAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(
        v.createdAt,
      ) ||
      !Number.isFinite(Date.parse(v.createdAt)) ||
      new Date(v.createdAt).toISOString().slice(0, 19) !==
        v.createdAt.slice(0, 19) ||
      !(
        (v.type === 'Reminder' && integer(v.eventId, 1, 2147483647)) ||
        (v.type === 'Violation' && v.eventId === null)
      )
    )
      return invalid();
    return {
      id: v.id,
      type: v.type as NotificationItem['type'],
      content: v.content,
      isRead: v.isRead,
      createdAt: v.createdAt,
      eventId: v.eventId as number | null,
    };
  });
  if (new Set(items.map((v) => v.id)).size !== items.length) return invalid();
  return {
    items,
    meta: {
      page: meta.page,
      pageSize: meta.pageSize,
      total: meta.total,
      totalPages: meta.totalPages,
    },
    unreadCount: value.unreadCount,
  };
}
export async function listNotifications(page = 1, signal?: AbortSignal) {
  return parseNotifications(
    await protectedApiRequest('/api/notifications', {
      query: new URLSearchParams({ page: String(page), pageSize: '20' }),
      signal,
    }),
  );
}
export async function markNotificationRead(id: number, signal?: AbortSignal) {
  const value = await protectedApiRequest<unknown>(
    `/api/notifications/${id}/read`,
    { method: 'PATCH', signal },
  );
  if (
    !record(value) ||
    !record(value.notification) ||
    value.notification.id !== id ||
    value.notification.isRead !== true
  )
    return invalid();
}
export function notificationDestination(item: NotificationItem): string | null {
  return item.type === 'Violation' ? '/forum' : null;
}

export interface NotificationEvent {
  id: number;
  title: string;
  dueDate: string;
  notes: string | null;
}
export async function getNotificationEvent(
  id: number,
  signal?: AbortSignal,
): Promise<NotificationEvent> {
  const value = await protectedApiRequest<unknown>(`/api/events/${id}`, {
    signal,
  });
  if (!record(value) || !record(value.event)) return invalid();
  const event = value.event;
  if (
    event.id !== id ||
    typeof event.title !== 'string' ||
    !event.title.trim() ||
    event.title.length > 255 ||
    typeof event.dueDate !== 'string' ||
    !event.dueDate.endsWith('Z') ||
    !Number.isFinite(Date.parse(event.dueDate)) ||
    !(
      event.notes === null ||
      (typeof event.notes === 'string' && event.notes.length <= 1000)
    )
  )
    return invalid();
  return { id, title: event.title, dueDate: event.dueDate, notes: event.notes };
}
