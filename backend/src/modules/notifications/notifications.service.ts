import type { PrismaClient } from '../../generated/prisma/client.js';
import { ApiError } from '../../middleware/errors.js';

function invalidQuery(): never {
  throw new ApiError(400, 'INVALID_QUERY', 'Tham số truy vấn không hợp lệ.');
}

export function parseNotificationQuery(originalUrl: string) {
  const params = new URL(originalUrl, 'http://unihub.invalid').searchParams;
  for (const key of params.keys()) {
    if (!['page', 'pageSize'].includes(key) || params.getAll(key).length !== 1)
      invalidQuery();
  }
  const integer = (key: string, fallback: number, maximum: number) => {
    const value = params.get(key);
    if (value === null) return fallback;
    if (!/^[1-9]\d*$/.test(value) || Number(value) > maximum) invalidQuery();
    return Number(value);
  };
  return {
    page: integer('page', 1, 1_000_000),
    pageSize: integer('pageSize', 20, 100),
  };
}

export async function listNotifications(
  client: PrismaClient,
  userId: number,
  originalUrl: string,
) {
  const { page, pageSize } = parseNotificationQuery(originalUrl);
  // All three reads share a repeatable-read snapshot even if another request marks a row read.
  return client.$transaction(
    async (tx) => {
      const where = { user_id: userId };
      const rows = await tx.notification.findMany({
        where,
        select: {
          notification_id: true,
          type: true,
          content: true,
          is_read: true,
          created_at: true,
          event_id: true,
        },
        orderBy: [{ created_at: 'desc' }, { notification_id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      const total = await tx.notification.count({ where });
      const unreadCount = await tx.notification.count({
        where: { ...where, is_read: false },
      });
      return {
        items: rows.map((row) => ({
          id: row.notification_id,
          type: row.type,
          content: row.content,
          isRead: row.is_read,
          createdAt: row.created_at.toISOString().replace('.000Z', 'Z'),
          eventId: row.event_id,
        })),
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
        unreadCount,
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}

export async function markNotificationRead(
  client: PrismaClient,
  userId: number,
  rawId: string,
) {
  if (!/^[1-9]\d*$/.test(rawId) || Number(rawId) > 2_147_483_647)
    throw new ApiError(400, 'INVALID_ID', 'Mã thông báo không hợp lệ.');
  const id = Number(rawId);
  const where = { notification_id: id, user_id: userId };
  const updated = await client.notification.updateMany({
    where: { ...where, is_read: false },
    data: { is_read: true },
  });
  if (
    updated.count === 0 &&
    !(await client.notification.findFirst({
      where,
      select: { notification_id: true },
    }))
  )
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy thông báo.');
  return { notification: { id, isRead: true } };
}
