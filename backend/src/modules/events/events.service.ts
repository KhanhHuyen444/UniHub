import { ApiError } from '../../middleware/errors.js';
import type {
  CreateEventInput,
  EventDto,
  EventPrismaClient,
  EventStatus,
  PatchEventInput,
} from './events.types.js';

export const MAX_MYSQL_INT = 2_147_483_647;
export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;
export const ISO_Z_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export function formatInstant(value: Date): string {
  return value.toISOString().replace('.000Z', 'Z');
}

export function parseStrictUtcIsoDate(raw: string): Date | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/.exec(
      raw,
    );
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const ms = match[7] ? Number(match[7].padEnd(3, '0').slice(0, 3)) : 0;

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  const date = new Date(raw);
  if (isNaN(date.getTime())) return null;

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second ||
    date.getUTCMilliseconds() !== ms
  ) {
    return null;
  }

  return date;
}

export function isVietnamMidnight(date: Date): boolean {
  if (date.getUTCMilliseconds() !== 0) return false;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: VIETNAM_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  const second = parts.find((p) => p.type === 'second')?.value;

  return (hour === '00' || hour === '24') && minute === '00' && second === '00';
}

export function parseEventsQuery(originalUrl: string): {
  from: Date;
  to: Date;
} {
  const url = new URL(originalUrl, 'http://unihub.invalid');
  const params = url.searchParams;
  const entries = [...params.entries()];
  const fromList = params.getAll('from');
  const toList = params.getAll('to');

  if (entries.length !== 2 || fromList.length !== 1 || toList.length !== 1) {
    throw new ApiError(400, 'INVALID_QUERY', 'Tham số truy vấn không hợp lệ.');
  }

  const rawFrom = fromList[0];
  const rawTo = toList[0];

  const from = parseStrictUtcIsoDate(rawFrom);
  const to = parseStrictUtcIsoDate(rawTo);

  if (!from || !to) {
    throw new ApiError(400, 'INVALID_QUERY', 'Tham số truy vấn không hợp lệ.');
  }

  if (!isVietnamMidnight(from) || !isVietnamMidnight(to)) {
    throw new ApiError(
      400,
      'INVALID_QUERY',
      'Khoảng thời gian phải đúng nửa đêm theo giờ Việt Nam.',
    );
  }

  const diffMs = to.getTime() - from.getTime();
  const diffDays = diffMs / ONE_DAY_MS;

  if (diffDays <= 0 || diffDays > 42 || diffMs % ONE_DAY_MS !== 0) {
    throw new ApiError(
      400,
      'INVALID_QUERY',
      'Khoảng thời gian truy vấn không hợp lệ hoặc vượt quá 42 ngày.',
    );
  }

  return { from, to };
}

export function parseEventId(rawId: string): number {
  if (!/^[1-9]\d*$/.test(rawId)) {
    throw new ApiError(400, 'INVALID_ID', 'Mã sự kiện không hợp lệ.');
  }
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1 || id > MAX_MYSQL_INT) {
    throw new ApiError(400, 'INVALID_ID', 'Mã sự kiện không hợp lệ.');
  }
  return id;
}

export function parseCreateEventInput(
  body: unknown,
  evaluatedAt: Date,
): CreateEventInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Dữ liệu yêu cầu không hợp lệ.');
  }

  const allowedKeys = new Set(['title', 'dueDate', 'remindBefore', 'notes']);
  const keys = Object.keys(body);
  for (const key of keys) {
    if (!allowedKeys.has(key)) {
      throw new ApiError(
        400,
        'INVALID_REQUEST',
        'Dữ liệu yêu cầu chứa trường không được hỗ trợ.',
      );
    }
  }

  const raw = body as Record<string, unknown>;
  if (raw.title === undefined || raw.dueDate === undefined) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Thiếu tiêu đề hoặc hạn chót.');
  }

  if (typeof raw.title !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Tiêu đề không hợp lệ.');
  }
  const trimmedTitle = raw.title.trim();
  if (trimmedTitle.length < 1 || trimmedTitle.length > 255) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Tiêu đề phải từ 1 đến 255 ký tự.',
    );
  }

  if (typeof raw.dueDate !== 'string') {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Hạn chót phải theo định dạng UTC ISO 8601.',
    );
  }
  const dueDate = parseStrictUtcIsoDate(raw.dueDate);
  if (!dueDate) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Hạn chót không hợp lệ hoặc không phải ngày lịch tồn tại.',
    );
  }
  if (dueDate.getTime() <= evaluatedAt.getTime()) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Hạn chót phải lớn hơn thời điểm hiện tại.',
    );
  }

  let remindBefore = 24;
  if (raw.remindBefore !== undefined) {
    if (
      typeof raw.remindBefore !== 'number' ||
      !Number.isInteger(raw.remindBefore) ||
      raw.remindBefore < 0 ||
      raw.remindBefore > MAX_MYSQL_INT
    ) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Thời gian nhắc trước phải là số nguyên trong khoảng 0 đến 2147483647.',
      );
    }
    remindBefore = raw.remindBefore;
  }

  let notes: string | null = null;
  if (raw.notes !== undefined && raw.notes !== null) {
    if (typeof raw.notes !== 'string' || raw.notes.length > 1000) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Ghi chú không được vượt quá 1000 ký tự.',
      );
    }
    notes = raw.notes;
  }

  return {
    title: trimmedTitle,
    dueDate,
    remindBefore,
    notes,
  };
}

