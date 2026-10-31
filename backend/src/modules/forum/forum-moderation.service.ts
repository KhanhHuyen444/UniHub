import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { ApiError } from '../../middleware/errors.js';
import { writeActivityLog } from '../activity-logs/activity-logs.service.js';
import { parseForumId } from './forum.service.js';

type ForumModerationClient = Pick<
  PrismaClient,
  '$transaction' | '$queryRaw' | 'forumPost' | 'comment'
>;

interface PageQuery {
  page: number;
  pageSize: number;
}

const MAX_PAGE = 1_000_000;
const ALLOWED_QUERY_KEYS = new Set(['page', 'pageSize']);

function parsePageQuery(originalUrl: string): PageQuery {
  const params = new URL(originalUrl, 'http://unihub.invalid').searchParams;
  for (const key of params.keys()) {
    if (!ALLOWED_QUERY_KEYS.has(key) || params.getAll(key).length !== 1) {
      throw new ApiError(
        400,
        'INVALID_QUERY',
        'Tham số truy vấn không hợp lệ.',
      );
    }
  }

  const parseInt = (key: string, fallback: number, maximum: number): number => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    if (!/^\d+$/.test(raw)) {
      throw new ApiError(
        400,
        'INVALID_QUERY',
        'Tham số truy vấn không hợp lệ.',
      );
    }
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
      throw new ApiError(
        400,
        'INVALID_QUERY',
        'Tham số truy vấn không hợp lệ.',
      );
    }
    return value;
  };

  return {
    page: parseInt('page', 1, MAX_PAGE),
    pageSize: parseInt('pageSize', 20, 100),
  };
}

function parseReasonBody(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Dữ liệu gửi lên không hợp lệ.');
  }
  const keys = Object.keys(value);
  if (keys.some((key) => key !== 'reason')) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Dữ liệu gửi lên không hợp lệ.');
  }
  const reason = (value as { reason: unknown }).reason;
  if (typeof reason !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Lý do xử lý không hợp lệ.', [
      {
        source: 'body',
        field: 'reason',
        code: 'REQUIRED',
        message: 'Vui lòng nhập lý do xử lý.',
      },
    ]);
  }
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Lý do xử lý không hợp lệ.', [
      {
        source: 'body',
        field: 'reason',
        code: 'REQUIRED',
        message: 'Vui lòng nhập lý do xử lý.',
      },
    ]);
  }
  if ([...trimmed].length > 500) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Lý do xử lý không hợp lệ.', [
      {
        source: 'body',
        field: 'reason',
        code: 'MAX_LENGTH',
        message: 'Lý do xử lý không được vượt quá 500 ký tự.',
      },
    ]);
  }
  return trimmed;
}

interface ModerationQueueRow {
  targetType: 'Post' | 'Comment';
  id: number;
  title: string | null;
  topic: string | null;
  content: string;
  authorId: number;
  authorFullName: string;
  authorAvatarUrl: string | null;
  createdAt: Date;
  postId: number | null;
  postTitle: string | null;
}

export async function listModerationQueue(
  client: ForumModerationClient,
  originalUrl: string,
) {
  const { page, pageSize } = parsePageQuery(originalUrl);
  const offset = (page - 1) * pageSize;
  const [postCount, commentCount] = await Promise.all([
    client.forumPost.count({ where: { is_deleted: false } }),
    client.comment.count({ where: { is_deleted: false } }),
  ]);

  const total = postCount + commentCount;
  const rows = await client.$queryRaw<ModerationQueueRow[]>(Prisma.sql`
    SELECT 'Post' AS targetType, p.post_id AS id, p.title AS title,
      p.topic AS topic, p.content AS content, u.user_id AS authorId,
      u.full_name AS authorFullName, u.avatar_url AS authorAvatarUrl,
      p.created_at AS createdAt, NULL AS postId, NULL AS postTitle
    FROM forum_posts p
    INNER JOIN users u ON u.user_id = p.author_id
    WHERE p.is_deleted = FALSE
    UNION ALL
    SELECT 'Comment' AS targetType, c.comment_id AS id, NULL AS title,
      NULL AS topic, c.content AS content, u.user_id AS authorId,
      u.full_name AS authorFullName, u.avatar_url AS authorAvatarUrl,
      c.created_at AS createdAt, p.post_id AS postId, p.title AS postTitle
    FROM comments c
    INNER JOIN users u ON u.user_id = c.author_id
    INNER JOIN forum_posts p ON p.post_id = c.post_id
    WHERE c.is_deleted = FALSE
    ORDER BY createdAt DESC, targetType ASC, id ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `);
  const items = rows.map((row) => {
    const author = {
      id: row.authorId,
      fullName: row.authorFullName,
      avatarUrl: row.authorAvatarUrl,
    };
    const createdAt = row.createdAt.toISOString();
    if (row.targetType === 'Post') {
      return {
        targetType: 'Post' as const,
        id: row.id,
        title: row.title!,
        topic: row.topic!,
        content: row.content,
        author,
        createdAt,
      };
    }
    return {
      targetType: 'Comment' as const,
      id: row.id,
      post: { id: row.postId!, title: row.postTitle! },
      content: row.content,
      author,
      createdAt,
    };
  });

  return {
    items,
    meta: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  };
}

