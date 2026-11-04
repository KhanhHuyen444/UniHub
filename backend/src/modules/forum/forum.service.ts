import type { PrismaClient } from '../../generated/prisma/client.js';
import { ApiError } from '../../middleware/errors.js';

const MAX_MYSQL_INT = 2_147_483_647;
const ALLOWED_TOPICS = new Set([
  'Học tập',
  'Thực tập',
  'Kinh nghiệm phỏng vấn',
]);
const ALLOWED_LIST_QUERY_KEYS = new Set(['page', 'pageSize', 'topic']);
const ALLOWED_COMMENT_QUERY_KEYS = new Set(['page', 'pageSize']);

export type ForumReadClient = Pick<
  PrismaClient,
  'forumPost' | 'comment' | '$transaction'
>;
export type ForumWriteClient = ForumReadClient;

type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireExactBody(value: unknown, fields: string[]): JsonObject {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== fields.length ||
    fields.some((field) => !Object.hasOwn(value, field))
  ) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Dữ liệu gửi lên không hợp lệ.');
  }
  return value;
}

/** Normalize to plain text. React renders this as text; markup is never trusted. */
function sanitizePlainText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

function validateText(value: unknown, field: string, maxBytes: number): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} không hợp lệ.`);
  }
  const text = sanitizePlainText(value);
  if (!text || new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} không hợp lệ.`);
  }
  return text;
}

function parsePostBody(value: unknown) {
  const body = requireExactBody(value, ['topic', 'title', 'content']);
  if (typeof body.topic !== 'string' || !ALLOWED_TOPICS.has(body.topic)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Chủ đề không hợp lệ.');
  }
  const title = validateText(body.title, 'Tiêu đề', 1020);
  if ([...title].length > 255) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Tiêu đề không hợp lệ.');
  }
  return {
    topic: body.topic,
    title,
    content: validateText(body.content, 'Nội dung', 65_535),
  };
}

function parseCommentBody(value: unknown) {
  const body = requireExactBody(value, ['content']);
  return { content: validateText(body.content, 'Nội dung bình luận', 65_535) };
}

// ---------------------------------------------------------------------------
// ID validation
// ---------------------------------------------------------------------------

export function parseForumId(rawId: string, label: string): number {
  if (!/^\d+$/.test(rawId)) {
    throw new ApiError(400, 'INVALID_ID', `${label} không hợp lệ.`);
  }
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1 || id > MAX_MYSQL_INT) {
    throw new ApiError(400, 'INVALID_ID', `${label} không hợp lệ.`);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Pagination query parser
// ---------------------------------------------------------------------------

interface PageQuery {
  page: number;
  pageSize: number;
}

function parseBoundedInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
  errorCode: 'INVALID_QUERY',
): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) {
    throw new ApiError(400, errorCode, 'Tham số truy vấn không hợp lệ.');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new ApiError(400, errorCode, 'Tham số truy vấn không hợp lệ.');
  }
  return parsed;
}

function readPageQuery(
  originalUrl: string,
  allowedKeys: Set<string>,
): PageQuery & { topic?: string } {
  const url = new URL(originalUrl, 'http://unihub.invalid');
  const seen = new Map<string, string>();

  for (const [key, value] of url.searchParams) {
    if (!allowedKeys.has(key) || seen.has(key)) {
      throw new ApiError(
        400,
        'INVALID_QUERY',
        'Tham số truy vấn không hợp lệ.',
      );
    }
    seen.set(key, value);
  }

  const page = parseBoundedInt(
    seen.get('page'),
    1,
    1,
    1_000_000,
    'INVALID_QUERY',
  );
  const pageSize = parseBoundedInt(
    seen.get('pageSize'),
    20,
    1,
    100,
    'INVALID_QUERY',
  );
  const result: PageQuery & { topic?: string } = { page, pageSize };

  const rawTopic = seen.get('topic');
  if (rawTopic !== undefined) {
    if (!ALLOWED_TOPICS.has(rawTopic)) {
      throw new ApiError(
        400,
        'INVALID_QUERY',
        'Tham số truy vấn không hợp lệ.',
      );
    }
    result.topic = rawTopic;
  }

  return result;
}

// ---------------------------------------------------------------------------
// DTO mappers
// ---------------------------------------------------------------------------

function formatInstant(date: Date): string {
  return date.toISOString().replace('.000Z', 'Z');
}

