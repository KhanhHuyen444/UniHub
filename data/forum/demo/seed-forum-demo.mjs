import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  getPrismaClient,
  disconnectPrismaClient,
} from '../../../backend/dist/lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runForumDemoSeed({
  apply = false,
  prismaClient = null,
} = {}) {
  const prisma = prismaClient ?? getPrismaClient();

  // 1. Mandatory Database Safety Guard
  const dbResult = await prisma.$queryRawUnsafe('SELECT DATABASE() as db');
  const targetDb = dbResult[0]?.db;
  console.log(`[seed-forum-demo] Current connected database: "${targetDb}"`);

  if (targetDb !== 'unihub_demo') {
    throw new Error(
      `[SECURITY ERROR] Refusing to seed forum demo into non-demo database "${targetDb}". Target database must strictly be "unihub_demo".`,
    );
  }

  // 2. Read fixtures
  const authorsFixture = JSON.parse(
    await readFile(join(__dirname, 'authors-fixture.json'), 'utf-8'),
  );
  const postsFixture = JSON.parse(
    await readFile(join(__dirname, 'posts-fixture.json'), 'utf-8'),
  );
  const commentsFixture = JSON.parse(
    await readFile(join(__dirname, 'comments-fixture.json'), 'utf-8'),
  );

  console.log(
    `[seed-forum-demo] Loaded fixtures: ${authorsFixture.length} authors, ${postsFixture.length} posts, ${commentsFixture.length} comments.`,
  );

  // 3. Resolve active majors for authors
  const activeMajors = await prisma.category.findMany({
    where: { type: 'Major', status: 'Active' },
    select: { category_id: true, name: true },
  });
  const majorMap = new Map(activeMajors.map((m) => [m.name, m.category_id]));

  for (const a of authorsFixture) {
    if (!majorMap.has(a.major_name)) {
      throw new Error(
        `Major "${a.major_name}" required by author ${a.email} is not found in active Categories!`,
      );
    }
  }

  // 4. Dry-run analysis or preparation
  const authorPlan = [];
  for (const a of authorsFixture) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: a.email }, { google_sub: a.google_sub }],
      },
      select: { user_id: true, email: true, full_name: true, role: true },
    });
    if (existing) {
      authorPlan.push({
        action: 'KEEP',
        existingId: existing.user_id,
        data: a,
      });
    } else {
      authorPlan.push({
        action: 'CREATE',
        majorId: majorMap.get(a.major_name),
        data: a,
      });
    }
  }

  const existingAuthorsCount = authorPlan.filter(
    (p) => p.action === 'KEEP',
  ).length;
  const newAuthorsCount = authorPlan.filter(
    (p) => p.action === 'CREATE',
  ).length;

  console.log(
    `[seed-forum-demo] Authors: ${existingAuthorsCount} existing, ${newAuthorsCount} to create.`,
  );

  if (!apply) {
    console.log(
      `[seed-forum-demo] Running in DRY-RUN mode. Analyzing database state...`,
    );

    const authorIdMap = new Map();
    for (const p of authorPlan) {
      if (p.action === 'KEEP') {
        authorIdMap.set(p.data.email, p.existingId);
      }
    }

    let dryPostsExisting = 0;
    let dryPostsToCreate = 0;
    const dryPostMap = new Map();

    for (const p of postsFixture) {
      const authorId = authorIdMap.get(p.author_email);
      if (authorId) {
        const existing = await prisma.forumPost.findFirst({
          where: { author_id: authorId, title: p.title },
          select: { post_id: true },
        });
        if (existing) {
          dryPostMap.set(p.id_key, existing.post_id);
          dryPostsExisting++;
          continue;
        }
      }
      dryPostsToCreate++;
    }

    let dryCommentsExisting = 0;
    let dryCommentsToCreate = 0;

    for (const c of commentsFixture) {
      const postId = dryPostMap.get(c.post_key);
      const authorId = authorIdMap.get(c.author_email);
      if (postId && authorId) {
        const existing = await prisma.comment.findFirst({
          where: { post_id: postId, author_id: authorId, content: c.content },
          select: { comment_id: true },
        });
        if (existing) {
          dryCommentsExisting++;
          continue;
        }
      }
      dryCommentsToCreate++;
    }

    console.log(`[seed-forum-demo] Summary:`);
    console.log(
      `  - Authors: ${existingAuthorsCount} existing, ${newAuthorsCount} to create.`,
    );
    console.log(
      `  - Posts: ${dryPostsExisting} existing, ${dryPostsToCreate} to create.`,
    );
    console.log(
      `  - Comments: ${dryCommentsExisting} existing, ${dryCommentsToCreate} to create.`,
    );
    console.log(`[seed-forum-demo] Dry run completed successfully.`);
    return {
      mode: 'dry-run',
      targetDb,
      authors: { existing: existingAuthorsCount, toCreate: newAuthorsCount },
      posts: { existing: dryPostsExisting, toCreate: dryPostsToCreate },
      comments: {
        existing: dryCommentsExisting,
        toCreate: dryCommentsToCreate,
      },
    };
  }

  // 5. Apply Mode with Database Transaction
  console.log(
    `[seed-forum-demo] Running in APPLY mode. Applying changes to "${targetDb}"...`,
  );

  const runWrites = async (tx) => {
    // 5.1 Seed Authors
    const authorIdByEmail = new Map();
    let authorsCreated = 0;

    for (const plan of authorPlan) {
      if (plan.action === 'KEEP') {
        authorIdByEmail.set(plan.data.email, plan.existingId);
      } else {
        const created = await tx.user.create({
          data: {
            email: plan.data.email,
            google_sub: plan.data.google_sub,
            full_name: plan.data.full_name,
            avatar_url: plan.data.avatar_url,
            role: 'Student',
            major_id: plan.majorId,
            academic_year: plan.data.academic_year,
            career_goal: plan.data.career_goal,
          },
          select: { user_id: true },
        });
        authorIdByEmail.set(plan.data.email, created.user_id);
        authorsCreated++;
      }
    }

    // Anchor time for created_at
    const baseTime = Date.now();

    // 5.2 Seed Posts
    const postIdByKey = new Map();
    const postCreatedAtByKey = new Map();
    let postsCreated = 0;
    let postsExisting = 0;

    for (const p of postsFixture) {
      const authorId = authorIdByEmail.get(p.author_email);
      assert.ok(authorId, `Author ID for ${p.author_email} must exist`);

      const existingPost = await tx.forumPost.findFirst({
        where: {
          author_id: authorId,
          title: p.title,
        },
        select: { post_id: true, created_at: true },
      });

      if (existingPost) {
        postIdByKey.set(p.id_key, existingPost.post_id);
        postCreatedAtByKey.set(p.id_key, existingPost.created_at);
        postsExisting++;
      } else {
        const createdAt = new Date(baseTime - p.relative_hours * 3600 * 1000);
        const createdPost = await tx.forumPost.create({
          data: {
            author_id: authorId,
            topic: p.topic,
            title: p.title,
            content: p.content,
            is_deleted: false,
            created_at: createdAt,
          },
          select: { post_id: true, created_at: true },
        });
        postIdByKey.set(p.id_key, createdPost.post_id);
        postCreatedAtByKey.set(p.id_key, createdPost.created_at);
        postsCreated++;
      }
    }

    // 5.3 Seed Comments
    let commentsCreated = 0;
    let commentsExisting = 0;

    for (const c of commentsFixture) {
      const postId = postIdByKey.get(c.post_key);
      const postCreatedAt = postCreatedAtByKey.get(c.post_key);
      assert.ok(postId, `Post ID for ${c.post_key} must exist`);
      const authorId = authorIdByEmail.get(c.author_email);
      assert.ok(authorId, `Author ID for ${c.author_email} must exist`);

      const existingComment = await tx.comment.findFirst({
        where: {
          post_id: postId,
          author_id: authorId,
          content: c.content,
        },
        select: { comment_id: true },
      });

      if (existingComment) {
        commentsExisting++;
      } else {
        const createdAt = new Date(
          postCreatedAt.getTime() + c.minutes_after * 60 * 1000,
        );
        await tx.comment.create({
          data: {
            post_id: postId,
            author_id: authorId,
            content: c.content,
            is_deleted: false,
            created_at: createdAt,
          },
        });
        commentsCreated++;
      }
    }

    return {
      authorsCreated,
      authorsExisting: existingAuthorsCount,
      postsCreated,
      postsExisting,
      commentsCreated,
      commentsExisting,
    };
  };

  const summary =
    typeof prisma.$transaction === 'function'
      ? await prisma.$transaction(runWrites, {
          timeout: 120000,
          maxWait: 20000,
        })
      : await runWrites(prisma);

  console.log(`[seed-forum-demo] Applied changes:`);
  console.log(
    `  - Authors: ${summary.authorsCreated} created, ${summary.authorsExisting} existing`,
  );
  console.log(
    `  - Posts: ${summary.postsCreated} created, ${summary.postsExisting} existing`,
  );
  console.log(
    `  - Comments: ${summary.commentsCreated} created, ${summary.commentsExisting} existing`,
  );

  // 6. Post-verification (Fixture Dataset Scoped)
  console.log(
    `[seed-forum-demo] Running post-verification in "${targetDb}"...`,
  );

  const fixtureAuthorEmails = authorsFixture.map((a) => a.email);
  const fixtureTitles = postsFixture.map((p) => p.title);

  // 6.1 Verify all fixture posts exist
  const demoPosts = await prisma.forumPost.findMany({
    where: {
      author: { email: { in: fixtureAuthorEmails } },
      title: { in: fixtureTitles },
    },
    select: { post_id: true, topic: true, title: true, is_deleted: true },
  });

  const activeDemoPosts = demoPosts.filter((p) => !p.is_deleted);
  const demoPostIds = demoPosts.map((p) => p.post_id);

  // Group active fixture posts by topic
  const demoTopicCounts = {
    'Học tập': 0,
    'Thực tập': 0,
    'Kinh nghiệm phỏng vấn': 0,
  };
  for (const p of activeDemoPosts) {
    if (demoTopicCounts[p.topic] !== undefined) {
      demoTopicCounts[p.topic]++;
    }
  }

  // 6.2 Verify all fixture comments exist
  const demoCommentsCount = await prisma.comment.count({
    where: {
      post_id: { in: demoPostIds },
      author: { email: { in: fixtureAuthorEmails } },
      is_deleted: false,
    },
  });

  // Global counts for informational logging
  const globalActivePosts = await prisma.forumPost.count({
    where: { is_deleted: false },
  });
  const globalActiveComments = await prisma.comment.count({
    where: { is_deleted: false },
  });

  console.log(`[seed-forum-demo] Verification metrics:`);
  console.log(
    `  - Fixture active posts: ${activeDemoPosts.length} / ${postsFixture.length} (Global: ${globalActivePosts})`,
  );
  console.log(
    `  - Fixture active comments: ${demoCommentsCount} / ${commentsFixture.length} (Global: ${globalActiveComments})`,
  );
  console.log(`  - Fixture topic counts:`, demoTopicCounts);

  assert.equal(
    activeDemoPosts.length,
    postsFixture.length,
    `Fixture must have ${postsFixture.length} active posts`,
  );
  assert.equal(
    demoCommentsCount,
    commentsFixture.length,
    `Fixture must have ${commentsFixture.length} active comments`,
  );
  assert.equal(
    demoTopicCounts['Học tập'],
    8,
    'Học tập must have 8 posts in fixture',
  );
  assert.equal(
    demoTopicCounts['Thực tập'],
    8,
    'Thực tập must have 8 posts in fixture',
  );
  assert.equal(
    demoTopicCounts['Kinh nghiệm phỏng vấn'],
    8,
    'Kinh nghiệm phỏng vấn must have 8 posts in fixture',
  );

  // 6.3 Verify the 3 mandatory posts and their fixture comments
  const post01 = await prisma.forumPost.findFirst({
    where: {
      title:
        'Chia sẻ kinh nghiệm phỏng vấn vị trí Software Intern cho sinh viên năm 3',
      author: { email: 'nguyenhoang2004@gmail.com' },
      is_deleted: false,
    },
    include: {
      comments: {
        where: {
          author: { email: { in: fixtureAuthorEmails } },
          is_deleted: false,
        },
      },
    },
  });
  assert.ok(post01, 'Post 01 must exist');
  assert.equal(
    post01.comments.length,
    18,
    'Post 01 must have exactly 18 fixture comments',
  );

  const post02 = await prisma.forumPost.findFirst({
    where: {
      title:
        'Cách phân bổ thời gian ôn thi chứng chỉ TOEIC và đồ án chuyên ngành hiệu quả',
      author: { email: 'maitran.2004@gmail.com' },
      is_deleted: false,
    },
    include: {
      comments: {
        where: {
          author: { email: { in: fixtureAuthorEmails } },
          is_deleted: false,
        },
      },
    },
  });
  assert.ok(post02, 'Post 02 must exist');
  assert.equal(
    post02.comments.length,
    32,
    'Post 02 must have exactly 32 fixture comments',
  );

  const post03 = await prisma.forumPost.findFirst({
    where: {
      title: 'Nên chuẩn bị gì trước kỳ thực tập doanh nghiệp đầu tiên?',
      author: { email: 'letri.2004@gmail.com' },
      is_deleted: false,
    },
    include: {
      comments: {
        where: {
          author: { email: { in: fixtureAuthorEmails } },
          is_deleted: false,
        },
      },
    },
  });
  assert.ok(post03, 'Post 03 must exist');
  assert.equal(
    post03.comments.length,
    14,
    'Post 03 must have exactly 14 fixture comments',
  );

  console.log(
    `[seed-forum-demo] Verification PASSED: Fixture dataset intact (24 posts: 8/8/8, 136 comments: 18/32/14)!`,
  );

  return {
    mode: 'apply',
    targetDb,
    summary,
    metrics: {
      fixturePosts: activeDemoPosts.length,
      fixtureComments: demoCommentsCount,
      globalPosts: globalActivePosts,
      globalComments: globalActiveComments,
      topicCounts: demoTopicCounts,
    },
  };
}

// CLI runner
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isApply = process.argv.includes('--apply');
  runForumDemoSeed({ apply: isApply })
    .then(() => {
      console.log(`[seed-forum-demo] Completed successfully.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[seed-forum-demo] Failed with error:`, err);
      process.exit(1);
    })
    .finally(() => disconnectPrismaClient());
}
