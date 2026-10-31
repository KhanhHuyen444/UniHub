import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createApp } from '../dist/app.js';
import { writeActivityLog } from '../dist/modules/activity-logs/activity-logs.service.js';

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function createModerationFixture({
  posts = [],
  comments = [],
  failActivityLog = false,
  failNotification = false,
} = {}) {
  const state = {
    posts: structuredClone(posts),
    comments: structuredClone(comments),
    activityLogs: [],
    notifications: [],
    hardDeleteCalls: 0,
  };

  function makeModel(txState, type) {
    const collection = type === 'post' ? 'posts' : 'comments';
    const idKey = type === 'post' ? 'post_id' : 'comment_id';
    const rows = txState[collection];
    return {
      count: async ({ where }) =>
        rows.filter((row) => row.is_deleted === where.is_deleted).length,
      findMany: async ({ where, skip = 0, take = 20, orderBy }) => {
        assert.equal(where.is_deleted, false);
        const ordered = [...rows]
          .filter((row) => !row.is_deleted)
          .sort((a, b) => {
            const timeDifference =
              b.created_at.getTime() - a.created_at.getTime();
            return timeDifference || a[idKey] - b[idKey];
          });
        return ordered.slice(skip, skip + take).map((row) => {
          if (type === 'post') return structuredClone(row);
          return structuredClone(row);
        });
      },
      findUnique: async ({ where }) =>
        structuredClone(
          rows.find((row) => row[idKey] === where[idKey]) ?? null,
        ),
      findFirst: async ({ where }) =>
        structuredClone(
          rows.find(
            (row) =>
              (where[idKey] === undefined || row[idKey] === where[idKey]) &&
              (where.is_deleted === undefined ||
                row.is_deleted === where.is_deleted),
          ) ?? null,
        ),
      updateMany: async ({ where, data }) => {
        const row = rows.find(
          (candidate) =>
            candidate[idKey] === where[idKey] &&
            candidate.is_deleted === where.is_deleted,
        );
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      delete: async () => {
        txState.hardDeleteCalls += 1;
        throw new Error('Hard delete must not be called.');
      },
    };
  }

  const client = {
    authSession: {
      findUnique: async () => ({
        session_id: 'session',
        user_id: 99,
        expires_at: new Date('2027-01-01T00:00:00.000Z'),
        revoked_at: null,
      }),
    },
    forumPost: makeModel(state, 'post'),
    comment: makeModel(state, 'comment'),
    activityLog: {
      create: async ({ data }) => {
        if (failActivityLog) throw new Error('audit insert failed');
        state.activityLogs.push(structuredClone(data));
      },
    },
    notification: {
      create: async ({ data }) => {
        if (failNotification) throw new Error('notification insert failed');
        state.notifications.push(structuredClone(data));
      },
    },
    $queryRaw: async (query) => {
      const [pageSize, offset] = query.values;
      const queueRows = [
        ...state.posts
          .filter((post) => !post.is_deleted)
          .map((post) => ({
            targetType: 'Post',
            id: post.post_id,
            title: post.title,
            topic: post.topic,
            content: post.content,
            authorId: post.author.user_id,
            authorFullName: post.author.full_name,
            authorAvatarUrl: post.author.avatar_url,
            createdAt: post.created_at,
            postId: null,
            postTitle: null,
          })),
        ...state.comments
          .filter((comment) => !comment.is_deleted)
          .map((comment) => ({
            targetType: 'Comment',
            id: comment.comment_id,
            title: null,
            topic: null,
            content: comment.content,
            authorId: comment.author.user_id,
            authorFullName: comment.author.full_name,
            authorAvatarUrl: comment.author.avatar_url,
            createdAt: comment.created_at,
            postId: comment.post.post_id,
            postTitle: comment.post.title,
          })),
      ];
      queueRows.sort((left, right) => {
        const timeDifference =
          right.createdAt.getTime() - left.createdAt.getTime();
        if (timeDifference) return timeDifference;
        if (left.targetType !== right.targetType) {
          return left.targetType === 'Comment' ? -1 : 1;
        }
        return left.id - right.id;
      });
      return queueRows.slice(offset, offset + pageSize);
    },
    $transaction: async (callback) => {
      const working = structuredClone(state);
      const transaction = {
        forumPost: makeModel(working, 'post'),
        comment: makeModel(working, 'comment'),
        activityLog: {
          create: async ({ data }) => {
            if (failActivityLog) throw new Error('audit insert failed');
            working.activityLogs.push(structuredClone(data));
          },
        },
        notification: {
          create: async ({ data }) => {
            if (failNotification) throw new Error('notification insert failed');
            working.notifications.push(structuredClone(data));
          },
        },
      };
      const result = await callback(transaction);
      for (const key of [
        'posts',
        'comments',
        'activityLogs',
        'notifications',
      ]) {
        state[key].splice(0, state[key].length, ...working[key]);
      }
      state.hardDeleteCalls = working.hardDeleteCalls;
      return result;
    },
  };
  const app = createApp({
    forum: { getPrismaClient: () => client },
    forumModeration: {
      getPrismaClient: () => client,
      auth: {
        verifyToken: async (token) => ({
          userId: 99,
          role: token.startsWith('student.') ? 'Student' : 'Admin',
          sessionId: 'session',
          issuedAt: 1,
          expiresAt: 4_000_000_000,
        }),
      },
      now: () => new Date('2026-10-30T12:00:00.000Z'),
    },
  });
  return { app, state };
}

function samplePost(overrides = {}) {
  return {
    post_id: 7,
    author_id: 12,
    title: 'Bài viết cần duyệt',
    topic: 'Học tập',
    content: 'Nội dung riêng tư',
    is_deleted: false,
    created_at: new Date('2026-10-30T10:00:00.000Z'),
    author: {
      user_id: 12,
      full_name: 'Nguyễn A',
      avatar_url: null,
      email: 'private@example.invalid',
      google_sub: 'private-sub',
    },
    ...overrides,
  };
}

function sampleComment(overrides = {}) {
  return {
    comment_id: 18,
    post_id: 7,
    author_id: 13,
    content: 'Bình luận cần duyệt',
    is_deleted: false,
    created_at: new Date('2026-10-30T10:00:00.000Z'),
    post: { post_id: 7, title: 'Bài viết cần duyệt' },
    author: {
      user_id: 13,
      full_name: 'Trần B',
      avatar_url: 'https://example.invalid/avatar.png',
      email: 'private@example.invalid',
      google_sub: 'private-sub',
    },
    ...overrides,
  };
}

test('moderation endpoints enforce Guest/Student/Admin role matrix', async () => {
  const endpoints = [
    { method: 'GET', path: '/api/admin/moderation/forum' },
    {
      method: 'POST',
      path: '/api/admin/moderation/forum/posts/7/remove',
      body: JSON.stringify({ reason: 'valid' }),
    },
    {
      method: 'POST',
      path: '/api/admin/moderation/forum/comments/18/remove',
      body: JSON.stringify({ reason: 'valid' }),
    },
  ];
  for (const endpoint of endpoints) {
    for (const [token, expectedStatus] of [
      [undefined, 401],
      ['student.token.value', 403],
    ]) {
      const { app } = createModerationFixture();
      await withServer(app, async (url) => {
        const response = await fetch(`${url}${endpoint.path}`, {
          method: endpoint.method,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(endpoint.body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: endpoint.body,
        });
        assert.equal(response.status, expectedStatus);
      });
    }
  }
});

test('queue returns paginated ordered targets without unnecessary PII', async () => {
  const posts = [
    samplePost({ post_id: 7, created_at: new Date('2026-10-30T10:00:00Z') }),
    samplePost({ post_id: 3, created_at: new Date('2026-10-30T09:00:00Z') }),
  ];
  const comments = [
    sampleComment({
      comment_id: 18,
      created_at: new Date('2026-10-30T10:00:00Z'),
    }),
    sampleComment({
      comment_id: 2,
      created_at: new Date('2026-10-30T08:00:00Z'),
    }),
  ];
  const { app } = createModerationFixture({ posts, comments });
  await withServer(app, async (url) => {
    const response = await fetch(
      `${url}/api/admin/moderation/forum?page=1&pageSize=2`,
      { headers: { Authorization: 'Bearer admin.token.value' } },
    );
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(
      result.items.map(({ targetType, id }) => [targetType, id]),
      [
        ['Comment', 18],
        ['Post', 7],
      ],
    );
    assert.deepEqual(result.meta, {
      page: 1,
      pageSize: 2,
      total: 4,
      totalPages: 2,
    });
    assert.equal('email' in result.items[0].author, false);
    assert.equal('google_sub' in result.items[0].author, false);
    assert.deepEqual(result.items[0].post, {
      id: 7,
      title: 'Bài viết cần duyệt',
    });

    const secondPageResponse = await fetch(
      `${url}/api/admin/moderation/forum?page=2&pageSize=2`,
      { headers: { Authorization: 'Bearer admin.token.value' } },
    );
    const secondPage = await secondPageResponse.json();
    assert.deepEqual(
      secondPage.items.map(({ targetType, id }) => [targetType, id]),
      [
        ['Post', 3],
        ['Comment', 2],
      ],
    );
  });
});

test('queue rejects unsupported, repeated, malformed and out-of-range query values', async () => {
  const { app } = createModerationFixture();
  await withServer(app, async (url) => {
    for (const query of [
      '?unknown=1',
      '?page=1&page=2',
      '?page=0',
      '?pageSize=101',
      '?page=1.5',
    ]) {
      const response = await fetch(
        `${url}/api/admin/moderation/forum${query}`,
        {
          headers: { Authorization: 'Bearer admin.token.value' },
        },
      );
      assert.equal(response.status, 400, query);
      assert.equal((await response.json()).error.code, 'INVALID_QUERY');
    }
  });
});

test('removing a post soft-deletes, writes the minimal audit and Violation notification atomically', async () => {
  const { app, state } = createModerationFixture({ posts: [samplePost()] });
  await withServer(app, async (url) => {
    const response = await fetch(
      `${url}/api/admin/moderation/forum/posts/7/remove`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin.token.value',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: '  Nội dung vi phạm quy tắc.  ' }),
      },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      removed: {
        targetType: 'Post',
        id: 7,
        isDeleted: true,
        deletedAt: '2026-10-30T12:00:00.000Z',
      },
    });
    assert.equal(state.posts[0].is_deleted, true);
    assert.equal(state.posts[0].deleted_reason, 'Nội dung vi phạm quy tắc.');
    assert.equal(state.activityLogs.length, 1);
    assert.deepEqual(state.activityLogs[0], {
      admin_id: 99,
      action_type: 'DELETE_POST',
      target_type: 'ForumPost',
      target_id: 7,
      old_value: '{"is_deleted":false}',
      new_value: '{"is_deleted":true}',
      reason: 'Nội dung vi phạm quy tắc.',
      created_at: new Date('2026-10-30T12:00:00.000Z'),
    });
    assert.deepEqual(state.notifications, [
      {
        user_id: 12,
        event_id: null,
        type: 'Violation',
        content: 'Nội dung vi phạm quy tắc.',
      },
    ]);
    assert.equal(state.hardDeleteCalls, 0);
    const publicPostResponse = await fetch(`${url}/api/forum/posts/7`);
    assert.equal(publicPostResponse.status, 404);
  });
});

