import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('forum demo: authors fixture validation', async () => {
  const content = await readFile(
    join(__dirname, 'authors-fixture.json'),
    'utf-8',
  );
  const authors = JSON.parse(content);

  assert.equal(
    authors.length,
    12,
    'Must have exactly 12 synthetic student authors',
  );

  const emails = new Set();
  const subs = new Set();

  for (const author of authors) {
    assert.match(
      author.email,
      /^[a-z0-9.]+@student\.unihub\.invalid$/,
      'Email must use @student.unihub.invalid domain',
    );
    assert.equal(
      author.role,
      'Student',
      'Role must strictly be Student (no Admin)',
    );
    assert.ok(
      author.full_name && author.full_name.trim().length > 0,
      'Full name must not be empty',
    );
    assert.ok(
      author.major_name && author.major_name.trim().length > 0,
      'Major name must not be empty',
    );
    assert.ok(
      Number.isInteger(author.academic_year) &&
        author.academic_year >= 1 &&
        author.academic_year <= 5,
      'Academic year must be 1-5',
    );
    assert.ok(
      author.career_goal && author.career_goal.trim().length > 0,
      'Career goal must not be empty',
    );

    assert.ok(!emails.has(author.email), `Duplicate email ${author.email}`);
    assert.ok(
      !subs.has(author.google_sub),
      `Duplicate google_sub ${author.google_sub}`,
    );
    emails.add(author.email);
    subs.add(author.google_sub);
  }
});

test('forum demo: posts fixture validation', async () => {
  const content = await readFile(
    join(__dirname, 'posts-fixture.json'),
    'utf-8',
  );
  const posts = JSON.parse(content);

  assert.equal(posts.length, 24, 'Must have exactly 24 forum posts');

  const topics = {
    'Học tập': 0,
    'Thực tập': 0,
    'Kinh nghiệm phỏng vấn': 0,
  };

  const idKeys = new Set();

  for (const post of posts) {
    assert.ok(
      topics[post.topic] !== undefined,
      `Topic ${post.topic} must be valid enum`,
    );
    topics[post.topic]++;

    assert.ok(!idKeys.has(post.id_key), `Duplicate id_key ${post.id_key}`);
    idKeys.add(post.id_key);

    assert.ok(
      post.title && post.title.trim().length > 0 && post.title.length <= 255,
      'Title must be 1-255 characters',
    );
    assert.ok(
      post.content && post.content.trim().length > 0,
      'Content must not be empty',
    );
    assert.ok(
      post.author_email &&
        post.author_email.endsWith('@student.unihub.invalid'),
      'Author must be a demo student',
    );
    assert.ok(
      typeof post.relative_hours === 'number' && post.relative_hours > 0,
      'relative_hours must be positive number',
    );
  }

  assert.equal(topics['Học tập'], 8, 'Must have 8 posts in Học tập');
  assert.equal(topics['Thực tập'], 8, 'Must have 8 posts in Thực tập');
  assert.equal(
    topics['Kinh nghiệm phỏng vấn'],
    8,
    'Must have 8 posts in Kinh nghiệm phỏng vấn',
  );

  // Verify the 3 mandatory posts
  const post1 = posts.find((p) => p.id_key === 'post-interview-01');
  assert.equal(
    post1.title,
    'Chia sẻ kinh nghiệm phỏng vấn vị trí Software Intern cho sinh viên năm 3',
  );
  assert.equal(post1.topic, 'Kinh nghiệm phỏng vấn');
  assert.equal(post1.relative_hours, 2);

  const post2 = posts.find((p) => p.id_key === 'post-study-01');
  assert.equal(
    post2.title,
    'Cách phân bổ thời gian ôn thi chứng chỉ TOEIC và đồ án chuyên ngành hiệu quả',
  );
  assert.equal(post2.topic, 'Học tập');
  assert.equal(post2.relative_hours, 24);

  const post3 = posts.find((p) => p.id_key === 'post-intern-01');
  assert.equal(
    post3.title,
    'Nên chuẩn bị gì trước kỳ thực tập doanh nghiệp đầu tiên?',
  );
  assert.equal(post3.topic, 'Thực tập');
  assert.equal(post3.relative_hours, 48);
});

test('forum demo: comments fixture validation', async () => {
  const content = await readFile(
    join(__dirname, 'comments-fixture.json'),
    'utf-8',
  );
  const comments = JSON.parse(content);

  assert.equal(comments.length, 136, 'Must have exactly 136 comments in total');

  const counts = {};
  for (const c of comments) {
    assert.ok(c.post_key, 'Comment must reference post_key');
    assert.ok(
      c.author_email && c.author_email.endsWith('@student.unihub.invalid'),
      'Comment author must be demo student',
    );
    assert.ok(
      c.content && c.content.trim().length > 0,
      'Comment content must not be empty',
    );
    assert.ok(
      typeof c.minutes_after === 'number' && c.minutes_after >= 0,
      'minutes_after must be non-negative',
    );

    counts[c.post_key] = (counts[c.post_key] || 0) + 1;
  }

  // Mandatory counts
  assert.equal(
    counts['post-interview-01'],
    18,
    'Post 1 must have exactly 18 comments',
  );
  assert.equal(
    counts['post-study-01'],
    32,
    'Post 2 must have exactly 32 comments',
  );
  assert.equal(
    counts['post-intern-01'],
    14,
    'Post 3 must have exactly 14 comments',
  );

  // Other posts must have 1-5 comments
  for (const [key, count] of Object.entries(counts)) {
    if (
      key !== 'post-interview-01' &&
      key !== 'post-study-01' &&
      key !== 'post-intern-01'
    ) {
      assert.ok(
        count >= 1 && count <= 5,
        `Post ${key} has ${count} comments (expected 1-5)`,
      );
    }
  }
});
