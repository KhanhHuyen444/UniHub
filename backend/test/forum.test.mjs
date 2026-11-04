import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createApp } from '../dist/app.js';

async function withServer(testApp, callback) {
  const server = testApp.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function mockForumClient({
  posts = [],
  comments = [],
  countPosts = posts.length,
  countComments = comments.length,
  onQuery,
} = {}) {
  let nextPostId = 101;
  let nextCommentId = 201;
  const writeClient = {
    forumPost: {
      create: async (args) => {
        onQuery?.('forumPost.create', args);
        const row = {
          post_id: nextPostId++,
          topic: args.data.topic,
          title: args.data.title,
          content: args.data.content,
          created_at: new Date('2026-10-28T03:00:00.000Z'),
          author: { full_name: 'Sinh viên A', avatar_url: null },
        };
        return row;
      },
    },
    comment: {
      create: async (args) => {
        onQuery?.('comment.create', args);
        return {
          comment_id: nextCommentId++,
          content: args.data.content,
          created_at: new Date('2026-10-28T03:00:00.000Z'),
          author: { full_name: 'Sinh viên A', avatar_url: null },
        };
      },
    },
  };
  return {
    authSession: {
      findUnique: async () => ({
        session_id: '00000000-0000-4000-8000-000000000001',
        user_id: 12,
        expires_at: new Date('2027-01-01T00:00:00.000Z'),
        revoked_at: null,
      }),
    },
    ...writeClient,
    forumPost: {
      ...writeClient.forumPost,
      count: async (args) => {
        onQuery?.('forumPost.count', args);
        return typeof countPosts === 'function' ? countPosts(args) : countPosts;
      },
      findMany: async (args) => {
        onQuery?.('forumPost.findMany', args);
        return typeof posts === 'function' ? posts(args) : posts;
      },
      findFirst: async (args) => {
        onQuery?.('forumPost.findFirst', args);
        const list = typeof posts === 'function' ? await posts(args) : posts;
        const id = args?.where?.post_id;
        const isDeleted = args?.where?.is_deleted;
        return (
          list.find(
            (p) =>
              (id === undefined || p.post_id === id) &&
              (isDeleted === undefined || p.is_deleted === isDeleted),
          ) || null
        );
      },
    },
    comment: {
      ...writeClient.comment,
      count: async (args) => {
        onQuery?.('comment.count', args);
        return typeof countComments === 'function'
          ? countComments(args)
          : countComments;
      },
      findMany: async (args) => {
        onQuery?.('comment.findMany', args);
        return typeof comments === 'function' ? comments(args) : comments;
      },
    },
    $transaction: async (arg) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg({
        forumPost: {
          findFirst: async (args) => {
            onQuery?.('transaction.forumPost.findFirst', args);
            const list =
              typeof posts === 'function' ? await posts(args) : posts;
            return (
              list.find(
                (p) =>
                  p.post_id === args.where.post_id && p.is_deleted === false,
              ) || null
            );
          },
        },
        comment: writeClient.comment,
        ...writeClient,
        forumPost: {
          ...writeClient.forumPost,
          findFirst: async (args) => {
            onQuery?.('transaction.forumPost.findFirst', args);
            const list =
              typeof posts === 'function' ? await posts(args) : posts;
            return (
              list.find(
                (p) =>
                  p.post_id === args.where.post_id && p.is_deleted === false,
              ) || null
            );
          },
          count: async (args) => {
            onQuery?.('transaction.forumPost.count', args);
            return typeof countPosts === 'function'
              ? countPosts(args)
              : countPosts;
          },
          findMany: async (args) => {
            onQuery?.('transaction.forumPost.findMany', args);
            return typeof posts === 'function' ? posts(args) : posts;
          },
        },
        comment: {
          ...writeClient.comment,
          count: async (args) => {
            onQuery?.('transaction.comment.count', args);
            return typeof countComments === 'function'
              ? countComments(args)
              : countComments;
          },
          findMany: async (args) => {
            onQuery?.('transaction.comment.findMany', args);
            return typeof comments === 'function' ? comments(args) : comments;
          },
        },
      });
    },
  };
}

function createWriteTestApp(client, role = 'Student') {
  return createApp({
    forum: {
      getPrismaClient: () => client,
      auth: {
        verifyToken: async () => ({
          userId: 12,
          role,
          sessionId: '00000000-0000-4000-8000-000000000001',
          issuedAt: 1,
          expiresAt: 4_000_000_000,
        }),
      },
    },
  });
}