export function parsePatchEventInput(
  body: unknown,
  evaluatedAt: Date,
): PatchEventInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Dữ liệu yêu cầu không hợp lệ.');
  }

  const allowedKeys = new Set(['title', 'dueDate', 'remindBefore', 'notes']);
  const keys = Object.keys(body);
  if (keys.length === 0) {
    throw new ApiError(
      400,
      'INVALID_REQUEST',
      'Dữ liệu patch phải chứa ít nhất một trường.',
    );
  }
  for (const key of keys) {
    if (!allowedKeys.has(key)) {
      throw new ApiError(
        400,
        'INVALID_REQUEST',
        'Dữ liệu yêu cầu chứa trường không được hỗ trợ.',
      );
    }
  }

  const raw = body as Record<string, unknown>;
  let title: string | undefined;
  let dueDate: Date | undefined;
  let remindBefore: number | undefined;
  let notes: string | null | undefined;

  if ('title' in raw) {
    if (typeof raw.title !== 'string') {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Tiêu đề không hợp lệ.');
    }
    const trimmed = raw.title.trim();
    if (trimmed.length < 1 || trimmed.length > 255) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Tiêu đề phải từ 1 đến 255 ký tự.',
      );
    }
    title = trimmed;
  }

  if ('dueDate' in raw) {
    if (typeof raw.dueDate !== 'string') {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Hạn chót phải theo định dạng UTC ISO 8601.',
      );
    }
    const parsed = parseStrictUtcIsoDate(raw.dueDate);
    if (!parsed) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Hạn chót không hợp lệ hoặc không phải ngày lịch tồn tại.',
      );
    }
    if (parsed.getTime() <= evaluatedAt.getTime()) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Hạn chót mới phải lớn hơn thời điểm hiện tại.',
      );
    }
    dueDate = parsed;
  }

  if ('remindBefore' in raw) {
    if (
      typeof raw.remindBefore !== 'number' ||
      !Number.isInteger(raw.remindBefore) ||
      raw.remindBefore < 0 ||
      raw.remindBefore > MAX_MYSQL_INT
    ) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Thời gian nhắc trước phải là số nguyên trong khoảng 0 đến 2147483647.',
      );
    }
    remindBefore = raw.remindBefore;
  }

  if ('notes' in raw) {
    if (raw.notes === null) {
      notes = null;
    } else if (typeof raw.notes === 'string') {
      if (raw.notes.length > 1000) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'Ghi chú không được vượt quá 1000 ký tự.',
        );
      }
      notes = raw.notes;
    } else {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Ghi chú không hợp lệ.');
    }
  }

  return { title, dueDate, remindBefore, notes };
}

export function parsePatchStatusInput(body: unknown): 'Completed' {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Dữ liệu yêu cầu không hợp lệ.');
  }
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== 'status') {
    throw new ApiError(400, 'INVALID_REQUEST', 'Dữ liệu yêu cầu không hợp lệ.');
  }
  const raw = body as { status?: unknown };
  if (raw.status !== 'Completed') {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Student chỉ được chọn Completed; không nhận Upcoming/Overdue.',
    );
  }
  return 'Completed';
}

export function toEventDto(event: {
  event_id: number;
  title: string;
  due_date: Date;
  remind_before: number;
  notes: string | null;
  status: string;
  reminded_at: Date | null;
  created_at: Date;
  updated_at: Date;
}): EventDto {
  return {
    id: event.event_id,
    title: event.title,
    dueDate: formatInstant(event.due_date),
    remindBefore: event.remind_before,
    notes: event.notes,
    status: event.status as EventStatus,
    remindedAt: event.reminded_at ? formatInstant(event.reminded_at) : null,
    createdAt: formatInstant(event.created_at),
    updatedAt: formatInstant(event.updated_at),
  };
}

