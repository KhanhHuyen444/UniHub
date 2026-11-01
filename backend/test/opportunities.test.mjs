import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { once } from 'node:events';
import { createApp } from '../dist/app.js';
import { createPrismaClient } from '../dist/lib/prisma.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const testDatabaseEnabled = Boolean(databaseUrl);
const evaluatedAt = { value: new Date('2026-11-05T17:00:00.000Z') };
const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const token = `opportunity-api-${nonce}`;

let client;
let server;
let baseUrl;
let reviewer;
let activeMajor;
let secondActiveMajor;
let closedMajor;
let closedSkill;
let skillThatMatches;
const records = {};
const createdOpportunityIds = [];
const createdCategoryIds = [];

function date(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function createOpportunity(label, overrides = {}) {
  const opportunity = await client.opportunity.create({
    data: {
      opportunity_type: 'Thực tập',
      title: `${token} ${label}`,
      description: 'Nội dung minh họa, không chứa HTML.',
      requirements: null,
      publisher: `${token} Nhà tuyển dụng`,
      location: 'Thành phố Hồ Chí Minh',
      work_format: 'Hybrid',
      status: 'Approved',
      is_verified: false,
      source_url: 'https://example.invalid/opportunity',
      reviewed_by: reviewer.user_id,
      reviewed_at: new Date('2026-10-01T00:00:00.000Z'),
      ...overrides,
    },
  });
  createdOpportunityIds.push(opportunity.item_id);
  records[label] = opportunity;
  return opportunity;
}

async function createCategory(type, name, status = 'Active') {
  const category = await client.category.create({
    data: { type, name: `${name} ${nonce}`, status },
  });
  createdCategoryIds.push(category.category_id);
  return category;
}

async function withServer(app, callback) {
  const testServer = app.listen(0, '127.0.0.1');
  await once(testServer, 'listening');
  try {
    return await callback(`http://127.0.0.1:${testServer.address().port}`);
  } finally {
    await new Promise((resolve, reject) => {
      testServer.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

async function request(path) {
  return fetch(`${baseUrl}${path}`);
}

async function getList(query = '') {
  const response = await request(`/api/opportunities${query}`);
  return { response, body: await response.json() };
}

async function getDetail(id) {
  const response = await request(`/api/opportunities/${id}`);
  return { response, body: await response.json() };
}

function enabledTest(name, callback) {
  test(name, { skip: !testDatabaseEnabled }, callback);
}

before(async () => {
  if (!testDatabaseEnabled) return;
  const url = new URL(databaseUrl);
  const schemaName = decodeURIComponent(url.pathname.slice(1));
  if (
    url.protocol !== 'mysql:' ||
    !['127.0.0.1', 'localhost', '::1'].includes(url.hostname) ||
    !schemaName.startsWith('unihub_opportunity_test')
  ) {
    throw new Error(
      'TEST_DATABASE_URL must point to a loopback-only, isolated unihub_opportunity_test* database.',
    );
  }

  client = createPrismaClient(databaseUrl);
  await client.$connect();
  reviewer = await client.user.create({
    data: {
      email: `${token}@example.invalid`,
      full_name: 'UniHub API test reviewer',
      role: 'Admin',
    },
  });
  activeMajor = await createCategory('Major', 'Ngành Active');
  secondActiveMajor = await createCategory('Major', 'Ngành Active phụ');
  closedMajor = await createCategory('Major', 'Ngành Closed', 'Closed');
  closedSkill = await createCategory('Skill', 'Kỹ năng Closed', 'Closed');
  skillThatMatches = await createCategory('Skill', 'Kỹ năng phân tích dữ liệu');

  records.dateOnly = await createOpportunity('date-only 05/11', {
    deadline: new Date('2026-11-05T17:00:00.000Z'),
    deadline_source_date: date('2026-11-05'),
  });
  records.dateOnlyTie = await createOpportunity('date-only 05/11 tie', {
    deadline: new Date('2026-11-05T17:00:00.000Z'),
    deadline_source_date: date('2026-11-05'),
  });
  records.dateOnlyFuture = await createOpportunity('date-only 06/11', {
    deadline: new Date('2026-11-06T17:00:00.000Z'),
    deadline_source_date: date('2026-11-06'),
    is_verified: true,
  });
  records.datetimeSameInstant = await createOpportunity(
    'datetime 06/11 midnight',
    {
      deadline: new Date('2026-11-05T17:00:00.000Z'),
      deadline_source_timezone: 'Asia/Ho_Chi_Minh',
    },
  );
  records.datetimeTie = await createOpportunity('datetime same instant tie', {
    deadline: new Date('2026-11-05T17:00:00.000Z'),
    deadline_source_timezone: 'Asia/Ho_Chi_Minh',
  });
  records.datetimeExpired = await createOpportunity('datetime expired', {
    deadline: new Date('2026-11-05T16:59:59.000Z'),
    deadline_source_timezone: 'Asia/Ho_Chi_Minh',
  });
  records.unknown = await createOpportunity('legacy unknown', {
    deadline: new Date('2026-10-30T08:00:00.000Z'),
  });
  records.unknownTie = await createOpportunity('legacy unknown tie', {
    deadline: new Date('2026-10-01T08:00:00.000Z'),
  });
  records.noDeadline = await createOpportunity('no deadline', {
    deadline: null,
  });
  records.search = await createOpportunity('Học bổng Café Việt');
  records.publisherSearch = await createOpportunity('đơn vị tên thường');
  records.specialPercent = await createOpportunity(
    'literal marker 100% complete',
  );
  records.specialUnderscore = await createOpportunity(
    'literal marker under_score',
  );
  records.specialBackslash = await createOpportunity(
    'literal marker back\\slash',
  );
  records.nonPublicPending = await createOpportunity('pending opportunity', {
    status: 'Pending',
  });
  records.nonPublicRejected = await createOpportunity('rejected opportunity', {
    status: 'Rejected',
  });
  records.nonPublicGuidance = await createOpportunity('guidance article', {
    opportunity_type: 'Bài viết định hướng',
  });
  records.nonPublicWrongCaseType = await createOpportunity(
    'invalid lowercase type',
    { opportunity_type: 'thực tập' },
  );
  records.publicJob = await createOpportunity('public job', {
    opportunity_type: 'Việc làm',
  });
  records.publicScholarship = await createOpportunity('public scholarship', {
    opportunity_type: 'Học bổng',
  });
  records.publicOnline = await createOpportunity('public online', {
    work_format: 'Online',
    location: null,
  });

  await client.opportunityMajor.createMany({
    data: [
      { item_id: records.search.item_id, major_id: activeMajor.category_id },
      {
        item_id: records.search.item_id,
        major_id: secondActiveMajor.category_id,
      },
      { item_id: records.search.item_id, major_id: closedMajor.category_id },
    ],
  });
  await client.opportunitySkill.createMany({
    data: [
      { item_id: records.search.item_id, skill_id: closedSkill.category_id },
      {
        item_id: records.search.item_id,
        skill_id: skillThatMatches.category_id,
      },
    ],
  });
  await client.opportunityYear.createMany({
    data: [
      { item_id: records.search.item_id, academic_year: 2 },
      { item_id: records.search.item_id, academic_year: 3 },
    ],
  });
  await client.opportunitySkill.create({
    data: {
      item_id: records.publicJob.item_id,
      skill_id: skillThatMatches.category_id,
    },
  });

  const app = createApp({
    opportunities: {
      getPrismaClient: () => client,
      getEvaluatedAt: () => new Date(evaluatedAt.value),
    },
  });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
  if (client) {
    if (createdOpportunityIds.length) {
      await client.opportunityYear.deleteMany({
        where: { item_id: { in: createdOpportunityIds } },
      });
      await client.opportunitySkill.deleteMany({
        where: { item_id: { in: createdOpportunityIds } },
      });
      await client.opportunityMajor.deleteMany({
        where: { item_id: { in: createdOpportunityIds } },
      });
      await client.opportunity.deleteMany({
        where: { item_id: { in: createdOpportunityIds } },
      });
    }
    if (createdCategoryIds.length) {
      await client.category.deleteMany({
        where: { category_id: { in: createdCategoryIds } },
      });
    }
    if (reviewer) {
      await client.user.delete({ where: { user_id: reviewer.user_id } });
    }
    await client.$disconnect();
  }
});

enabledTest(
  'list/detail chỉ công khai Approved thuộc ba loại cơ hội',
  async () => {
    const { response, body } = await getList(`?q=${encodeURIComponent(token)}`);
    assert.equal(response.status, 200);
    const ids = body.items.map((item) => item.id);
    assert.ok(ids.includes(records.publicJob.item_id));
    assert.ok(ids.includes(records.publicScholarship.item_id));
    assert.ok(!ids.includes(records.nonPublicPending.item_id));
    assert.ok(!ids.includes(records.nonPublicRejected.item_id));
    assert.ok(!ids.includes(records.nonPublicGuidance.item_id));
    assert.ok(!ids.includes(records.nonPublicWrongCaseType.item_id));
    for (const item of body.items) {
      assert.equal(Object.hasOwn(item, 'status'), false);
      assert.equal(Object.hasOwn(item, 'reviewedBy'), false);
      assert.equal(Object.hasOwn(item, 'descriptionText'), false);
    }

    for (const hidden of [
      records.nonPublicPending,
      records.nonPublicRejected,
      records.nonPublicGuidance,
      records.nonPublicWrongCaseType,
    ]) {
      const detail = await getDetail(hidden.item_id);
      assert.equal(detail.response.status, 404);
      assert.deepEqual(detail.body, {
        error: { code: 'NOT_FOUND', message: 'Không tìm thấy cơ hội.' },
      });
    }
    const nonexistent = await getDetail(2_147_483_647);
    assert.equal(nonexistent.response.status, 404);
    assert.deepEqual(nonexistent.body, {
      error: { code: 'NOT_FOUND', message: 'Không tìm thấy cơ hội.' },
    });
  },
);

enabledTest(
  'response chỉ chứa trường công khai và giữ Major/Skill Closed đã liên kết',
  async () => {
    const { response, body } = await getDetail(records.search.item_id);
    assert.equal(response.status, 200);
    assert.deepEqual(body.meta, { evaluatedAt: '2026-11-05T17:00:00Z' });
    assert.deepEqual(
      body.item.majors.map((major) => major.id).sort((a, b) => a - b),
      [
        activeMajor.category_id,
        closedMajor.category_id,
        secondActiveMajor.category_id,
      ].sort((a, b) => a - b),
    );
    assert.ok(
      body.item.skills.some((skill) => skill.id === closedSkill.category_id),
    );
    assert.deepEqual(body.item.eligibleAcademicYears, [2, 3]);
    for (const forbidden of [
      'status',
      'reviewedBy',
      'reviewedAt',
      'reviewed_by',
      'created_at',
      'role',
      'email',
      'activityLogs',
    ]) {
      assert.equal(Object.hasOwn(body.item, forbidden), false, forbidden);
    }

    const noYears = await getDetail(records.publicJob.item_id);
    assert.deepEqual(noYears.body.item.eligibleAcademicYears, []);
    assert.equal(noYears.body.item.isVerified, false);
    const verified = await getDetail(records.dateOnlyFuture.item_id);
    assert.equal(verified.body.item.isVerified, true);
    const online = await getDetail(records.publicOnline.item_id);
    assert.equal(online.body.item.location, null);
  },
);

enabledTest(
  'Tìm kiếm dùng collation tiếng Việt, OR trên trường và literal wildcard',
  async () => {
    const accentInsensitiveCase = await getList(
      `?q=${encodeURIComponent('Café')}`,
    );
    assert.ok(
      accentInsensitiveCase.body.items.some(
        (item) => item.id === records.search.item_id,
      ),
    );
    const normalizedNfc = await getList(
      `?q=${encodeURIComponent('Cafe\u0301')}`,
    );
    assert.ok(
      normalizedNfc.body.items.some(
        (item) => item.id === records.search.item_id,
      ),
    );
    const accentSensitive = await getList(`?q=${encodeURIComponent('Cafe')}`);
    assert.ok(
      !accentSensitive.body.items.some(
        (item) => item.id === records.search.item_id,
      ),
    );
    const publisherMatch = await getList(
      `?q=${encodeURIComponent('nhà tuyển dụng')}`,
    );
    assert.ok(publisherMatch.body.items.length > 0);
    const skillMatch = await getList(
      `?q=${encodeURIComponent(skillThatMatches.name)}`,
    );
    assert.equal(skillMatch.body.meta.total, 2);
    assert.equal(new Set(skillMatch.body.items.map((item) => item.id)).size, 2);
    const closedSkillMatch = await getList(
      `?q=${encodeURIComponent(closedSkill.name)}`,
    );
    assert.deepEqual(
      closedSkillMatch.body.items.map((item) => item.id),
      [records.search.item_id],
    );
    const injectionLike = await getList(
      `?q=${encodeURIComponent("' OR 1=1 --")}`,
    );
    assert.equal(injectionLike.body.meta.total, 0);

    for (const [term, fixture] of [
      ['%', records.specialPercent],
      ['_', records.specialUnderscore],
      ['\\', records.specialBackslash],
    ]) {
      const result = await getList(`?q=${encodeURIComponent(term)}`);
      assert.deepEqual(
        result.body.items.map((item) => item.id),
        [fixture.item_id],
      );
    }
  },
);

enabledTest(
  'list Skills include Closed links, match detail ordering and keep empty links as []',
  async () => {
    const { response, body } = await getList(
      `?q=${encodeURIComponent(token)}&pageSize=100`,
    );
    assert.equal(response.status, 200);
    const listed = body.items.find(
      (item) => item.id === records.search.item_id,
    );
    const detail = await getDetail(records.search.item_id);
    assert.deepEqual(listed.skills, detail.body.item.skills);
    assert.ok(
      listed.skills.some((skill) => skill.id === closedSkill.category_id),
    );
    assert.deepEqual(
      body.items.find((item) => item.id === records.publicOnline.item_id)
        .skills,
      [],
    );
    for (const item of body.items)
      for (const skill of item.skills)
        assert.deepEqual(Object.keys(skill).sort(), ['id', 'name']);
  },
);

enabledTest(
  'filters validate strictly and Major Closed/nonexistent/wrong type are INVALID_FILTER',
  async () => {
    for (const query of [
      '?sort=title',
      '?type=Bài%20viết%20định%20hướng',
      '?workFormat=Remote',
      '?page=0',
      '?page=1.5',
      '?pageSize=101',
      '?q=a&q=b',
      '?majorId=1&majorId=2',
    ]) {
      const { response, body } = await getList(query);
      assert.equal(response.status, 400, query);
      assert.equal(body.error.code, 'INVALID_QUERY', query);
    }
    const longQuery = await getList(`?q=${'x'.repeat(101)}`);
    assert.equal(longQuery.response.status, 400);
    assert.equal(longQuery.body.error.code, 'INVALID_QUERY');

    for (const majorId of [
      closedMajor.category_id,
      skillThatMatches.category_id,
      2_147_483_647,
      'not-a-number',
    ]) {
      const { response, body } = await getList(`?majorId=${majorId}`);
      assert.equal(response.status, 400);
      assert.equal(body.error.code, 'INVALID_FILTER');
    }
    const badId = await getDetail('0');
    assert.equal(badId.response.status, 400);
    assert.equal(badId.body.error.code, 'INVALID_ID');
    const overflowId = await getDetail('2147483648');
    assert.equal(overflowId.response.status, 400);
    assert.equal(overflowId.body.error.code, 'INVALID_ID');
  },
);

enabledTest(
  'page/total lọc tại MySQL, trang ngoài phạm vi rỗng và item không trùng',
  async () => {
    const all = await getList(`?q=${encodeURIComponent(token)}&pageSize=100`);
    assert.equal(all.response.status, 200);
    const allIds = all.body.items.map((item) => item.id);
    assert.equal(all.body.meta.total, allIds.length);
    assert.equal(new Set(allIds).size, allIds.length);
    assert.equal(all.body.meta.totalPages, 1);

    const firstPage = await getList(
      `?q=${encodeURIComponent(token)}&page=1&pageSize=2`,
    );
    const secondPage = await getList(
      `?q=${encodeURIComponent(token)}&page=2&pageSize=2`,
    );
    assert.equal(firstPage.body.meta.total, allIds.length);
    assert.equal(secondPage.body.meta.total, allIds.length);
    assert.equal(
      new Set(
        [...firstPage.body.items, ...secondPage.body.items].map(
          (item) => item.id,
        ),
      ).size,
      4,
    );

    const outside = await getList(
      `?q=${encodeURIComponent(token)}&page=1000000&pageSize=100`,
    );
    assert.equal(outside.response.status, 200);
    assert.deepEqual(outside.body.items, []);
    assert.equal(outside.body.meta.total, allIds.length);
    assert.equal(outside.body.meta.page, 1_000_000);
    assert.equal(outside.body.meta.totalPages, 1);

    const empty = await getList('?q=this-term-does-not-exist');
    assert.equal(empty.response.status, 200);
    assert.deepEqual(empty.body.items, []);
    assert.equal(empty.body.meta.total, 0);
    assert.equal(empty.body.meta.totalPages, 0);
  },
);

enabledTest(
  'major/type/workFormat filters combine with AND without duplicate rows',
  async () => {
    const major = await getList(
      `?majorId=${activeMajor.category_id}&q=${encodeURIComponent('kỹ năng phân tích dữ liệu')}`,
    );
    assert.equal(major.body.meta.total, 1);
    assert.deepEqual(
      major.body.items.map((item) => item.id),
      [records.search.item_id],
    );

    const combined = await getList(
      `?majorId=${activeMajor.category_id}&type=Thực%20tập&workFormat=Hybrid&q=${encodeURIComponent('kỹ năng phân tích dữ liệu')}`,
    );
    assert.equal(combined.body.meta.total, 1);
    assert.deepEqual(
      combined.body.items.map((item) => item.id),
      [records.search.item_id],
    );
  },
);

enabledTest(
  'deadline date-only/datetime/NULL/unknown giữ precision, ngày và cutoff',
  async () => {
    const beforeCutoff = new Date('2026-11-05T16:59:59.000Z');
    evaluatedAt.value = beforeCutoff;
    const dateBefore = await getDetail(records.dateOnly.item_id);
    assert.deepEqual(dateBefore.body.item.deadline, {
      precision: 'date',
      date: '2026-11-05',
      sourceTimeZone: null,
      instant: '2026-11-05T17:00:00Z',
      state: 'open',
    });

    evaluatedAt.value = new Date('2026-11-05T17:00:00.000Z');
    const dateAtCutoff = await getDetail(records.dateOnly.item_id);
    assert.equal(dateAtCutoff.body.item.deadline.state, 'expired');
    const sameInstantDatetime = await getDetail(
      records.datetimeSameInstant.item_id,
    );
    assert.deepEqual(sameInstantDatetime.body.item.deadline, {
      precision: 'datetime',
      date: '2026-11-06',
      sourceTimeZone: 'Asia/Ho_Chi_Minh',
      instant: '2026-11-05T17:00:00Z',
      state: 'open',
    });
    assert.equal(
      sameInstantDatetime.body.item.deadline.instant,
      dateAtCutoff.body.item.deadline.instant,
    );

    const unknown = await getDetail(records.unknown.item_id);
    assert.deepEqual(unknown.body.item.deadline, {
      precision: 'unknown',
      date: null,
      sourceTimeZone: null,
      instant: '2026-10-30T08:00:00Z',
      state: 'unknown',
    });
    const noDeadline = await getDetail(records.noDeadline.item_id);
    assert.equal(noDeadline.body.item.deadline, null);

    const previousTz = process.env.TZ;
    process.env.TZ = 'Pacific/Honolulu';
    try {
      const timezoneIndependentDate = await getDetail(records.dateOnly.item_id);
      assert.equal(
        timezoneIndependentDate.body.item.deadline.date,
        '2026-11-05',
      );
    } finally {
      if (previousTz === undefined) delete process.env.TZ;
      else process.env.TZ = previousTz;
    }
  },
);

enabledTest(
  'thứ tự là open → no deadline → unknown → expired với tie-break ổn định',
  async () => {
    evaluatedAt.value = new Date('2026-11-05T17:00:00.000Z');
    const { body } = await getList(
      `?q=${encodeURIComponent(token)}&pageSize=100`,
    );
    const items = body.items;
    const byId = new Map(items.map((item) => [item.id, item]));
    const ranks = items.map((item) => {
      const deadline = byId.get(item.id).deadline;
      if (deadline?.state === 'open') return 0;
      if (deadline === null) return 1;
      if (deadline?.state === 'unknown') return 2;
      return 3;
    });
    assert.deepEqual(
      ranks,
      [...ranks].sort((a, b) => a - b),
    );
    const expectedOpen = [
      records.datetimeSameInstant,
      records.datetimeTie,
      records.dateOnlyFuture,
    ]
      .map((row) => row.item_id)
      .sort((a, b) => {
        const left = byId.get(a).deadline;
        const right = byId.get(b).deadline;
        const leftInstant = left?.instant ?? '9999';
        const rightInstant = right?.instant ?? '9999';
        return leftInstant.localeCompare(rightInstant) || a - b;
      });
    const openIds = items
      .filter((item) => item.deadline?.state === 'open')
      .map((item) => item.id);
    assert.deepEqual(openIds, expectedOpen);
    const nullIds = items
      .filter((item) => item.deadline === null)
      .map((item) => item.id);
    assert.deepEqual(
      nullIds,
      [...nullIds].sort((a, b) => a - b),
    );
    const unknownIds = items
      .filter((item) => item.deadline?.state === 'unknown')
      .map((item) => item.id);
    assert.deepEqual(
      unknownIds,
      [...unknownIds].sort((a, b) => a - b),
    );
    assert.deepEqual(unknownIds, [
      records.unknown.item_id,
      records.unknownTie.item_id,
    ]);
    const expiredIds = items
      .filter((item) => item.deadline?.state === 'expired')
      .map((item) => item.id);
    assert.deepEqual(
      expiredIds,
      [...expiredIds].sort((a, b) => {
        const left = byId.get(a).deadline.instant;
        const right = byId.get(b).deadline.instant;
        return left.localeCompare(right) || a - b;
      }),
    );
    assert.deepEqual(expiredIds, [
      records.datetimeExpired.item_id,
      records.dateOnly.item_id,
      records.dateOnlyTie.item_id,
    ]);
  },
);

test('database connectivity error returns 503, distinct from an empty list', async () => {
  const app = createApp({
    opportunities: {
      getPrismaClient: () => {
        throw Object.assign(new Error('private host details'), {
          code: 'ECONNREFUSED',
        });
      },
    },
  });
  await withServer(app, async (url) => {
    const response = await fetch(`${url}/api/opportunities`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database hiện không sẵn sàng.',
      },
    });
  });
});
