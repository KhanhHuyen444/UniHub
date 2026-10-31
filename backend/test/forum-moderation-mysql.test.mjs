import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createApp } from '../dist/app.js';
import { createPrismaClient } from '../dist/lib/prisma.js';
import { removeForumPost } from '../dist/modules/forum/forum-moderation.service.js';

const databaseUrl = process.env.TEST_FORUM_DATABASE_URL;

function assertIsolatedDatabase(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('TEST_FORUM_DATABASE_URL must be a valid MySQL URL.');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (
    url.protocol !== 'mysql:' ||
    !['localhost', '127.0.0.1'].includes(hostname) ||
    !databaseName.startsWith('unihub_forum_test') ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'TEST_FORUM_DATABASE_URL must target a loopback-only unihub_forum_test* database.',
    );
  }
}

function makeFailingViolationClient(client) {
  return {
    $transaction: (callback) =>
      client.$transaction((transaction) => {
        const notification = new Proxy(transaction.notification, {
          get(delegate, property) {
            if (property === 'create') {
              return (args) =>
                delegate.create({
                  ...args,
                  // The DB CHECK rejects this value after the real soft-delete
                  // and ActivityLog INSERT have run inside the transaction.
                  data: { ...args.data, type: 'InvalidViolationType' },
                });
            }
            const value = Reflect.get(delegate, property, delegate);
            return typeof value === 'function' ? value.bind(delegate) : value;
          },
        });
        return callback(
          new Proxy(transaction, {
            get(target, property) {
              if (property === 'notification') return notification;
              return Reflect.get(target, property, target);
            },
          }),
        );
      }),
  };
}

function queueOrder(left, right) {
  const createdDifference =
    Date.parse(right.createdAt) - Date.parse(left.createdAt);
  if (createdDifference) return createdDifference;
  if (left.targetType !== right.targetType) {
    return left.targetType < right.targetType ? -1 : 1;
  }
  return left.id - right.id;
}

function expectedQueueItem(type, row) {
  const author = {
    id: row.author.user_id,
    fullName: row.author.full_name,
    avatarUrl: row.author.avatar_url,
  };
  const createdAt = row.created_at.toISOString();
  if (type === 'Post') {
    return {
      targetType: 'Post',
      id: row.post_id,
      title: row.title,
      topic: row.topic,
      content: row.content,
      author,
      createdAt,
    };
  }
  return {
    targetType: 'Comment',
    id: row.comment_id,
    post: { id: row.post.post_id, title: row.post.title },
    content: row.content,
    author,
    createdAt,
  };
}