async function runInTransaction<T>(
  client: EventPrismaClient,
  operation: (tx: any) => Promise<T>,
  serializable = false,
): Promise<T> {
  if (serializable && typeof client.$transaction === 'function') {
    // Retry the entire read/compute/write operation on serialization conflicts.
    for (let attempt = 0; ; attempt++) {
      try {
        return await client.$transaction(operation, {
          isolationLevel: 'Serializable',
        });
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
  if (typeof client.$transaction === 'function') {
    return client.$transaction(operation);
  }
  return operation(client);
}

export async function listEvents(
  client: EventPrismaClient,
  userId: number,
  originalUrl: string,
): Promise<{ items: EventDto[] }> {
  const { from, to } = parseEventsQuery(originalUrl);
  const events = await client.event.findMany({
    where: {
      user_id: userId,
      due_date: {
        gte: from,
        lt: to,
      },
    },
    orderBy: [{ due_date: 'asc' }, { event_id: 'asc' }],
  });
  return { items: events.map(toEventDto) };
}

export async function createEvent(
  client: EventPrismaClient,
  userId: number,
  body: unknown,
  evaluatedAt: Date,
): Promise<{ event: EventDto }> {
  const input = parseCreateEventInput(body, evaluatedAt);
  const created = await client.event.create({
    data: {
      user_id: userId,
      title: input.title,
      due_date: input.dueDate,
      remind_before: input.remindBefore,
      notes: input.notes,
      status: 'Upcoming',
      reminded_at: null,
    },
  });
  return { event: toEventDto(created) };
}

export async function getEvent(
  client: EventPrismaClient,
  userId: number,
  rawId: string,
): Promise<{ event: EventDto }> {
  const eventId = parseEventId(rawId);
  const existing = await client.event.findFirst({
    where: { event_id: eventId, user_id: userId },
  });
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện.');
  }
  return { event: toEventDto(existing) };
}

export async function patchEvent(
  client: EventPrismaClient,
  userId: number,
  rawId: string,
  body: unknown,
  evaluatedAt: Date,
): Promise<{ event: EventDto }> {
  const eventId = parseEventId(rawId);
  const input = parsePatchEventInput(body, evaluatedAt);

  return runInTransaction(
    client,
    async (tx) => {
      const existing = await tx.event.findFirst({
        where: { event_id: eventId, user_id: userId },
      });
      if (!existing) {
        throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện.');
      }

      const dueDateChanged =
        input.dueDate !== undefined &&
        input.dueDate.getTime() !== existing.due_date.getTime();
      const remindBeforeChanged =
        input.remindBefore !== undefined &&
        input.remindBefore !== existing.remind_before;
      const shouldResetReminder = dueDateChanged || remindBeforeChanged;

      if (shouldResetReminder) {
        await tx.notification.deleteMany({
          where: {
            event_id: eventId,
            user_id: userId,
            type: 'Reminder',
          },
        });
      }

      const updateFields = {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
        ...(input.remindBefore !== undefined
          ? { remind_before: input.remindBefore }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(shouldResetReminder ? { reminded_at: null } : {}),
      };

      if (existing.status === 'Completed') {
        await tx.event.updateMany({
          where: { event_id: eventId, user_id: userId },
          data: {
            ...updateFields,
            status: 'Completed',
          },
        });
      } else {
        const effectiveDueDate = input.dueDate ?? existing.due_date;
        const calculatedStatus: EventStatus =
          effectiveDueDate.getTime() > evaluatedAt.getTime()
            ? 'Upcoming'
            : 'Overdue';

        const updateResult = await tx.event.updateMany({
          where: {
            event_id: eventId,
            user_id: userId,
            status: { not: 'Completed' },
          },
          data: {
            ...updateFields,
            status: calculatedStatus,
          },
        });

        if (updateResult.count === 0) {
          const recheck = await tx.event.findFirst({
            where: { event_id: eventId, user_id: userId },
          });
          if (!recheck) {
            throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện.');
          }
          await tx.event.updateMany({
            where: { event_id: eventId, user_id: userId },
            data: {
              ...updateFields,
              status: 'Completed',
            },
          });
        }
      }

      const updated = await tx.event.findFirst({
        where: { event_id: eventId, user_id: userId },
      });
      if (!updated) {
        throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện.');
      }

      return { event: toEventDto(updated) };
    },
    true,
  );
}

export async function patchEventStatus(
  client: EventPrismaClient,
  userId: number,
  rawId: string,
  body: unknown,
): Promise<{ event: EventDto }> {
  const eventId = parseEventId(rawId);
  parsePatchStatusInput(body);

  return runInTransaction(client, async (tx) => {
    const existing = await tx.event.findFirst({
      where: { event_id: eventId, user_id: userId },
    });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện.');
    }

    if (existing.status === 'Completed') {
      return { event: toEventDto(existing) };
    }

    await tx.event.updateMany({
      where: { event_id: eventId, user_id: userId },
      data: { status: 'Completed' },
    });

    const updated = await tx.event.findFirst({
      where: { event_id: eventId, user_id: userId },
    });
    if (!updated) {
      throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện.');
    }

    return { event: toEventDto(updated) };
  });
}

export async function deleteEvent(
  client: EventPrismaClient,
  userId: number,
  rawId: string,
): Promise<void> {
  const eventId = parseEventId(rawId);
  return runInTransaction(client, async (tx) => {
    const existing = await tx.event.findFirst({
      where: { event_id: eventId, user_id: userId },
      select: { event_id: true },
    });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện.');
    }
    await tx.event.delete({
      where: { event_id: eventId },
    });
  });
}
