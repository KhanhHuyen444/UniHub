import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { listPublicOpportunities } from '../dist/modules/opportunities/opportunities.service.js';
import { createApp } from '../dist/app.js';

const now = new Date('2026-11-10T03:00:00Z');
function fixture(
  ids,
  skillRows = [],
  { failSkills = false, total = 301 } = {},
) {
  const calls = [];
  const tx = {
    $queryRaw: async (query) => {
      calls.push(query);
      if (query.sql.startsWith('SELECT COUNT'))
        return [{ total: BigInt(total) }];
      if (query.sql.startsWith('SELECT o.item_id'))
        return ids.map((item_id) => ({ item_id }));
      assert.match(
        query.sql,
        /SELECT os.item_id, skill.category_id AS skill_id, skill.name/,
      );
      assert.deepEqual(query.values, ids);
      assert.match(
        query.sql,
        /skill.type COLLATE utf8mb4_0900_as_cs = 'Skill'/,
      );
      assert.doesNotMatch(query.sql, /skill.status|Active|LIMIT|OFFSET/);
      assert.match(
        query.sql,
        /ORDER BY os.item_id ASC, skill.name ASC, skill.category_id ASC/,
      );
      if (failSkills)
        throw Object.assign(new Error('private fixture'), {
          code: 'ECONNREFUSED',
        });
      return skillRows;
    },
    opportunity: {
      findMany: async ({ where, select }) => {
        assert.deepEqual(where.item_id.in, ids);
        assert.equal(select.skills, undefined);
        calls.push('rows');
        return [...ids].reverse().map((item_id) => ({
          item_id,
          opportunity_type: 'Thực tập',
          title: 'Fixture',
          publisher: 'Publisher',
          work_format: 'Hybrid',
          location: 'VN',
          deadline: null,
          deadline_source_date: null,
          deadline_source_timezone: null,
          is_verified: false,
        }));
      },
    },
  };
  return { client: { $transaction: async (callback) => callback(tx) }, calls };
}

test('one Skills SQL batch after pagination for 1/3/100 cards; no N+1, count/order unchanged', async () => {
  for (const size of [1, 3, 100]) {
    const ids = Array.from({ length: size }, (_, index) => size - index);
    const { client, calls } = fixture(
      ids,
      ids.map((item_id) => ({
        item_id,
        skill_id: item_id + 1000,
        name: `Skill ${item_id}`,
        status: 'Closed',
        private: 'omit',
      })),
    );
    const result = await listPublicOpportunities(
      client,
      `/api/opportunities?page=2&pageSize=${size}&q=React&type=Thực+tập&workFormat=Hybrid`,
      now,
    );
    assert.deepEqual(
      result.items.map((item) => item.id),
      ids,
    );
    assert.deepEqual(result.meta, {
      page: 2,
      pageSize: size,
      total: 301,
      totalPages: Math.ceil(301 / size),
      evaluatedAt: '2026-11-10T03:00:00Z',
    });
    assert.equal(calls.length, 4); // count, page IDs, page rows, Skills batch
    assert.deepEqual(calls[1].values.slice(-2), [size, size]);
    assert.match(calls[0].sql, /EXISTS/); // existing keyword Skill predicate still used
    assert.match(calls[1].sql, /LIMIT \? OFFSET \?/);
    assert.equal(calls[2], 'rows');
    for (const item of result.items)
      assert.deepEqual(item.skills, [
        { id: item.id + 1000, name: `Skill ${item.id}` },
      ]);
  }
});

test('multiple linked Skills, empty links, Closed names and SQL name/ID order are preserved', async () => {
  const { client } = fixture(
    [7, 2, 8],
    [
      { item_id: 2, skill_id: 20, name: 'SQL' },
      { item_id: 7, skill_id: 90, name: 'Closed Skill' },
      { item_id: 7, skill_id: 91, name: 'React, Next.js' },
    ],
  );
  const result = await listPublicOpportunities(
    client,
    '/api/opportunities?pageSize=3',
    now,
  );
  assert.deepEqual(
    result.items.map((item) => item.skills),
    [
      [
        { id: 90, name: 'Closed Skill' },
        { id: 91, name: 'React, Next.js' },
      ],
      [{ id: 20, name: 'SQL' }],
      [],
    ],
  );
  assert.equal(result.meta.total, 301);
});

test('empty/out-of-range pages skip both row fetch and Skills batch, retaining total', async () => {
  for (const total of [0, 301]) {
    const { client, calls } = fixture([], [], { total });
    const result = await listPublicOpportunities(
      client,
      '/api/opportunities?page=999&pageSize=6',
      now,
    );
    assert.deepEqual(result.items, []);
    assert.equal(result.meta.total, total);
    assert.equal(calls.length, 2);
  }
});

async function http(client, run) {
  const server = createApp({
    opportunities: { getPrismaClient: () => client },
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
test('public HTTP list returns only Skill id/name, empty array and safe error on failed batch', async () => {
  const { client } = fixture(
    [1, 2],
    [
      {
        item_id: 1,
        skill_id: 11,
        name: '<script>văn bản</script>',
        status: 'Closed',
      },
    ],
  );
  await http(client, async (base) => {
    const response = await fetch(base + '/api/opportunities');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.items[0].skills, [
      { id: 11, name: '<script>văn bản</script>' },
    ]);
    assert.deepEqual(body.items[1].skills, []);
  });
  await http(fixture([1], [], { failSkills: true }).client, async (base) => {
    const response = await fetch(base + '/api/opportunities');
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.error.code, 'SERVICE_UNAVAILABLE');
    assert.equal(body.items, undefined);
    assert.doesNotMatch(JSON.stringify(body), /private fixture/);
  });
});