interface PostRow {
  post_id: number;
  topic: string;
  title: string;
  content: string;
  created_at: Date;
  author: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface CommentRow {
  comment_id: number;
  content: string;
  created_at: Date;
  author: {
    full_name: string;
    avatar_url: string | null;
  };
}

function toPostDto(row: PostRow) {
  return {
    id: row.post_id,
    title: row.title,
    topic: row.topic,
    content: row.content,
    author: {
      fullName: row.author.full_name,
      avatarUrl: row.author.avatar_url,
    },
    createdAt: formatInstant(row.created_at),
  };
}

function toCommentDto(row: CommentRow) {
  return {
    id: row.comment_id,
    content: row.content,
    author: {
      fullName: row.author.full_name,
      avatarUrl: row.author.avatar_url,
    },
    createdAt: formatInstant(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// Author select — only fullName + avatarUrl, never userId/email/sub
// ---------------------------------------------------------------------------

const authorSelect = {
  full_name: true,
  avatar_url: true,
} as const;

// ---------------------------------------------------------------------------
// listPublicPosts
// ---------------------------------------------------------------------------

export async function listPublicPosts(
  client: ForumReadClient,
  originalUrl: string,
) {
  const { page, pageSize, topic } = readPageQuery(
    originalUrl,
    ALLOWED_LIST_QUERY_KEYS,
  );
  const offset = (page - 1) * pageSize;

  const where = {
    is_deleted: false,
    ...(topic ? { topic } : {}),
  } as const;

  const [total, rows] = await (client as PrismaClient).$transaction([
    (client as PrismaClient).forumPost.count({ where }),
    (client as PrismaClient).forumPost.findMany({
      where,
      select: {
        post_id: true,
        topic: true,
        title: true,
        content: true,
        created_at: true,
        author: { select: authorSelect },
      },
      orderBy: [{ created_at: 'desc' }, { post_id: 'desc' }],
      skip: offset,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(toPostDto),
    meta: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  };
}

// ---------------------------------------------------------------------------
// getPublicPost
// ---------------------------------------------------------------------------

export async function getPublicPost(client: ForumReadClient, rawId: string) {
  const id = parseForumId(rawId, 'Mã bài viết');

  const row = await (client as PrismaClient).forumPost.findFirst({
    where: { post_id: id, is_deleted: false },
    select: {
      post_id: true,
      topic: true,
      title: true,
      content: true,
      created_at: true,
      author: { select: authorSelect },
    },
  });

  if (!row) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bài viết.');
  }

  return { post: toPostDto(row) };
}

// ---------------------------------------------------------------------------
// listPostComments
// ---------------------------------------------------------------------------

export async function listPostComments(
  client: ForumReadClient,
  rawPostId: string,
  originalUrl: string,
) {
  const postId = parseForumId(rawPostId, 'Mã bài viết');
  const { page, pageSize } = readPageQuery(
    originalUrl,
    ALLOWED_COMMENT_QUERY_KEYS,
  );

  // Verify parent exists and is not deleted; deleted parent → 404
  const parent = await (client as PrismaClient).forumPost.findFirst({
    where: { post_id: postId, is_deleted: false },
    select: { post_id: true },
  });
  if (!parent) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bài viết.');
  }

  const offset = (page - 1) * pageSize;

  const where = { post_id: postId, is_deleted: false } as const;

  const [total, rows] = await (client as PrismaClient).$transaction([
    (client as PrismaClient).comment.count({ where }),
    (client as PrismaClient).comment.findMany({
      where,
      select: {
        comment_id: true,
        content: true,
        created_at: true,
        author: { select: authorSelect },
      },
      orderBy: [{ created_at: 'asc' }, { comment_id: 'asc' }],
      skip: offset,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(toCommentDto),
    meta: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  };
}

// ---------------------------------------------------------------------------
// Student writes — UC-08 / UC-09
// ---------------------------------------------------------------------------

export async function createForumPost(
  client: ForumWriteClient,
  authorId: number,
  rawBody: unknown,
) {
  const data = parsePostBody(rawBody);
  const row = await client.forumPost.create({
    data: {
      author_id: authorId,
      topic: data.topic,
      title: data.title,
      content: data.content,
    },
    select: {
      post_id: true,
      topic: true,
      title: true,
      content: true,
      created_at: true,
      author: { select: authorSelect },
    },
  });
  return { post: toPostDto(row) };
}

export async function createForumComment(
  client: ForumWriteClient,
  rawPostId: string,
  authorId: number,
  rawBody: unknown,
) {
  const postId = parseForumId(rawPostId, 'Mã bài viết');
  const data = parseCommentBody(rawBody);

  const row = await (client as PrismaClient).$transaction(
    async (transaction) => {
      const parent = await transaction.forumPost.findFirst({
        where: { post_id: postId, is_deleted: false },
        select: { post_id: true },
      });
      if (!parent) {
        throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bài viết.');
      }

      return transaction.comment.create({
        data: {
          post_id: postId,
          author_id: authorId,
          content: data.content,
        },
        select: {
          comment_id: true,
          content: true,
          created_at: true,
          author: { select: authorSelect },
        },
      });
    },
  );

  return { comment: toCommentDto(row) };
}
