import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let vite;
let forumApi;
let fetcher;
const originalFetch = globalThis.fetch;

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
});

afterEach(() => {
  fetcher = originalFetch;
});

after(async () => {
  globalThis.fetch = originalFetch;
  await vite?.close();
});

test('HomePage forum integration: fetches posts with pageSize=3 and comments count with pageSize=1', async () => {
  const requests = [];

  const mockPosts = [
    {
      id: 1,
      title:
        'Chia sẻ kinh nghiệm phỏng vấn vị trí Software Intern cho sinh viên năm 3',
      topic: 'Kinh nghiệm phỏng vấn',
      content: 'Nội dung...',
      author: { fullName: 'Nguyễn Hoàng', avatarUrl: null },
      createdAt: '2026-11-04T15:00:00Z',
    },
    {
      id: 9,
      title:
        'Cách phân bổ thời gian ôn thi chứng chỉ TOEIC và đồ án chuyên ngành hiệu quả',
      topic: 'Học tập',
      content: 'Nội dung...',
      author: { fullName: 'Trần Mai', avatarUrl: null },
      createdAt: '2026-11-03T15:00:00Z',
    },
    {
      id: 17,
      title: 'Nên chuẩn bị gì trước kỳ thực tập doanh nghiệp đầu tiên?',
      topic: 'Thực tập',
      content: 'Nội dung...',
      author: { fullName: 'Lê Trí', avatarUrl: null },
      createdAt: '2026-11-02T15:00:00Z',
    },
  ];

  fetcher = async (url) => {
    const urlStr = String(url);
    requests.push(urlStr);

    if (urlStr.includes('/api/forum/posts?pageSize=3')) {
      return json({
        items: mockPosts,
        meta: { page: 1, pageSize: 3, total: 24, totalPages: 8 },
      });
    }

    if (urlStr.includes('/api/forum/posts/1/comments?pageSize=1')) {
      return json({
        items: [],
        meta: { page: 1, pageSize: 1, total: 18, totalPages: 18 },
      });
    }
    if (urlStr.includes('/api/forum/posts/9/comments?pageSize=1')) {
      return json({
        items: [],
        meta: { page: 1, pageSize: 1, total: 32, totalPages: 32 },
      });
    }
    if (urlStr.includes('/api/forum/posts/17/comments?pageSize=1')) {
      return json({
        items: [],
        meta: { page: 1, pageSize: 1, total: 14, totalPages: 14 },
      });
    }

    throw new Error(`Unexpected request: ${urlStr}`);
  };

  const controller = new AbortController();
  const listRes = await forumApi.getForumPosts(
    new URLSearchParams({ pageSize: '3' }),
    controller.signal,
  );

  assert.equal(listRes.items.length, 3);
  assert.equal(
    listRes.items[0].title,
    'Chia sẻ kinh nghiệm phỏng vấn vị trí Software Intern cho sinh viên năm 3',
  );
  assert.equal(listRes.items[0].topic, 'Kinh nghiệm phỏng vấn');
  assert.equal(listRes.items[0].author.fullName, 'Nguyễn Hoàng');

  const commentsPromises = listRes.items.map(async (p) => {
    const res = await forumApi.getPostComments(
      String(p.id),
      new URLSearchParams({ pageSize: '1' }),
      controller.signal,
    );
    return { ...p, commentsCount: res.meta.total };
  });

  const resolved = await Promise.all(commentsPromises);
  assert.equal(resolved[0].commentsCount, 18);
  assert.equal(resolved[1].commentsCount, 32);
  assert.equal(resolved[2].commentsCount, 14);

  assert.ok(
    requests.some((r) => r.includes('/api/forum/posts?pageSize=3')),
    'Must query /api/forum/posts?pageSize=3',
  );
  assert.ok(
    requests.some((r) => r.includes('/api/forum/posts/1/comments?pageSize=1')),
    'Must query post 1 comments',
  );
  assert.ok(
    requests.some((r) => r.includes('/api/forum/posts/9/comments?pageSize=1')),
    'Must query post 9 comments',
  );
  assert.ok(
    requests.some((r) => r.includes('/api/forum/posts/17/comments?pageSize=1')),
    'Must query post 17 comments',
  );
});

test('HomePage forum resilience: single comment request failure falls back to 0 without breaking siblings', async () => {
  const mockPosts = [
    {
      id: 1,
      title: 'Post 1',
      topic: 'Học tập',
      content: 'Content...',
      author: { fullName: 'Sinh viên 1', avatarUrl: null },
      createdAt: '2026-11-04T15:00:00Z',
    },
    {
      id: 2,
      title: 'Post 2',
      topic: 'Thực tập',
      content: 'Content...',
      author: { fullName: 'Sinh viên 2', avatarUrl: null },
      createdAt: '2026-11-04T14:00:00Z',
    },
  ];

  fetcher = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/api/forum/posts?pageSize=3')) {
      return json({
        items: mockPosts,
        meta: { page: 1, pageSize: 3, total: 2, totalPages: 1 },
      });
    }
    // Post 1 comment fails (e.g. 500 internal error)
    if (urlStr.includes('/api/forum/posts/1/comments?pageSize=1')) {
      return new Response(
        JSON.stringify({ error: { code: 'INTERNAL_ERROR' } }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    // Post 2 comment succeeds
    if (urlStr.includes('/api/forum/posts/2/comments?pageSize=1')) {
      return json({
        items: [],
        meta: { page: 1, pageSize: 1, total: 8, totalPages: 8 },
      });
    }
    throw new Error(`Unexpected request: ${urlStr}`);
  };

  const controller = new AbortController();
  const listRes = await forumApi.getForumPosts(
    new URLSearchParams({ pageSize: '3' }),
    controller.signal,
  );

  // Exact logic used in HomePage.tsx:
  const postsWithComments = await Promise.all(
    listRes.items.map(async (post) => {
      try {
        const commentsRes = await forumApi.getPostComments(
          String(post.id),
          new URLSearchParams({ pageSize: '1' }),
          controller.signal,
        );
        return { ...post, commentsCount: commentsRes.meta.total };
      } catch {
        return { ...post, commentsCount: 0 };
      }
    }),
  );

  assert.equal(postsWithComments.length, 2);
  assert.equal(
    postsWithComments[0].commentsCount,
    0,
    'Failed comment query gracefully defaults to 0',
  );
  assert.equal(
    postsWithComments[1].commentsCount,
    8,
    'Sibling comment query succeeds normally',
  );
});

test('HomePage forum empty state: returns empty items cleanly', async () => {
  fetcher = async () => {
    return json({
      items: [],
      meta: { page: 1, pageSize: 3, total: 0, totalPages: 0 },
    });
  };

  const controller = new AbortController();
  const listRes = await forumApi.getForumPosts(
    new URLSearchParams({ pageSize: '3' }),
    controller.signal,
  );

  assert.deepEqual(listRes.items, []);
  assert.equal(listRes.meta.total, 0);
});

test('HomePage forum API error: propagates error for error state handling', async () => {
  fetcher = async () => {
    return new Response(
      JSON.stringify({
        error: { code: 'INTERNAL_ERROR', message: 'Lỗi máy chủ' },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  };

  const controller = new AbortController();
  await assert.rejects(
    async () => {
      await forumApi.getForumPosts(
        new URLSearchParams({ pageSize: '3' }),
        controller.signal,
      );
    },
    /Lỗi máy chủ|INTERNAL_ERROR/,
    'Must reject when forum API is unavailable',
  );
});
