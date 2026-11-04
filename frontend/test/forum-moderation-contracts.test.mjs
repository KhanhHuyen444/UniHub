import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseModerationQueue,
  parseRemoveModerationTarget,
} from '../src/features/admin/forum/contracts.ts';

const createdAt = '2026-10-28T00:00:00Z';
const author = { id: 4, fullName: 'Sinh viên A', avatarUrl: null };

test('parses post and comment items from moderation queue response', () => {
  const parsed = parseModerationQueue({
    items: [
      {
        targetType: 'Post',
        id: 8,
        title: 'Bài viết cần rà soát',
        topic: 'Học tập',
        content: 'Nội dung bài viết',
        author,
        createdAt,
      },
      {
        targetType: 'Comment',
        id: 8,
        post: { id: 8, title: 'Bài viết cha' },
        content: 'Nội dung bình luận',
        author,
        createdAt,
      },
    ],
    meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
  });

  assert.deepEqual(
    parsed.items.map(({ targetType, id }) => [targetType, id]),
    [
      ['Post', 8],
      ['Comment', 8],
    ],
  );
  assert.equal(parsed.items[1].targetType, 'Comment');
  if (parsed.items[1].targetType === 'Comment') {
    assert.equal(parsed.items[1].post.title, 'Bài viết cha');
  }
});

test('rejects moderation removal response for a different target', () => {
  assert.throws(
    () =>
      parseRemoveModerationTarget(
        {
          removed: {
            targetType: 'Comment',
            id: 8,
            isDeleted: true,
            deletedAt: createdAt,
          },
        },
        'Post',
        8,
      ),
    { name: 'ModerationContractError', code: 'INVALID_RESPONSE' },
  );
});
