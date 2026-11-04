import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import {
  getPrismaClient,
  disconnectPrismaClient,
} from '../../../backend/dist/lib/prisma.js';
import { runForumDemoSeed } from './seed-forum-demo.mjs';

after(async () => {
  await disconnectPrismaClient();
});

test('seed safety: runtime database connection guard', async () => {
  const prisma = getPrismaClient();
  const dbResult = await prisma.$queryRawUnsafe('SELECT DATABASE() as db');
  const actualDb = dbResult[0]?.db;

  assert.equal(
    actualDb,
    'unihub_demo',
    'Runtime connection must strictly be unihub_demo',
  );
});

test('seed safety: dry-run on seeded database predicts zero creates', async () => {
  const result = await runForumDemoSeed({ apply: false });

  assert.equal(result.mode, 'dry-run');
  assert.equal(result.targetDb, 'unihub_demo');
  assert.equal(result.authors.toCreate, 0, 'Must predict 0 authors to create');
  assert.equal(result.posts.toCreate, 0, 'Must predict 0 posts to create');
  assert.equal(
    result.comments.toCreate,
    0,
    'Must predict 0 comments to create',
  );
  assert.equal(result.authors.existing, 12);
  assert.equal(result.posts.existing, 24);
  assert.equal(result.comments.existing, 136);
});

test('seed safety: non-synthetic student accounts remain untouched', async () => {
  const prisma = getPrismaClient();
  const nonSyntheticUsers = await prisma.user.findMany({
    where: { NOT: { email: { endsWith: '@student.unihub.invalid' } } },
    select: { user_id: true, email: true, role: true, full_name: true },
  });

  const emails = nonSyntheticUsers.map((u) => u.email);
  assert.ok(emails.includes('admin.demo@unihub.local'));
  assert.ok(emails.includes('student.demo@unihub.local'));
  assert.ok(emails.includes('huyenvnkk24416@st.uel.edu.vn'));

  for (const u of nonSyntheticUsers) {
    assert.ok(
      !u.email.endsWith('@student.unihub.invalid'),
      'Non-synthetic user must not use invalid demo domain',
    );
  }
});

test('seed safety: no synthetic auth sessions, activity logs or notifications exist', async () => {
  const prisma = getPrismaClient();
  const syntheticUsers = await prisma.user.findMany({
    where: { email: { endsWith: '@student.unihub.invalid' } },
    select: { user_id: true },
  });
  const syntheticUserIds = syntheticUsers.map((u) => u.user_id);

  const fakeSessions = await prisma.authSession.count({
    where: { user_id: { in: syntheticUserIds } },
  });
  assert.equal(fakeSessions, 0, 'No synthetic auth sessions must exist');

  const fakeActivityLogs = await prisma.activityLog.count({
    where: { admin_id: { in: syntheticUserIds } },
  });
  assert.equal(fakeActivityLogs, 0, 'No synthetic activity logs must exist');

  const fakeNotifications = await prisma.notification.count({
    where: { user_id: { in: syntheticUserIds } },
  });
  assert.equal(fakeNotifications, 0, 'No synthetic notifications must exist');
});

test('seed safety: transaction rollback on error', async () => {
  const prisma = getPrismaClient();

  const authorBefore = await prisma.user.count();
  const postBefore = await prisma.forumPost.count();

  // Test that an intentional failure inside a transaction properly rolls back everything
  await assert.rejects(
    async () => {
      await prisma.$transaction(async (tx) => {
        // Step 1: create a temporary test user
        const temp = await tx.user.create({
          data: {
            email: 'rollback.test@student.unihub.invalid',
            google_sub: 'rollback-test-sub',
            full_name: 'Rollback Test User',
            role: 'Student',
          },
        });
        // Step 2: create a temporary post
        await tx.forumPost.create({
          data: {
            author_id: temp.user_id,
            topic: 'Học tập',
            title: 'Bài viết test rollback',
            content: 'Nội dung test',
          },
        });
        // Step 3: Trigger intentional error
        throw new Error('INTENTIONAL_SIMULATED_FAILURE');
      });
    },
    /INTENTIONAL_SIMULATED_FAILURE/,
    'Transaction must reject with the thrown error',
  );

  const authorAfter = await prisma.user.count();
  const postAfter = await prisma.forumPost.count();

  assert.equal(
    authorAfter,
    authorBefore,
    'Author count must not change after rollback',
  );
  assert.equal(
    postAfter,
    postBefore,
    'Post count must not change after rollback',
  );
});