export async function removeForumPost(
  client: ForumModerationClient,
  postIdRaw: string,
  adminId: number,
  rawBody: unknown,
  now: () => Date = () => new Date(),
) {
  const postId = parseForumId(postIdRaw, 'Mã bài viết');
  const reason = parseReasonBody(rawBody);
  const deletedAt = now();

  return client.$transaction(async (transaction) => {
    const post = await transaction.forumPost.findUnique({
      where: { post_id: postId },
      select: { post_id: true, author_id: true, is_deleted: true },
    });
    if (!post) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bài viết.');
    if (post.is_deleted) {
      throw new ApiError(
        409,
        'CONTENT_ALREADY_REMOVED',
        'Nội dung đã được gỡ.',
      );
    }

    const update = await transaction.forumPost.updateMany({
      where: { post_id: postId, is_deleted: false },
      data: { is_deleted: true, deleted_at: deletedAt, deleted_reason: reason },
    });
    if (update.count !== 1) {
      throw new ApiError(
        409,
        'CONTENT_ALREADY_REMOVED',
        'Nội dung đã được gỡ.',
      );
    }

    await writeActivityLog(transaction, {
      adminId,
      action: 'DELETE_POST',
      targetId: postId,
      oldValue: { is_deleted: false },
      newValue: { is_deleted: true },
      reason,
      createdAt: deletedAt,
    });
    await transaction.notification.create({
      data: {
        user_id: post.author_id,
        event_id: null,
        type: 'Violation',
        content: reason,
      },
    });

    return {
      removed: {
        targetType: 'Post' as const,
        id: postId,
        isDeleted: true as const,
        deletedAt: deletedAt.toISOString(),
      },
    };
  });
}

export async function removeForumComment(
  client: ForumModerationClient,
  commentIdRaw: string,
  adminId: number,
  rawBody: unknown,
  now: () => Date = () => new Date(),
) {
  const commentId = parseForumId(commentIdRaw, 'Mã bình luận');
  const reason = parseReasonBody(rawBody);
  const deletedAt = now();

  return client.$transaction(async (transaction) => {
    const comment = await transaction.comment.findUnique({
      where: { comment_id: commentId },
      select: { comment_id: true, author_id: true, is_deleted: true },
    });
    if (!comment) {
      throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bình luận.');
    }
    if (comment.is_deleted) {
      throw new ApiError(
        409,
        'CONTENT_ALREADY_REMOVED',
        'Nội dung đã được gỡ.',
      );
    }

    const update = await transaction.comment.updateMany({
      where: { comment_id: commentId, is_deleted: false },
      data: { is_deleted: true, deleted_at: deletedAt, deleted_reason: reason },
    });
    if (update.count !== 1) {
      throw new ApiError(
        409,
        'CONTENT_ALREADY_REMOVED',
        'Nội dung đã được gỡ.',
      );
    }

    await writeActivityLog(transaction, {
      adminId,
      action: 'DELETE_COMMENT',
      targetId: commentId,
      oldValue: { is_deleted: false },
      newValue: { is_deleted: true },
      reason,
      createdAt: deletedAt,
    });
    await transaction.notification.create({
      data: {
        user_id: comment.author_id,
        event_id: null,
        type: 'Violation',
        content: reason,
      },
    });

    return {
      removed: {
        targetType: 'Comment' as const,
        id: commentId,
        isDeleted: true as const,
        deletedAt: deletedAt.toISOString(),
      },
    };
  });
}