test('removing a comment writes DELETE_COMMENT and notifies the comment author', async () => {
  const { app, state } = createModerationFixture({
    comments: [sampleComment()],
  });
  await withServer(app, async (url) => {
    const response = await fetch(
      `${url}/api/admin/moderation/forum/comments/18/remove`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin.token.value',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Spam' }),
      },
    );
    assert.equal(response.status, 200);
    assert.equal(state.comments[0].is_deleted, true);
    assert.equal(state.activityLogs[0].action_type, 'DELETE_COMMENT');
    assert.equal(state.activityLogs[0].target_type, 'Comment');
    assert.equal(state.notifications[0].user_id, 13);
    assert.equal(state.notifications[0].event_id, null);
    assert.equal(state.hardDeleteCalls, 0);
  });
});

test('remove validates exact body, trimmed reason boundaries, ID and query', async () => {
  const { app } = createModerationFixture({ posts: [samplePost()] });
  await withServer(app, async (url) => {
    const cases = [
      [{}, 'VALIDATION_ERROR'],
      [{ reason: '   ' }, 'VALIDATION_ERROR'],
      [{ reason: 'x'.repeat(501) }, 'VALIDATION_ERROR'],
      [{ reason: 'ok', extra: true }, 'INVALID_REQUEST'],
    ];
    for (const [body, code] of cases) {
      const response = await fetch(
        `${url}/api/admin/moderation/forum/posts/7/remove`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer admin.token.value',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );
      assert.equal(response.status, 400);
      const error = (await response.json()).error;
      assert.equal(error.code, code);
      if (code === 'VALIDATION_ERROR') {
        assert.equal(error.fieldErrors[0].source, 'body');
        assert.equal(error.fieldErrors[0].field, 'reason');
      }
    }
    const invalidId = await fetch(
      `${url}/api/admin/moderation/forum/posts/0/remove`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin.token.value',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'valid' }),
      },
    );
    assert.equal(invalidId.status, 400);
    assert.equal((await invalidId.json()).error.code, 'INVALID_ID');
    const unexpectedQuery = await fetch(
      `${url}/api/admin/moderation/forum/posts/7/remove?x=1`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin.token.value',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'valid' }),
      },
    );
    assert.equal(unexpectedQuery.status, 400);
    assert.equal((await unexpectedQuery.json()).error.code, 'INVALID_QUERY');
  });
});