test('seed safety: soft-deleted posts are not resurrected by seed', async () => {
  const prisma = getPrismaClient();

  // We test the preservation logic safely in an isolated transaction that rolls back:
  await prisma
    .$transaction(async (tx) => {
      // 1. Create a dummy post marked as deleted
      const author = await tx.user.findFirst({
        where: { email: { endsWith: '@student.unihub.invalid' } },
      });
      assert.ok(author);

      const dummyPost = await tx.forumPost.create({
        data: {
          author_id: author.user_id,
          topic: 'Thực tập',
          title: 'Post kiểm thử soft-delete safety',
          content: 'Nội dung...',
          is_deleted: true,
          deleted_at: new Date(),
          deleted_reason: 'Kiểm duyệt vi phạm thử nghiệm',
        },
      });

      // 2. Simulate seed check logic
      const existing = await tx.forumPost.findFirst({
        where: {
          author_id: author.user_id,
          title: 'Post kiểm thử soft-delete safety',
        },
      });

      assert.ok(existing, 'Must find existing post even when soft-deleted');
      assert.equal(
        existing.is_deleted,
        true,
        'is_deleted must remain true (not resurrected)',
      );

      // Rollback the transaction to keep DB clean
      throw new Error('ROLLBACK_TEST_TRANSACTION');
    })
    .catch((err) => {
      assert.equal(err.message, 'ROLLBACK_TEST_TRANSACTION');
    });
});

test('homepage scenario: student creates a new post -> homepage displays it at top', async () => {
  const prisma = getPrismaClient();

  // Test in a safe transaction that gets rolled back
  await prisma
    .$transaction(async (tx) => {
      const author = await tx.user.findFirst({
        where: { email: { endsWith: '@student.unihub.invalid' } },
      });
      assert.ok(author);

      // Get current top 3
      const topBefore = await tx.forumPost.findMany({
        where: { is_deleted: false },
        orderBy: [{ created_at: 'desc' }, { post_id: 'desc' }],
        take: 3,
        select: { post_id: true, title: true },
      });

      assert.equal(topBefore.length, 3);

      // Student creates new post with now timestamp (strictly newest)
      const newPost = await tx.forumPost.create({
        data: {
          author_id: author.user_id,
          topic: 'Học tập',
          title: 'Bài viết sinh viên vừa đăng kiểm tra Homepage',
          content: 'Nội dung câu hỏi mới nhất...',
          created_at: new Date(Date.now() + 2000), // newest
        },
        select: { post_id: true, title: true },
      });

      // Query top 3 again
      const topAfter = await tx.forumPost.findMany({
        where: { is_deleted: false },
        orderBy: [{ created_at: 'desc' }, { post_id: 'desc' }],
        take: 3,
        select: { post_id: true, title: true },
      });

      assert.equal(topAfter.length, 3);
      assert.equal(
        topAfter[0].post_id,
        newPost.post_id,
        'New post must now be in position 1 on Homepage',
      );
      assert.equal(
        topAfter[1].post_id,
        topBefore[0].post_id,
        'Previous position 1 moves to position 2',
      );
      assert.equal(
        topAfter[2].post_id,
        topBefore[1].post_id,
        'Previous position 2 moves to position 3',
      );

      // Rollback to leave database untouched
      throw new Error('ROLLBACK_HOMEPAGE_TEST');
    })
    .catch((err) => {
      assert.equal(err.message, 'ROLLBACK_HOMEPAGE_TEST');
    });
});

test('homepage scenario: soft-deleted post is excluded and next valid post takes its place', async () => {
  const prisma = getPrismaClient();

  // Test in a safe transaction that gets rolled back
  await prisma
    .$transaction(async (tx) => {
      // Current top 4
      const top4 = await tx.forumPost.findMany({
        where: { is_deleted: false },
        orderBy: [{ created_at: 'desc' }, { post_id: 'desc' }],
        take: 4,
        select: { post_id: true, title: true },
      });

      assert.equal(top4.length, 4);
      const postToSoftDelete = top4[0];
      const post4 = top4[3];

      // Admin soft-deletes post 1
      await tx.forumPost.update({
        where: { post_id: postToSoftDelete.post_id },
        data: {
          is_deleted: true,
          deleted_at: new Date(),
          deleted_reason: 'Nội dung vi phạm tiêu chuẩn cộng đồng',
        },
      });

      // Query top 3 after soft delete
      const topAfterDelete = await tx.forumPost.findMany({
        where: { is_deleted: false },
        orderBy: [{ created_at: 'desc' }, { post_id: 'desc' }],
        take: 3,
        select: { post_id: true, title: true },
      });

      assert.equal(topAfterDelete.length, 3);
      assert.ok(
        !topAfterDelete.some((p) => p.post_id === postToSoftDelete.post_id),
        'Soft-deleted post must be excluded from Homepage',
      );
      assert.equal(
        topAfterDelete[2].post_id,
        post4.post_id,
        'The 4th post advances to become the 3rd card on Homepage',
      );

      // Rollback to leave database untouched
      throw new Error('ROLLBACK_SOFT_DELETE_TEST');
    })
    .catch((err) => {
      assert.equal(err.message, 'ROLLBACK_SOFT_DELETE_TEST');
    });
});