// ---------------------------------------------------------------------------
// GET /api/forum/posts
// ---------------------------------------------------------------------------

test('GET /api/forum/posts trả đúng format DTO và bảo vệ thông tin tác giả', async () => {
  const samplePosts = [
    {
      post_id: 1,
      topic: 'Học tập',
      title: 'Kinh nghiệm học Cơ sở dữ liệu',
      content: 'Nội dung bài viết về học tập.',
      is_deleted: false,
      created_at: new Date('2026-10-28T10:00:00.000Z'),
      author: {
        full_name: 'Nguyễn Văn A',
        avatar_url: 'https://example.invalid/avatar.png',
      },
    },
  ];

  const queries = [];
  const client = mockForumClient({
    posts: samplePosts,
    countPosts: 1,
    onQuery: (type, args) => queries.push({ type, args }),
  });

  const testApp = createApp({
    forum: { getPrismaClient: () => client },
  });

  await withServer(testApp, async (url) => {
    const res = await fetch(`${url}/api/forum/posts`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.items.length, 1);
    const item = body.items[0];
    assert.deepEqual(item, {
      id: 1,
      title: 'Kinh nghiệm học Cơ sở dữ liệu',
      topic: 'Học tập',
      content: 'Nội dung bài viết về học tập.',
      author: {
        fullName: 'Nguyễn Văn A',
        avatarUrl: 'https://example.invalid/avatar.png',
      },
      createdAt: '2026-10-28T10:00:00Z',
    });

    // Author privacy: must NOT contain userId, email, google_sub, etc.
    assert.equal(Object.hasOwn(item.author, 'userId'), false);
    assert.equal(Object.hasOwn(item.author, 'id'), false);
    assert.equal(Object.hasOwn(item.author, 'email'), false);
    assert.equal(Object.hasOwn(item.author, 'google_sub'), false);

    assert.deepEqual(body.meta, {
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
  });

  // Check findMany query: is_deleted must be false, sort created_at desc, post_id desc
  const findManyQuery = queries.find((q) =>
    q.type.includes('forumPost.findMany'),
  );
  assert.ok(findManyQuery);
  assert.equal(findManyQuery.args.where.is_deleted, false);
  assert.deepEqual(findManyQuery.args.orderBy, [
    { created_at: 'desc' },
    { post_id: 'desc' },
  ]);
});

test('GET /api/forum/posts lọc theo topic hợp lệ', async () => {
  const queries = [];
  const client = mockForumClient({
    posts: [],
    countPosts: 0,
    onQuery: (type, args) => queries.push({ type, args }),
  });

  const testApp = createApp({
    forum: { getPrismaClient: () => client },
  });

  await withServer(testApp, async (url) => {
    const res = await fetch(
      `${url}/api/forum/posts?topic=${encodeURIComponent('Thực tập')}`,
    );
    assert.equal(res.status, 200);
  });

  const findManyQuery = queries.find((q) =>
    q.type.includes('forumPost.findMany'),
  );
  assert.equal(findManyQuery.args.where.topic, 'Thực tập');
  assert.equal(findManyQuery.args.where.is_deleted, false);
});

test('GET /api/forum/posts từ chối query sai, lặp, ngoài phạm vi', async () => {
  const client = mockForumClient();
  const testApp = createApp({
    forum: { getPrismaClient: () => client },
  });

  const invalidUrls = [
    '/api/forum/posts?topic=InvalidTopic',
    '/api/forum/posts?topic=Học tập&topic=Thực tập',
    '/api/forum/posts?page=0',
    '/api/forum/posts?page=-1',
    '/api/forum/posts?page=1.5',
    '/api/forum/posts?pageSize=0',
    '/api/forum/posts?pageSize=101',
    '/api/forum/posts?unknown=value',
  ];

  await withServer(testApp, async (url) => {
    for (const path of invalidUrls) {
      const res = await fetch(`${url}${path}`);
      assert.equal(res.status, 400, `Expected 400 for ${path}`);
      const body = await res.json();
      assert.equal(body.error.code, 'INVALID_QUERY');
    }
  });
});

test('GET /api/forum/posts danh sách rỗng trả 200 với meta total 0', async () => {
  const client = mockForumClient({ posts: [], countPosts: 0 });
  const testApp = createApp({
    forum: { getPrismaClient: () => client },
  });

  await withServer(testApp, async (url) => {
    const res = await fetch(`${url}/api/forum/posts`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, {
      items: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/forum/posts/:id
// ---------------------------------------------------------------------------

test('GET /api/forum/posts/:id trả chi tiết bài viết công khai', async () => {
  const samplePost = {
    post_id: 7,
    topic: 'Kinh nghiệm phỏng vấn',
    title: 'Phỏng vấn Fresher',
    content: 'Nội dung chia sẻ phỏng vấn.',
    is_deleted: false,
    created_at: new Date('2026-10-28T00:00:00.000Z'),
    author: {
      full_name: 'Trần Thị B',
      avatar_url: null,
    },
  };

  const client = mockForumClient({ posts: [samplePost] });
  const testApp = createApp({
    forum: { getPrismaClient: () => client },
  });

  await withServer(testApp, async (url) => {
    const res = await fetch(`${url}/api/forum/posts/7`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, {
      post: {
        id: 7,
        title: 'Phỏng vấn Fresher',
        topic: 'Kinh nghiệm phỏng vấn',
        content: 'Nội dung chia sẻ phỏng vấn.',
        author: {
          fullName: 'Trần Thị B',
          avatarUrl: null,
        },
        createdAt: '2026-10-28T00:00:00Z',
      },
    });
  });
});

test('GET /api/forum/posts/:id trả 404 nếu bài viết không tồn tại hoặc đã xóa mềm', async () => {
  const samplePosts = [
    {
      post_id: 8,
      topic: 'Học tập',
      title: 'Đã bị xóa',
      content: 'Nội dung đã bị xóa.',
      is_deleted: true, // soft deleted
      created_at: new Date(),
      author: { full_name: 'Ai Đó', avatar_url: null },
    },
  ];

  const client = mockForumClient({ posts: samplePosts });
  const testApp = createApp({
    forum: { getPrismaClient: () => client },
  });

  await withServer(testApp, async (url) => {
    // Non-existent ID
    const res1 = await fetch(`${url}/api/forum/posts/999`);
    assert.equal(res1.status, 404);
    const body1 = await res1.json();
    assert.equal(body1.error.code, 'NOT_FOUND');

    // Soft-deleted post
    const res2 = await fetch(`${url}/api/forum/posts/8`);
    assert.equal(res2.status, 404);
    const body2 = await res2.json();
    assert.equal(body2.error.code, 'NOT_FOUND');
  });
});

test('GET /api/forum/posts/:id trả 400 INVALID_ID với path ID không hợp lệ', async () => {
  const client = mockForumClient();
  const testApp = createApp({
    forum: { getPrismaClient: () => client },
  });

  const badIds = ['0', '-1', 'abc', '1.5', '2147483648'];

  await withServer(testApp, async (url) => {
    for (const badId of badIds) {
      const res = await fetch(`${url}/api/forum/posts/${badId}`);
      assert.equal(res.status, 400, `Expected 400 for ID ${badId}`);
      const body = await res.json();
      assert.equal(body.error.code, 'INVALID_ID');
    }
  });
});

test('GET /api/forum/posts/:id từ chối query string không được hỗ trợ', async () => {
  let dbCalls = 0;
  const client = mockForumClient({
    posts: () => {
      dbCalls += 1;
      return [];
    },
  });
  const testApp = createApp({
    forum: { getPrismaClient: () => client },
  });

  await withServer(testApp, async (url) => {
    const res = await fetch(`${url}/api/forum/posts/7?query=invalid`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'INVALID_QUERY');
    assert.equal(body.error.message, 'Tham số truy vấn không hợp lệ.');
  });
  assert.equal(dbCalls, 0);
});

// ---------------------------------------------------------------------------
// GET /api/forum/posts/:id/comments
// ---------------------------------------------------------------------------

test('GET /api/forum/posts/:id/comments validate query trước khi truy vấn DB', async () => {
  let dbCalls = 0;
  const client = mockForumClient({
    onQuery: () => {
      dbCalls += 1;
    },
  });
  const testApp = createApp({
    forum: { getPrismaClient: () => client },
  });

  const invalidUrls = [
    '/api/forum/posts/7/comments?page=0',
    '/api/forum/posts/7/comments?pageSize=101',
    '/api/forum/posts/7/comments?topic=Học tập',
    '/api/forum/posts/7/comments?page=1&page=2',
  ];

  await withServer(testApp, async (url) => {
    for (const path of invalidUrls) {
      const res = await fetch(`${url}${path}`);
      assert.equal(res.status, 400, `Expected 400 for ${path}`);
      const body = await res.json();
      assert.equal(body.error.code, 'INVALID_QUERY');
    }
  });
  assert.equal(dbCalls, 0);
});

test('GET /api/forum/posts/:id/comments trả danh sách bình luận đã sắp xếp asc', async () => {
  const samplePost = {
    post_id: 7,
    topic: 'Học tập',
    title: 'Bài viết hợp lệ',
    content: 'Nội dung.',
    is_deleted: false,
    created_at: new Date(),
    author: { full_name: 'Nguyễn Văn A', avatar_url: null },
  };

  const sampleComments = [
    {
      comment_id: 1,
      post_id: 7,
      content: 'Bình luận thứ nhất.',
      is_deleted: false,
      created_at: new Date('2026-10-28T01:00:00.000Z'),
      author: { full_name: 'Sinh viên 1', avatar_url: null },
    },
    {
      comment_id: 2,
      post_id: 7,
      content: 'Bình luận thứ hai.',
      is_deleted: false,
      created_at: new Date('2026-10-28T02:00:00.000Z'),
      author: {
        full_name: 'Sinh viên 2',
        avatar_url: 'https://avatar.invalid',
      },
    },
  ];

  const queries = [];
  const client = mockForumClient({
    posts: [samplePost],
    comments: sampleComments,
    countComments: 2,
    onQuery: (type, args) => queries.push({ type, args }),
  });

  const testApp = createApp({
    forum: { getPrismaClient: () => client },
  });

  await withServer(testApp, async (url) => {
    const res = await fetch(`${url}/api/forum/posts/7/comments`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.items.length, 2);
    assert.deepEqual(body.meta, {
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    });
    assert.deepEqual(body.items[0], {
      id: 1,
      content: 'Bình luận thứ nhất.',
      author: { fullName: 'Sinh viên 1', avatarUrl: null },
      createdAt: '2026-10-28T01:00:00Z',
    });

    // Check orderby on comments: created_at asc, comment_id asc
    const commentFindMany = queries.find((q) =>
      q.type.includes('comment.findMany'),
    );

    assert.ok(commentFindMany);

    assert.deepEqual(commentFindMany.args.orderBy, [
      { created_at: 'asc' },
      { comment_id: 'asc' },
    ]);

    assert.equal(commentFindMany.args.where.is_deleted, false);
    assert.equal(commentFindMany.args.where.post_id, 7);
    assert.equal(commentFindMany.args.skip, 0);
    assert.equal(commentFindMany.args.take, 20);
  });
});

test('GET /api/forum/posts/:id/comments trả 404 khi bài viết cha bị xóa hoặc không tồn tại', async () => {
  const samplePosts = [
    {
      post_id: 9,
      topic: 'Học tập',
      title: 'Đã xóa',
      content: '...',
      is_deleted: true, // soft-deleted
      created_at: new Date(),
      author: { full_name: 'A', avatar_url: null },
    },
  ];

  const client = mockForumClient({ posts: samplePosts });
  const testApp = createApp({
    forum: { getPrismaClient: () => client },
  });

  await withServer(testApp, async (url) => {
    // Non-existent parent post
    const res1 = await fetch(`${url}/api/forum/posts/999/comments`);
    assert.equal(res1.status, 404);
    assert.equal((await res1.json()).error.code, 'NOT_FOUND');

    // Soft-deleted parent post
    const res2 = await fetch(`${url}/api/forum/posts/9/comments`);
    assert.equal(res2.status, 404);
    assert.equal((await res2.json()).error.code, 'NOT_FOUND');
  });
});

test('database connectivity error trả 503 SERVICE_UNAVAILABLE', async () => {
  const testApp = createApp({
    forum: {
      getPrismaClient: () => {
        throw Object.assign(new Error('connection failed'), {
          code: 'ECONNREFUSED',
        });
      },
    },
  });

  await withServer(testApp, async (url) => {
    const res = await fetch(`${url}/api/forum/posts`);
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.deepEqual(body, {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database hiện không sẵn sàng.',
      },
    });
  });
});

test('POST /api/forum/posts cho Student tạo bài với nội dung plain text đã chuẩn hóa', async () => {
  const queries = [];
  const client = mockForumClient({
    onQuery: (type, args) => queries.push({ type, args }),
  });
  const testApp = createWriteTestApp(client);

  await withServer(testApp, async (url) => {
    const res = await fetch(`${url}/api/forum/posts`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test.token.value',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'Học tập',
        title: '  Câu hỏi mới  ',
        content: '  Dòng một\r\nDòng hai\u0000  ',
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.post.title, 'Câu hỏi mới');
    assert.equal(body.post.content, 'Dòng một\nDòng hai');
    assert.equal(body.post.author.fullName, 'Sinh viên A');
    const create = queries.find((query) => query.type === 'forumPost.create');
    assert.equal(create.args.data.author_id, 12);
    assert.equal(create.args.data.topic, 'Học tập');
  });
});

test('POST /api/forum/posts từ chối Guest, Admin và dữ liệu không hợp lệ', async () => {
  const guestApp = createWriteTestApp(mockForumClient());
  const adminApp = createWriteTestApp(mockForumClient(), 'Admin');
  const studentClient = mockForumClient();
  const studentApp = createWriteTestApp(studentClient);

  await withServer(guestApp, async (url) => {
    const res = await fetch(`${url}/api/forum/posts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        topic: 'Học tập',
        title: 'Tiêu đề hợp lệ',
        content: 'Nội dung',
      }),
    });
    assert.equal(res.status, 401);
  });

  await withServer(adminApp, async (url) => {
    const res = await fetch(`${url}/api/forum/posts`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test.token.value',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'Học tập',
        title: 'Tiêu đề hợp lệ',
        content: 'Nội dung',
      }),
    });
    assert.equal(res.status, 403);
  });

  await withServer(studentApp, async (url) => {
    const res = await fetch(`${url}/api/forum/posts`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test.token.value',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'Khác',
        title: '  ',
        content: 'Nội dung',
        extra: true,
      }),
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'INVALID_REQUEST');
  });
});

test('POST /api/forum/posts/:id/comments gắn đúng post và từ chối parent không còn public', async () => {
  const parent = {
    post_id: 7,
    is_deleted: false,
    topic: 'Học tập',
    title: 'Bài viết hợp lệ',
    content: 'Nội dung.',
    created_at: new Date('2026-10-28T00:00:00.000Z'),
    author: { full_name: 'Sinh viên A', avatar_url: null },
  };
  const queries = [];
  const client = mockForumClient({
    posts: [parent],
    onQuery: (type, args) => queries.push({ type, args }),
  });
  const testApp = createWriteTestApp(client);

  await withServer(testApp, async (url) => {
    const res = await fetch(`${url}/api/forum/posts/7/comments`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test.token.value',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ content: '  Trả lời mới  ' }),
    });
    assert.equal(res.status, 201);
    assert.equal((await res.json()).comment.content, 'Trả lời mới');
  });

  const create = queries.find((query) => query.type === 'comment.create');
  assert.equal(create.args.data.post_id, 7);
  assert.equal(create.args.data.author_id, 12);

  const deletedClient = mockForumClient({
    posts: [{ ...parent, is_deleted: true }],
  });
  await withServer(createWriteTestApp(deletedClient), async (url) => {
    const res = await fetch(`${url}/api/forum/posts/7/comments`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test.token.value',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ content: 'Không thể bình luận' }),
    });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, 'NOT_FOUND');
  });
});

test('POST /api/forum/posts/:id/comments giữ validation phía server cho comment rỗng và role', async () => {
  const parent = {
    post_id: 7,
    is_deleted: false,
    topic: 'Học tập',
    title: 'Bài viết hợp lệ',
    content: 'Nội dung.',
    created_at: new Date(),
    author: { full_name: 'A', avatar_url: null },
  };
  await withServer(
    createWriteTestApp(mockForumClient({ posts: [parent] })),
    async (url) => {
      const res = await fetch(`${url}/api/forum/posts/7/comments`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer test.token.value',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ content: '  \n  ' }),
      });
      assert.equal(res.status, 400);
      assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
    },
  );

  await withServer(
    createWriteTestApp(mockForumClient(), 'Admin'),
    async (url) => {
      const res = await fetch(`${url}/api/forum/posts/7/comments`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer test.token.value',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ content: 'Bình luận' }),
      });
      assert.equal(res.status, 403);
    },
  );
});
