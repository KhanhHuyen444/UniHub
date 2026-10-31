export type ModerationTargetType = 'Post' | 'Comment';
export type ModerationTopic = 'Học tập' | 'Thực tập' | 'Kinh nghiệm phỏng vấn';

export interface ModerationAuthor {
  id: number;
  fullName: string;
  avatarUrl: string | null;
}

export interface ModerationPostItem {
  targetType: 'Post';
  id: number;
  title: string;
  topic: ModerationTopic;
  content: string;
  author: ModerationAuthor;
  createdAt: string;
}

export interface ModerationCommentItem {
  targetType: 'Comment';
  id: number;
  post: { id: number; title: string };
  content: string;
  author: ModerationAuthor;
  createdAt: string;
}

export type ModerationQueueItem = ModerationPostItem | ModerationCommentItem;

export interface ModerationQueueResponse {
  items: ModerationQueueItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface RemoveModerationTargetResponse {
  removed: {
    targetType: ModerationTargetType;
    id: number;
    isDeleted: true;
    deletedAt: string;
  };
}

export class ModerationContractError extends Error {
  readonly code = 'INVALID_RESPONSE';
  readonly kind = 'response';

  constructor() {
    super('Máy chủ trả dữ liệu kiểm duyệt không hợp lệ.');
    this.name = 'ModerationContractError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function invalidResponse(): ModerationContractError {
  return new ModerationContractError();
}

function parseAuthor(value: unknown): ModerationAuthor {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.id) ||
    typeof value.fullName !== 'string' ||
    (value.avatarUrl !== null && typeof value.avatarUrl !== 'string')
  ) {
    throw invalidResponse();
  }
  return {
    id: value.id,
    fullName: value.fullName,
    avatarUrl: value.avatarUrl,
  };
}

function parseQueueItem(value: unknown): ModerationQueueItem {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.id) ||
    typeof value.content !== 'string' ||
    !isInstant(value.createdAt)
  ) {
    throw invalidResponse();
  }

  const author = parseAuthor(value.author);
  if (value.targetType === 'Post') {
    if (
      typeof value.title !== 'string' ||
      (value.topic !== 'Học tập' &&
        value.topic !== 'Thực tập' &&
        value.topic !== 'Kinh nghiệm phỏng vấn')
    ) {
      throw invalidResponse();
    }
    return {
      targetType: 'Post',
      id: value.id,
      title: value.title,
      topic: value.topic,
      content: value.content,
      author,
      createdAt: value.createdAt,
    };
  }

  if (
    value.targetType === 'Comment' &&
    isRecord(value.post) &&
    isPositiveInteger(value.post.id) &&
    typeof value.post.title === 'string'
  ) {
    return {
      targetType: 'Comment',
      id: value.id,
      post: { id: value.post.id, title: value.post.title },
      content: value.content,
      author,
      createdAt: value.createdAt,
    };
  }
  throw invalidResponse();
}

export function parseModerationQueue(value: unknown): ModerationQueueResponse {
  if (!isRecord(value) || !Array.isArray(value.items) || !isRecord(value.meta)) {
    throw invalidResponse();
  }
  const { page, pageSize, total, totalPages } = value.meta;
  if (
    !isPositiveInteger(page) ||
    page > 1_000_000 ||
    !isPositiveInteger(pageSize) ||
    pageSize > 100 ||
    !Number.isSafeInteger(total) ||
    Number(total) < 0 ||
    !Number.isSafeInteger(totalPages) ||
    Number(totalPages) < 0 ||
    Number(totalPages) !==
      (Number(total) === 0
        ? 0
        : Math.ceil(Number(total) / Number(pageSize))) ||
    value.items.length > pageSize ||
    value.items.length > Number(total)
  ) {
    throw invalidResponse();
  }
  return {
    items: value.items.map(parseQueueItem),
    meta: {
      page,
      pageSize,
      total: Number(total),
      totalPages: Number(totalPages),
    },
  };
}

export function parseRemoveModerationTarget(
  value: unknown,
  expectedTargetType: ModerationTargetType,
  expectedId: number,
): RemoveModerationTargetResponse {
  if (!isRecord(value) || !isRecord(value.removed)) throw invalidResponse();
  const removed = value.removed;
  if (
    removed.targetType !== expectedTargetType ||
    removed.id !== expectedId ||
    removed.isDeleted !== true ||
    !isInstant(removed.deletedAt)
  ) {
    throw invalidResponse();
  }
  return {
    removed: {
      targetType: expectedTargetType,
      id: expectedId,
      isDeleted: true,
      deletedAt: removed.deletedAt,
    },
  };
}
