import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseForumList,
  parseForumPost,
  parseForumCommentResponse,
  parseCommentList,
  formatForumDate,
} from '../src/features/forum/contracts.ts';

function post(overrides = {}) {
  return {
    id: 1,
    title: 'Tiêu đề bài viết',
    topic: 'Học tập',
    content: 'Nội dung chia sẻ học tập.',
    author: {
      fullName: 'Sinh viên A',
      avatarUrl: null,
    },
    createdAt: '2026-10-28T00:00:00Z',
    ...overrides,
  };
}

function comment(overrides = {}) {
  return {
    id: 10,
    content: 'Bình luận hay quá!',
    author: {
      fullName: 'Sinh viên B',
      avatarUrl: 'https://avatar.invalid/b.jpg',
    },
    createdAt: '2026-10-28T01:00:00Z',
    ...overrides,
  };
}

test('parseForumList parses valid list response and preserves fields', () => {
  const raw = {
    items: [post()],
    meta: {
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    },
  };
  const parsed = parseForumList(raw);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].id, 1);
  assert.equal(parsed.items[0].title, 'Tiêu đề bài viết');
  assert.equal(parsed.items[0].topic, 'Học tập');
  assert.equal(parsed.items[0].author.fullName, 'Sinh viên A');
  assert.equal(parsed.items[0].author.avatarUrl, null);
  assert.equal(parsed.meta.total, 1);
});

test('parseForumList rejects invalid topics', () => {
  const raw = {
    items: [post({ topic: 'Chủ đề lạ' })],
    meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  };
  assert.throws(() => parseForumList(raw), {
    name: 'ForumContractError',
    code: 'INVALID_RESPONSE',
  });
});

test('parseForumPost parses single post response', () => {
  const raw = { post: post() };
  const parsed = parseForumPost(raw);
  assert.equal(parsed.post.id, 1);
  assert.equal(parsed.post.title, 'Tiêu đề bài viết');
});

test('parseCommentList parses comments and meta', () => {
  const raw = {
    items: [comment()],
    meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  };
  const parsed = parseCommentList(raw);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].id, 10);
  assert.equal(parsed.items[0].author.fullName, 'Sinh viên B');
});

test('parseForumCommentResponse parses the POST comment DTO', () => {
  const parsed = parseForumCommentResponse({ comment: comment() });
  assert.equal(parsed.comment.id, 10);
  assert.equal(parsed.comment.content, 'Bình luận hay quá!');
  assert.equal(parsed.comment.author.fullName, 'Sinh viên B');
});

test('formatForumDate formats ISO instant safely', () => {
  const formatted = formatForumDate('2026-10-28T00:00:00Z');
  assert.ok(formatted.includes('2026'));
  assert.ok(formatted.includes('28'));
});