test('remove distinguishes missing targets from already soft-deleted targets', async () => {
  const { app } = createModerationFixture({
    posts: [samplePost({ post_id: 8, is_deleted: true })],
  });
  await withServer(app, async (url) => {
    for (const [id, status, code] of [
      [404, 404, 'NOT_FOUND'],
      [8, 409, 'CONTENT_ALREADY_REMOVED'],
    ]) {
      const response = await fetch(
        `${url}/api/admin/moderation/forum/posts/${id}/remove`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer admin.token.value',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: 'valid' }),
        },
      );
      assert.equal(response.status, status);
      assert.equal((await response.json()).error.code, code);
    }
  });
});

test('audit or notification failure rolls back soft delete and all sibling writes', async (t) => {
  for (const failure of ['activityLog', 'notification']) {
    await t.test(`rollback when ${failure} insert fails`, async () => {
      const { app, state } = createModerationFixture({
        posts: [samplePost()],
        failActivityLog: failure === 'activityLog',
        failNotification: failure === 'notification',
      });
      await withServer(app, async (url) => {
        const response = await fetch(
          `${url}/api/admin/moderation/forum/posts/7/remove`,
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer admin.token.value',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reason: 'valid' }),
          },
        );
        assert.equal(response.status, 500);
        assert.equal(state.posts[0].is_deleted, false);
        assert.equal(state.activityLogs.length, 0);
        assert.equal(state.notifications.length, 0);
      });
    });
  }
});