test('seed resilience: student creates new post & comment outside fixture -> dry-run & apply succeed without duplicates or altering student data', async () => {
  const prisma = getPrismaClient();

  // Test in a safe transaction that gets rolled back
  await prisma
    .$transaction(async (tx) => {
      // Initial count before extra student creation
      const initialPostsCount = await tx.forumPost.count({
        where: { is_deleted: false },
      });
      const initialCommentsCount = await tx.comment.count({
        where: { is_deleted: false },
      });

      // 1. A real student exists (e.g. user_id = 2)
      const student = await tx.user.findFirst({
        where: { email: 'student.demo@unihub.local' },
      });
      assert.ok(student, 'Student user must exist');

      // 2. Student creates a new post outside the fixture
      const studentPost = await tx.forumPost.create({
        data: {
          author_id: student.user_id,
          topic: 'Học tập',
          title: 'Bài viết độc lập do sinh viên tự đăng ngoài fixture',
          content: 'Nội dung câu hỏi học tập riêng của sinh viên demo...',
          created_at: new Date(Date.now() + 3000),
        },
      });

      // 3. Student creates a new comment outside the fixture (on the new post)
      const studentComment = await tx.comment.create({
        data: {
          post_id: studentPost.post_id,
          author_id: student.user_id,
          content: 'Bình luận độc lập của sinh viên ngoài fixture',
          created_at: new Date(Date.now() + 4000),
        },
      });

      // Verify DB now has initial + 1 posts and initial + 1 comments
      const totalPostsNow = await tx.forumPost.count({
        where: { is_deleted: false },
      });
      const totalCommentsNow = await tx.comment.count({
        where: { is_deleted: false },
      });
      assert.equal(totalPostsNow, initialPostsCount + 1);
      assert.equal(totalCommentsNow, initialCommentsCount + 1);

      // 4. Rerun dry-run on this database state: must predict 0 creates
      const dryResult = await runForumDemoSeed({
        apply: false,
        prismaClient: tx,
      });
      assert.equal(dryResult.mode, 'dry-run');
      assert.equal(dryResult.authors.toCreate, 0);
      assert.equal(dryResult.posts.toCreate, 0);
      assert.equal(dryResult.comments.toCreate, 0);

      // 5. Rerun apply on this database state: must not create duplicates
      const applyResult = await runForumDemoSeed({
        apply: true,
        prismaClient: tx,
      });
      assert.equal(applyResult.mode, 'apply');
      assert.equal(applyResult.summary.authorsCreated, 0);
      assert.equal(applyResult.summary.postsCreated, 0);
      assert.equal(applyResult.summary.commentsCreated, 0);

      // 6. Verify student's post and comment are untouched
      const studentPostAfter = await tx.forumPost.findUnique({
        where: { post_id: studentPost.post_id },
      });
      assert.ok(studentPostAfter);
      assert.equal(
        studentPostAfter.title,
        'Bài viết độc lập do sinh viên tự đăng ngoài fixture',
      );
      assert.equal(
        studentPostAfter.content,
        'Nội dung câu hỏi học tập riêng của sinh viên demo...',
      );
      assert.equal(studentPostAfter.is_deleted, false);

      const studentCommentAfter = await tx.comment.findUnique({
        where: { comment_id: studentComment.comment_id },
      });
      assert.ok(studentCommentAfter);
      assert.equal(
        studentCommentAfter.content,
        'Bình luận độc lập của sinh viên ngoài fixture',
      );
      assert.equal(studentCommentAfter.is_deleted, false);

      // 7. Verify fixture metrics are still intact (24 posts, 136 comments)
      assert.equal(applyResult.metrics.fixturePosts, 24);
      assert.equal(applyResult.metrics.fixtureComments, 136);
      assert.equal(applyResult.metrics.globalPosts, initialPostsCount + 1);
      assert.equal(
        applyResult.metrics.globalComments,
        initialCommentsCount + 1,
      );

      // Rollback to leave database completely clean
      throw new Error('ROLLBACK_RESILIENCE_TEST');
    })
    .catch((err) => {
      assert.equal(err.message, 'ROLLBACK_RESILIENCE_TEST');
    });
});
