import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  importCategories,
  validateCatalog,
  parseImportArgs,
  importOpportunities,
  validateBatch,
} from '../dist/scripts/opportunities-import.js';
const catalog = JSON.parse(
  await readFile(
    new URL('../../data/catalog/initial-categories.json', import.meta.url),
    'utf8',
  ),
);
function db() {
  const rows = [];
  let writes = 0;
  const client = {
    category: {
      findMany: async () => structuredClone(rows),
      create: async ({ data }) => {
        writes++;
        const row = { category_id: rows.length + 1, ...data };
        rows.push(row);
        return row;
      },
    },
    $transaction: async (fn, options) => {
      assert.equal(options.isolationLevel, 'Serializable');
      const saved = structuredClone(rows);
      try {
        return await fn(client);
      } catch (e) {
        rows.splice(0, rows.length, ...saved);
        throw e;
      }
    },
  };
  Object.defineProperty(client, 'opportunity', {
    get() {
      throw Error('catalog-only touched opportunities');
    },
  });
  return { client, rows, writes: () => writes };
}
test('approved shared file has exactly 11 Major + 19 Skill, type/name only', () => {
  assert.equal(validateCatalog(catalog).length, 30);
  assert.equal(catalog.filter((c) => c.type === 'Major').length, 11);
  assert.equal(catalog.filter((c) => c.type === 'Skill').length, 19);
  assert(catalog.every((c) => Object.keys(c).sort().join(',') === 'name,type'));
  assert(
    !catalog.some(
      (c) =>
        c.name === 'Quản trị' ||
        c.name === 'Kinh doanh' ||
        c.name === 'Microsoft Office' ||
        c.name === 'Google Workspace',
    ),
  );
});
test('strict catalog validation rejects IDs, malformed fields and normalized duplicates', () => {
  for (const value of [
    null,
    [],
    {},
    [{ type: 'major', name: 'A' }],
    [{ type: 'Major', name: ' A' }],
    [{ type: 'Major', name: 'A', id: 1 }],
    [
      { type: 'Major', name: 'A' },
      { type: 'Major', name: 'a' },
    ],
    [{ type: 'Skill', name: 'a\nb' }],
  ])
    assert.throws(() => validateCatalog(value));
  assert.equal(
    validateCatalog([
      { type: 'Major', name: 'A' },
      { type: 'Skill', name: 'A' },
    ]).length,
    2,
  );
});
test('catalog defaults to dry-run and never touches opportunities or transactions', async () => {
  const d = db();
  d.client.$transaction = () => {
    throw Error('unexpected transaction');
  };
  const r = await importCategories(d.client, catalog);
  assert.equal(r.mode, 'dry-run');
  assert.equal(r.writes, 0);
  assert.equal(d.writes(), 0);
  assert.equal(r.plan.categories.length, 30);
});
test('apply creates 30 then rerun reuses without changing existing rows', async () => {
  const d = db();
  assert.equal(
    (await importCategories(d.client, catalog, { apply: true })).created,
    30,
  );
  const before = structuredClone(d.rows);
  const r = await importCategories(d.client, catalog, { apply: true });
  assert.equal(r.created, 0);
  assert.equal(r.reused, 30);
  assert.equal(d.writes(), 30);
  assert.deepEqual(d.rows, before);
});
test('matching is by type plus normalized name; existing spelling and unrelated records stay unchanged', async () => {
  const d = db();
  d.rows.push(
    {
      category_id: 100,
      type: 'Major',
      name: catalog[0].name.toLowerCase(),
      status: 'Active',
    },
    {
      category_id: 101,
      type: 'Skill',
      name: catalog[0].name,
      status: 'Active',
    },
  );
  const before = structuredClone(d.rows);
  const r = await importCategories(d.client, catalog, { apply: true });
  assert.equal(r.created, 29);
  assert.equal(r.reused, 1);
  assert.deepEqual(d.rows.slice(0, 2), before);
});
test('Closed, ambiguous matches and invalid legacy type are blocked and not reopened', async () => {
  for (const rows of [
    [{ ...catalog[0], status: 'Closed' }],
    [
      { ...catalog[0], status: 'Active' },
      { ...catalog[0], status: 'Active' },
    ],
    [{ ...catalog[0], type: 'major', status: 'Active' }],
  ]) {
    const d = db();
    d.rows.push(...rows.map((r, i) => ({ category_id: i + 1, ...r })));
    const before = structuredClone(d.rows);
    const plan = await importCategories(d.client, catalog);
    assert.equal(plan.plan.blocked, true);
    assert(plan.plan.categories[0].reason);
    await assert.rejects(
      importCategories(d.client, catalog, { apply: true }),
      /blocked/,
    );
    assert.deepEqual(d.rows, before);
    assert.equal(d.writes(), 0);
  }
});
test('one transaction rolls back when a middle create fails', async () => {
  const d = db();
  const create = d.client.category.create;
  let n = 0;
  d.client.category.create = async (args) => {
    if (++n === 3) throw Error('injected write error');
    return create(args);
  };
  await assert.rejects(
    importCategories(d.client, catalog, { apply: true }),
    /injected/,
  );
  assert.equal(n, 3);
  assert.deepEqual(d.rows, []);
});
test('CLI is dry-run by default and rejects ambiguous or unsupported arguments', () => {
  assert.deepEqual(parseImportArgs(['--catalog-only']), {
    apply: false,
    catalogOnly: true,
    file: undefined,
  });
  assert.equal(parseImportArgs(['--catalog-only', '--apply']).apply, true);
  assert.equal(
    parseImportArgs(['--catalog-only', '--file', 'input.json']).file,
    'input.json',
  );
  for (const args of [
    ['--apply', '--dry-run'],
    ['--apply', '--apply'],
    ['--file'],
    ['--file', '--apply'],
    ['--unknown'],
  ])
    assert.throws(() => parseImportArgs(args));
});
// Synthetic unit-only opportunities protect the reused importer's existing behavior.
function batch() {
  const item = (
    id,
    title,
    kind = 'listing',
    url = 'https://example.invalid/careers',
  ) => ({
    review_id: id,
    evidence: { source_identity: { url_kind: kind, basis: 'unit fixture' } },
    opportunity: {
      opportunity_type: 'Thực tập',
      title,
      publisher: 'Unit fixture',
      description: 'Fixture description',
      requirements: 'Fixture requirements',
      source_url: url,
      location: null,
      work_format: null,
      deadline: '2099-12-31T17:00:00Z',
      deadline_source_date: '2099-12-31',
      deadline_source_timezone: null,
      status: 'Pending',
      is_verified: false,
      reviewed_by: null,
      reviewed_at: null,
    },
    relations: { major_ids: [], skill_ids: [], academic_years: [3] },
  });
  const items = [
    item('F1', 'One'),
    item('F2', 'Two'),
    item('F3', 'Three', 'detail', 'https://example.invalid/job/3'),
  ];
  return {
    format_version: 2,
    items,
    initial_catalog_proposal: {
      status: 'leader_approved',
      categories: catalog.map((c) => ({ ...c, status: 'leader_approved' })),
      opportunity_links: items.map((x) => ({
        review_id: x.review_id,
        major_names: [],
        skill_names: [],
        status: 'leader_approved',
      })),
    },
  };
}
test('reused full importer accepts different positions on a listing and preserves processed records/tracked detail URLs', async () => {
  const b = batch();
  validateBatch(b);
  const d = db();
  const client = {
    category: d.client.category,
    opportunity: {
      findMany: async () => [
        {
          item_id: 9,
          title: 'Different historic title',
          publisher: 'Historic publisher',
          source_url: 'https://example.invalid/job/3?utm_source=x',
          status: 'Approved',
        },
        {
          item_id: 10,
          title: 'ONE',
          publisher: 'UNIT FIXTURE',
          source_url: 'https://example.invalid/careers',
          status: 'Rejected',
        },
      ],
    },
  };
  const r = await importOpportunities(client, b);
  assert.deepEqual(
    r.plan.opportunities.map((x) => x.action),
    ['skip_existing', 'create', 'skip_existing'],
  );
  assert.equal(r.writes, 0);
  b.items[1].opportunity.title = 'One';
  assert.throws(() => validateBatch(b), /duplicate/);
});