test(
  'MySQL Forum moderation: queue ordering, atomic soft-delete, rollback and concurrent removal',
  {
    skip:
      !databaseUrl && 'TEST_FORUM_DATABASE_URL is not configured.',
  },
  async (t) => {
    assertIsolatedDatabase(databaseUrl);
    const prisma = createPrismaClient(databaseUrl);
    const runId = randomUUID();
    const userIds = [];
    const postIds = [];
    const commentIds = [];
    const reasons = {
      post: `forum-test-${runId}-post`,
      comment: `forum-test-${runId}-comment`,
      rollback: `forum-test-${runId}-rollback`,
      concurrent: `forum-test-${runId}-concurrent`,
    };
    let sessionId;
    let adminId;
    let server;
    let connected = false;

    try {
      await prisma.$connect();
      connected = true;

      const admin = await prisma.user.create({
        data: {
          email: `forum-admin-${runId}@example.invalid`,
          full_name: `Forum integration admin ${runId}`,
          role: 'Admin',
        },
        select: { user_id: true },
      });
      adminId = admin.user_id;
      userIds.push(admin.user_id);

      const authorA = await prisma.user.create({
        data: {
          email: `forum-author-a-${runId}@example.invalid`,
          full_name: `Forum author A ${runId}`,
          role: 'Student',
        },
        select: { user_id: true },
      });
      userIds.push(authorA.user_id);
      const authorB = await prisma.user.create({
        data: {
          email: `forum-author-b-${runId}@example.invalid`,
          full_name: `Forum author B ${runId}`,
          role: 'Student',
        },
        select: { user_id: true },
      });
      userIds.push(authorB.user_id);

      sessionId = randomUUID();
      await prisma.authSession.create({
        data: {
          session_id: sessionId,
          user_id: adminId,
          refresh_token_hash: createHash('sha256')
            .update(randomUUID())
            .digest('hex'),
          expires_at: new Date('9998-01-01T00:00:00.000Z'),
        },
      });

      async function createPost(label, createdAt, isDeleted = false) {
        const row = await prisma.forumPost.create({
          data: {
            author_id: authorA.user_id,
            topic: 'Học tập',
            title: `${runId} ${label}`,
            content: `Forum moderation integration ${runId} ${label}`,
            created_at: createdAt,
            is_deleted: isDeleted,
            ...(isDeleted
              ? {
                  deleted_at: createdAt,
                  deleted_reason: `fixture-${runId}`,
                }
              : {}),
          },
          select: { post_id: true },
        });
        postIds.push(row.post_id);
        return row.post_id;
      }

      async function createComment(postId, label, createdAt, isDeleted = false) {
        const row = await prisma.comment.create({
          data: {
            post_id: postId,
            author_id: authorB.user_id,
            content: `Forum moderation integration ${runId} ${label}`,
            created_at: createdAt,
            is_deleted: isDeleted,
            ...(isDeleted
              ? {
                  deleted_at: createdAt,
                  deleted_reason: `fixture-${runId}`,
                }
              : {}),
          },
          select: { comment_id: true },
        });
        commentIds.push(row.comment_id);
        return row.comment_id;
      }

      const tieTime = new Date('2999-12-31T23:59:50.000Z');
      const postTieId = await createPost('queue-post-tie', tieTime);
      const commentTieOneId = await createComment(
        postTieId,
        'queue-comment-tie-one',
        tieTime,
      );
      const commentTieTwoId = await createComment(
        postTieId,
        'queue-comment-tie-two',
        tieTime,
      );
      const postOlderId = await createPost(
        'queue-post-older',
        new Date('2999-12-30T23:59:50.000Z'),
      );
      const commentOlderId = await createComment(
        postTieId,
        'queue-comment-older',
        new Date('2999-12-29T23:59:50.000Z'),
      );
      const deletedPostId = await createPost('queue-hidden-post', tieTime, true);
      const deletedCommentId = await createComment(
        postTieId,
        'queue-hidden-comment',
        tieTime,
        true,
      );

      const postToRemoveId = await createPost(
        'remove-post',
        new Date('2999-12-28T23:59:50.000Z'),
      );
      const commentToRemoveId = await createComment(
        postTieId,
        'remove-comment',
        new Date('2999-12-27T23:59:50.000Z'),
      );
      const postToRollbackId = await createPost(
        'rollback-post',
        new Date('2999-12-26T23:59:50.000Z'),
      );
      const postForRaceId = await createPost(
        'concurrent-post',
        new Date('2999-12-25T23:59:50.000Z'),
      );

      const identity = {
        userId: adminId,
        role: 'Admin',
        sessionId,
        issuedAt: 1,
        expiresAt: 4_102_444_800,
      };
      const app = createApp({
        forumModeration: {
          getPrismaClient: () => prisma,
          auth: { verifyToken: async () => identity },
        },
      });
      server = app.listen(0, '127.0.0.1');
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        if (server.listening) resolve();
        else server.once('listening', resolve);
      });
      const baseUrl = `http://127.0.0.1:${server.address().port}`;
      const adminHeaders = {
        Authorization: 'Bearer forum.test.signature',
      };
      const removeRequest = (path, reason) =>
        fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: {
            ...adminHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason }),
        });

      await t.test('SQL queue ordering and pagination match MySQL rows', async () => {
        const [posts, comments] = await Promise.all([
          prisma.forumPost.findMany({
            where: { is_deleted: false },
            select: {
              post_id: true,
              title: true,
              topic: true,
              content: true,
              created_at: true,
              author: {
                select: { user_id: true, full_name: true, avatar_url: true },
              },
            },
          }),
          prisma.comment.findMany({
            where: { is_deleted: false },
            select: {
              comment_id: true,
              content: true,
              created_at: true,
              author: {
                select: { user_id: true, full_name: true, avatar_url: true },
              },
              post: { select: { post_id: true, title: true } },
            },
          }),
        ]);
        const expected = [
          ...posts.map((row) => expectedQueueItem('Post', row)),
          ...comments.map((row) => expectedQueueItem('Comment', row)),
        ].sort(queueOrder);
        const expectedOwnItems = expected.filter((item) =>
          [...postIds].includes(item.id) || [...commentIds].includes(item.id),
        );
        assert.deepEqual(
          expectedOwnItems.map(({ targetType, id }) => [targetType, id]),
          [
            ['Comment', commentTieOneId],
            ['Comment', commentTieTwoId],
            ['Post', postTieId],
            ['Post', postOlderId],
            ['Comment', commentOlderId],
            ['Post', postToRemoveId],
            ['Comment', commentToRemoveId],
            ['Post', postToRollbackId],
            ['Post', postForRaceId],
          ],
        );
        assert.equal(
          expected.some(
            (item) =>
              (item.targetType === 'Post' && item.id === deletedPostId) ||
              (item.targetType === 'Comment' && item.id === deletedCommentId),
          ),
          false,
        );

        for (const page of [1, 2, 3]) {
          const response = await fetch(
            `${baseUrl}/api/admin/moderation/forum?page=${page}&pageSize=2`,
            { headers: adminHeaders },
          );
          assert.equal(response.status, 200);
          const body = await response.json();
          assert.deepEqual(body.items, expected.slice((page - 1) * 2, page * 2));
          assert.deepEqual(body.meta, {
            page,
            pageSize: 2,
            total: expected.length,
            totalPages: Math.ceil(expected.length / 2),
          });
          for (const item of body.items) {
            assert.equal('email' in item.author, false);
            assert.equal('google_sub' in item.author, false);
          }
        }
      });

      await t.test('remove post soft-deletes and writes audit plus Violation', async () => {
        const response = await removeRequest(
          `/api/admin/moderation/forum/posts/${postToRemoveId}/remove`,
          reasons.post,
        );
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.deepEqual(body.removed, {
          targetType: 'Post',
          id: postToRemoveId,
          isDeleted: true,
          deletedAt: body.removed.deletedAt,
        });
        assert.equal(typeof body.removed.deletedAt, 'string');
        assert.equal(
          new Date(body.removed.deletedAt).toISOString(),
          body.removed.deletedAt,
        );

        const persistedPost = await prisma.forumPost.findUnique({
          where: { post_id: postToRemoveId },
        });
        assert.ok(persistedPost);
        assert.equal(persistedPost.is_deleted, true);
        assert.ok(persistedPost.deleted_at);
        assert.equal(persistedPost.deleted_reason, reasons.post);

        const [log, notification] = await Promise.all([
          prisma.activityLog.findFirst({
            where: {
              admin_id: adminId,
              action_type: 'DELETE_POST',
              target_type: 'ForumPost',
              target_id: postToRemoveId,
              reason: reasons.post,
            },
          }),
          prisma.notification.findFirst({
            where: {
              user_id: authorA.user_id,
              event_id: null,
              type: 'Violation',
              content: reasons.post,
            },
          }),
        ]);
        assert.ok(log);
        assert.equal(log.old_value, '{"is_deleted":false}');
        assert.equal(log.new_value, '{"is_deleted":true}');
        assert.equal(log.reason, reasons.post);
        assert.ok(notification);
      });

      await t.test('remove comment soft-deletes and notifies comment author', async () => {
        const response = await removeRequest(
          `/api/admin/moderation/forum/comments/${commentToRemoveId}/remove`,
          reasons.comment,
        );
        assert.equal(response.status, 200);
        const persistedComment = await prisma.comment.findUnique({
          where: { comment_id: commentToRemoveId },
        });
        assert.ok(persistedComment);
        assert.equal(persistedComment.is_deleted, true);
        assert.ok(persistedComment.deleted_at);
        assert.equal(persistedComment.deleted_reason, reasons.comment);

        const [log, notification] = await Promise.all([
          prisma.activityLog.findFirst({
            where: {
              admin_id: adminId,
              action_type: 'DELETE_COMMENT',
              target_type: 'Comment',
              target_id: commentToRemoveId,
              reason: reasons.comment,
            },
          }),
          prisma.notification.findFirst({
            where: {
              user_id: authorB.user_id,
              event_id: null,
              type: 'Violation',
              content: reasons.comment,
            },
          }),
        ]);
        assert.ok(log);
        assert.equal(log.old_value, '{"is_deleted":false}');
        assert.equal(log.new_value, '{"is_deleted":true}');
        assert.equal(log.reason, reasons.comment);
        assert.ok(notification);
      });

      await t.test('failed Violation INSERT rolls back post and ActivityLog', async () => {
        await assert.rejects(
          removeForumPost(
            makeFailingViolationClient(prisma),
            String(postToRollbackId),
            adminId,
            { reason: reasons.rollback },
          ),
        );

        const [post, log, notification] = await Promise.all([
          prisma.forumPost.findUnique({
            where: { post_id: postToRollbackId },
          }),
          prisma.activityLog.findFirst({
            where: {
              admin_id: adminId,
              action_type: 'DELETE_POST',
              target_id: postToRollbackId,
              reason: reasons.rollback,
            },
          }),
          prisma.notification.findFirst({
            where: {
              user_id: authorA.user_id,
              content: reasons.rollback,
              type: 'Violation',
              event_id: null,
            },
          }),
        ]);
        assert.ok(post);
        assert.equal(post.is_deleted, false);
        assert.equal(post.deleted_at, null);
        assert.equal(post.deleted_reason, null);
        assert.equal(log, null);
        assert.equal(notification, null);
      });

      await t.test('concurrent remove succeeds once and returns 409 once', async () => {
        const responses = await Promise.all([
          removeRequest(
            `/api/admin/moderation/forum/posts/${postForRaceId}/remove`,
            reasons.concurrent,
          ),
          removeRequest(
            `/api/admin/moderation/forum/posts/${postForRaceId}/remove`,
            reasons.concurrent,
          ),
        ]);
        assert.deepEqual(
          responses.map((response) => response.status).sort(),
          [200, 409],
        );
        const [logCount, notificationCount, persistedPost] = await Promise.all([
          prisma.activityLog.count({
            where: {
              admin_id: adminId,
              action_type: 'DELETE_POST',
              target_id: postForRaceId,
              reason: reasons.concurrent,
            },
          }),
          prisma.notification.count({
            where: {
              user_id: authorA.user_id,
              type: 'Violation',
              event_id: null,
              content: reasons.concurrent,
            },
          }),
          prisma.forumPost.findUnique({
            where: { post_id: postForRaceId },
          }),
        ]);
        assert.equal(logCount, 1);
        assert.equal(notificationCount, 1);
        assert.ok(persistedPost);
        assert.equal(persistedPost.is_deleted, true);
      });
    } finally {
      if (server?.listening) {
        await new Promise((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
      if (connected) {
        const uniqueReasons = Object.values(reasons);
        try {
          await prisma.notification.deleteMany({
            where: {
              user_id: { in: userIds.filter((id) => id !== adminId) },
              event_id: null,
              type: 'Violation',
              content: { in: uniqueReasons },
            },
          });
          if (adminId) {
            await prisma.activityLog.deleteMany({
              where: {
                admin_id: adminId,
                reason: { in: uniqueReasons },
              },
            });
          }
          await prisma.comment.deleteMany({
            where: { comment_id: { in: commentIds } },
          });
          await prisma.forumPost.deleteMany({
            where: { post_id: { in: postIds } },
          });
          if (sessionId) {
            await prisma.authSession.deleteMany({
              where: { session_id: sessionId },
            });
          }
          await prisma.user.deleteMany({
            where: { user_id: { in: userIds } },
          });
        } finally {
          await prisma.$disconnect();
        }
      }
    }
  },
);