test('shared activity writer rejects oversized JSON without truncating', async () => {
  let inserted = false;
  await assert.rejects(
    writeActivityLog(
      {
        activityLog: {
          create: async () => {
            inserted = true;
          },
        },
      },
      {
        adminId: 1,
        action: 'DELETE_POST',
        targetId: 7,
        oldValue: { is_deleted: false, extra: 'x'.repeat(600) },
        newValue: { is_deleted: true },
      },
    ),
    RangeError,
  );
  assert.equal(inserted, false);
});

test('shared activity writer uses the approved action-to-target mapping', async () => {
  const inserted = [];
  const transaction = {
    activityLog: {
      create: async ({ data }) => inserted.push(data),
    },
  };
  const mapping = [
    ['APPROVE_OPPORTUNITY', 'Opportunity'],
    ['REJECT_OPPORTUNITY', 'Opportunity'],
    ['DELETE_POST', 'ForumPost'],
    ['DELETE_COMMENT', 'Comment'],
    ['CREATE_CATEGORY', 'Category'],
    ['RENAME_CATEGORY', 'Category'],
    ['CLOSE_CATEGORY', 'Category'],
    ['REOPEN_CATEGORY', 'Category'],
    ['CHANGE_ROLE', 'User'],
  ];
  for (const [action, targetType] of mapping) {
    await writeActivityLog(transaction, {
      adminId: 99,
      action,
      targetId: 7,
      ...(action === 'REJECT_OPPORTUNITY' ||
      action === 'DELETE_POST' ||
      action === 'DELETE_COMMENT'
        ? { reason: 'Lý do' }
        : {}),
    });
  }
  assert.deepEqual(
    inserted.map(({ action_type, target_type }) => [action_type, target_type]),
    mapping,
  );
});
