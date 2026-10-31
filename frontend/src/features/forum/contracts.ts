// Forum response types and parsers — aligned with forum-api-contract.md (Approved)

export type ForumTopic = 'Học tập' | 'Thực tập' | 'Kinh nghiệm phỏng vấn';

export interface ForumAuthor {
  fullName: string;
  avatarUrl: string | null;
}

export interface ForumPost {
  id: number;
  title: string;
  topic: ForumTopic;
  content: string;
  author: ForumAuthor;
  createdAt: string;
}

export interface ForumComment {
  id: number;
  content: string;
  author: ForumAuthor;
  createdAt: string;
}

export interface ForumListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ForumListResponse {
  items: ForumPost[];
  meta: ForumListMeta;
}

export interface ForumPostResponse {
  post: ForumPost;
}

export interface ForumCommentResponse {
  comment: ForumComment;
}

export interface CommentListResponse {
  items: ForumComment[];
  meta: ForumListMeta;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_TOPICS = new Set<string>([
  'Học tập',
  'Thực tập',
  'Kinh nghiệm phỏng vấn',
]);

const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    instantPattern.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

export class ForumContractError extends Error {
  readonly code = 'INVALID_RESPONSE';
  readonly kind = 'response';

  constructor() {
    super('Máy chủ trả dữ liệu diễn đàn không hợp lệ.');
    this.name = 'ForumContractError';
  }
}

function invalidResponse(): ForumContractError {
  return new ForumContractError();
}

// ---------------------------------------------------------------------------
// Author parser — strict: only fullName + avatarUrl
// ---------------------------------------------------------------------------

function parseAuthor(value: unknown): ForumAuthor {
  if (
    !isRecord(value) ||
    typeof value.fullName !== 'string' ||
    (value.avatarUrl !== null && typeof value.avatarUrl !== 'string')
  ) {
    throw invalidResponse();
  }
  return {
    fullName: value.fullName,
    avatarUrl: value.avatarUrl as string | null,
  };
}

// ---------------------------------------------------------------------------
// Post parser
// ---------------------------------------------------------------------------

function parsePost(value: unknown): ForumPost {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.id) ||
    typeof value.title !== 'string' ||
    typeof value.topic !== 'string' ||
    !VALID_TOPICS.has(value.topic) ||
    typeof value.content !== 'string' ||
    !isInstant(value.createdAt)
  ) {
    throw invalidResponse();
  }
  return {
    id: value.id,
    title: value.title,
    topic: value.topic as ForumTopic,
    content: value.content,
    author: parseAuthor(value.author),
    createdAt: value.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Comment parser
// ---------------------------------------------------------------------------

function parseComment(value: unknown): ForumComment {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.id) ||
    typeof value.content !== 'string' ||
    !isInstant(value.createdAt)
  ) {
    throw invalidResponse();
  }
  return {
    id: value.id,
    content: value.content,
    author: parseAuthor(value.author),
    createdAt: value.createdAt,
  };
}

export function parseForumCommentResponse(
  value: unknown,
): ForumCommentResponse {
  if (!isRecord(value)) throw invalidResponse();
  return { comment: parseComment(value.comment) };
}

// ---------------------------------------------------------------------------
// Meta parser
// ---------------------------------------------------------------------------

function parseMeta(value: unknown): ForumListMeta {
  if (!isRecord(value)) throw invalidResponse();
  const { page, pageSize, total, totalPages } = value;
  if (
    !isPositiveInteger(page) ||
    page > 1_000_000 ||
    !isPositiveInteger(pageSize) ||
    pageSize > 100 ||
    !isNonNegativeInteger(total) ||
    !isNonNegativeInteger(totalPages)
  ) {
    throw invalidResponse();
  }
  const expectedTotalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  if (totalPages !== expectedTotalPages) throw invalidResponse();
  return { page, pageSize, total, totalPages };
}

// ---------------------------------------------------------------------------
// Public parsers
// ---------------------------------------------------------------------------

export function parseForumList(value: unknown): ForumListResponse {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw invalidResponse();
  }
  const meta = parseMeta(value.meta);
  const items = value.items.map(parsePost);
  if (items.length > meta.pageSize || items.length > meta.total) {
    throw invalidResponse();
  }
  return { items, meta };
}

export function parseForumPost(value: unknown): ForumPostResponse {
  if (!isRecord(value)) throw invalidResponse();
  const post = parsePost(value.post);
  return { post };
}

export function parseCommentList(value: unknown): CommentListResponse {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw invalidResponse();
  }
  const meta = parseMeta(value.meta);
  const items = value.items.map(parseComment);
  if (items.length > meta.pageSize || items.length > meta.total) {
    throw invalidResponse();
  }
  return { items, meta };
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------


/** Format ISO instant as "HH:MM DD/MM/YYYY" in Vietnam time */
export function formatForumDate(instant: string): string {
  try {
    const date = new Date(instant);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '';
  }
}

/** Format ISO instant as "DD/MM/YYYY" only */
export function formatForumDateShort(instant: string): string {
  try {
    const date = new Date(instant);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  } catch {
    return '';
  }
}

// Export topic list for UI dropdowns
export const FORUM_TOPICS: ForumTopic[] = [
  'Học tập',
  'Thực tập',
  'Kinh nghiệm phỏng vấn',
];
