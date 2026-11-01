import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let vite;
let forumApi;
let moderationApi;
let authState;
let fetcher;
const originalFetch = globalThis.fetch;

const student = {
  id: 7,
  email: 'student@example.invalid',
  fullName: 'Sinh viên A',
  avatarUrl: null,
  role: 'Student',
};
const admin = { ...student, role: 'Admin' };
const post = {
  id: 12,
  title: 'Câu hỏi học tập',
  topic: 'Học tập',
  content: 'Nội dung bài viết.',
  author: { fullName: student.fullName, avatarUrl: null },
  createdAt: '2026-10-28T00:00:00Z',
};
const comment = {
  id: 13,
  content: 'Nội dung bình luận.',
  author: { fullName: student.fullName, avatarUrl: null },
  createdAt: '2026-10-28T01:00:00Z',
};
const json = (body) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

before(async () => {
  globalThis.fetch = (...args) => fetcher(...args);
  vite = await createServer({
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true },
  });
  forumApi = await vite.ssrLoadModule('/src/features/forum/api.ts');
  moderationApi = await vite.ssrLoadModule('/src/features/admin/forum/api.ts');
  authState = await vite.ssrLoadModule('/src/features/auth/auth-state.ts');
});

beforeEach(() => authState.setGuest());

afterEach(() => {
  fetcher = originalFetch;
  authState.setGuest();
});

after(async () => {
  globalThis.fetch = originalFetch;
  await vite?.close();
});

test('Forum public reads use exact GET routes without a Bearer token', async () => {
  const controller = new AbortController();
  const seen = [];
  fetcher = async (path, options) => {
    seen.push({ path, options });
    if (path.startsWith('/api/forum/posts?')) {
      return json({
        items: [post],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      });
    }
    if (path === '/api/forum/posts/12') return json({ post });
    if (path.startsWith('/api/forum/posts/12/comments?')) {
      return json({
        items: [comment],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      });
    }
    throw new Error(`Unexpected route: ${path}`);
  };

  const query = new URLSearchParams({
    topic: 'Học tập',
    page: '1',
    pageSize: '20',
  });
  await forumApi.getForumPosts(query, controller.signal);
  await forumApi.getForumPost('12', controller.signal);
  await forumApi.getPostComments(
    '12',
    new URLSearchParams({ page: '1', pageSize: '10' }),
    controller.signal,
  );

  assert.deepEqual(
    seen.map(({ path, options }) => [path.split('?')[0], options.method]),
    [
      ['/api/forum/posts', 'GET'],
      ['/api/forum/posts/12', 'GET'],
      ['/api/forum/posts/12/comments', 'GET'],
    ],
  );
  assert.ok(seen.every(({ options }) => !options.headers.has('Authorization')));
  assert.ok(seen.every(({ options }) => options.signal === controller.signal));
});

test('Student post and comment writes use protected routes and exact JSON bodies', async () => {
  authState.setAuthenticated('forum-student-token', student);
  const requests = [];
  fetcher = async (path, options) => {
    requests.push({ path, options });
    return path === '/api/forum/posts' ? json({ post }) : json({ comment });
  };

  await forumApi.createForumPost({
    topic: 'Học tập',
    title: post.title,
    content: post.content,
  });
  await forumApi.createForumComment('12', comment.content);

  assert.deepEqual(
    requests.map(({ path, options }) => [path, options.method, options.body]),
    [
      [
        '/api/forum/posts',
        'POST',
        JSON.stringify({
          topic: 'Học tập',
          title: post.title,
          content: post.content,
        }),
      ],
      [
        '/api/forum/posts/12/comments',
        'POST',
        JSON.stringify({ content: comment.content }),
      ],
    ],
  );
  assert.ok(
    requests.every(
      ({ options }) =>
        options.headers.get('Authorization') === 'Bearer forum-student-token',
    ),
  );
});

test('Admin moderation queue and removals use protected contract routes', async () => {
  authState.setAuthenticated('forum-admin-token', admin);
  const requests = [];
  fetcher = async (path, options) => {
    requests.push({ path, options });
    if (path.startsWith('/api/admin/moderation/forum?')) {
      return json({
        items: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      });
    }
    return json({
      removed: {
        targetType: path.includes('/posts/') ? 'Post' : 'Comment',
        id: 12,
        isDeleted: true,
        deletedAt: '2026-10-28T02:00:00Z',
      },
    });
  };

  await moderationApi.getForumModerationQueue(1, new AbortController().signal);
  await moderationApi.removeModerationTarget('Post', 12, 'Lý do gỡ bài');
  await moderationApi.removeModerationTarget(
    'Comment',
    12,
    'Lý do gỡ bình luận',
  );

  assert.deepEqual(
    requests.map(({ path, options }) => [path.split('?')[0], options.method]),
    [
      ['/api/admin/moderation/forum', 'GET'],
      ['/api/admin/moderation/forum/posts/12/remove', 'POST'],
      ['/api/admin/moderation/forum/comments/12/remove', 'POST'],
    ],
  );
  assert.equal(
    requests[0].path,
    '/api/admin/moderation/forum?page=1&pageSize=20',
  );
  assert.deepEqual(
    requests.slice(1).map(({ options }) => JSON.parse(options.body)),
    [{ reason: 'Lý do gỡ bài' }, { reason: 'Lý do gỡ bình luận' }],
  );
  assert.ok(
    requests.every(
      ({ options }) =>
        options.headers.get('Authorization') === 'Bearer forum-admin-token',
    ),
  );
});
