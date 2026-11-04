import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { buildDemo, validateDemo } from './build-demo.mjs';
const read = async (path) =>
  JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const batch = await read('./batch-proposal.json');
const scenarios = await read('./scenarios.json');
const groupFile = await read('../../catalog/major-skill-mapping.json');
const skillFile = await read('../../catalog/expanded-skills.json');
const active = [
  ...Object.values(groupFile.groups)
    .flat()
    .map((x) => ({ type: 'Major', name: x.major, status: 'Active' })),
  ...skillFile.map((x) => ({ ...x, status: 'Active' })),
];

test('100 synthetic items satisfy type totals, active mapping, source identity, metadata and review safety', () => {
  validateDemo(batch, active);
  assert.equal(
    new Set(
      batch.initial_catalog_proposal.opportunity_links.flatMap(
        (l) => l.major_names,
      ),
    ).size,
    101,
  );
  assert.equal(
    batch.items.filter((x) => x.opportunity.deadline === null).length,
    20,
  );
  assert(
    batch.items
      .filter((x) => x.opportunity.opportunity_type === 'Học bổng')
      .every((x) => x.relations.academic_years.length === 0),
  );
  assert(
    batch.initial_catalog_proposal.opportunity_links.some(
      (l) => l.major_names.length > 1 && l.skill_names.length > 1,
    ),
  );
});

test('demo validation rejects duplicate identities, unknown skills, bad years and invalid NULL metadata', () => {
  const mutations = [
    (b) => {
      b.items[1].opportunity.source_url = b.items[0].opportunity.source_url;
    },
    (b) => {
      b.initial_catalog_proposal.opportunity_links[0].skill_names.push(
        'NONEXISTENT DEMO SKILL',
      );
    },
    (b) => {
      b.items[0].relations.academic_years = [5];
    },
    (b) => {
      b.items[0].opportunity.deadline_source_date = '2099-01-01';
    },
    (b) => {
      b.items[0].opportunity.status = 'Approved';
    },
    (b) => {
      b.items[0].opportunity.is_verified = true;
    },
  ];
  for (const mutate of mutations) {
    const copy = structuredClone(batch);
    mutate(copy);
    assert.throws(() => validateDemo(copy, active));
  }
});

test('scenario expectations follow unchanged 40/30/30 and 0.5 threshold; pending remains nonpublic', () => {
  for (const c of scenarios.cases) {
    const item = batch.items.find((x) => x.review_id === c.review_id);
    const link = batch.initial_catalog_proposal.opportunity_links.find(
      (x) => x.review_id === c.review_id,
    );
    assert(item && link);
    assert.equal(item.opportunity.status, 'Pending');
    const major = Number(link.major_names.includes(c.profile.major));
    const year = Number(
      item.relations.academic_years.length === 0 ||
        item.relations.academic_years.includes(c.profile.academic_year),
    );
    const skill =
      link.skill_names.filter((s) => c.profile.skills.includes(s)).length /
      link.skill_names.length;
    const score = 0.4 * major + 0.3 * year + 0.3 * skill;
    assert(Math.abs(score - c.expectedScore) < 0.00001, c.name);
    assert.equal(score >= 0.5, c.expectedVisibleAfterApproval, c.name);
  }
  assert.equal(
    scenarios.cases.find((c) => c.name === 'full_match_and_null_deadline')
      .expectedScore,
    1,
  );
  assert.equal(
    scenarios.cases.find((c) => c.name === 'scholarship_without_year_filter')
      .expectedScore,
    1,
  );
});

const mappings = await read('./reviewed-mapping.json');
test('rerunning mapping synchronization is idempotent and preserves all non-mapping opportunity fields', () => {
  const first = buildDemo(batch, mappings, active);
  assert.deepEqual(
    first.batch,
    batch,
    'Batch must already match the reviewed mapping manifest',
  );
  const second = buildDemo(first.batch, mappings, active);
  assert.deepEqual(second, first);
  for (const [i, item] of first.batch.items.entries()) {
    const before = structuredClone(batch.items[i]),
      after = structuredClone(item);
    delete before.opportunity.description;
    delete before.opportunity.requirements;
    delete after.opportunity.description;
    delete after.opportunity.requirements;
    assert.deepEqual(after, before);
  }
  assert.deepEqual(first.scenarios, scenarios);
});

test('mapping regressions: no coverage padding, wrong-language majors, or mismatched core skills', () => {
  const link = (id) =>
    batch.initial_catalog_proposal.opportunity_links.find(
      (l) => l.review_id === id,
    );
  assert.equal(
    batch.initial_catalog_proposal.opportunity_links.filter(
      (l) => l.major_names.length > 1,
    ).length,
    2,
  );
  assert.deepEqual(link('DEMO-003').major_names, [
    'Kỹ thuật điện',
    'Kỹ thuật điện tử - viễn thông',
  ]);
  assert.deepEqual(link('DEMO-066').major_names, [
    'Lịch sử',
    'Thông tin - Thư viện',
  ]);
  for (const id of [
    'DEMO-004',
    'DEMO-005',
    'DEMO-006',
    'DEMO-013',
    'DEMO-014',
    'DEMO-015',
    'DEMO-016',
    'DEMO-023',
    'DEMO-026',
    'DEMO-033',
    'DEMO-036',
    'DEMO-046',
    'DEMO-056',
    'DEMO-075',
    'DEMO-084',
  ])
    assert.equal(link(id).major_names.length, 1, id);
  for (const [id, required] of [
    ['DEMO-002', 'Quản trị hệ thống mạng'],
    ['DEMO-029', 'Kiểm nghiệm dược phẩm'],
    ['DEMO-032', 'SQL'],
    ['DEMO-053', 'Chẩn đoán hệ thống ô tô'],
    ['DEMO-065', 'Chứng từ xuất nhập khẩu'],
    ['DEMO-068', 'GIS'],
  ])
    assert(link(id).skill_names.includes(required), id);
  assert(!link('DEMO-003').skill_names.includes('Lean Manufacturing'));
  for (const [id, language] of [
    ['DEMO-016', 'Tiếng Trung'],
    ['DEMO-026', 'Tiếng Nhật'],
    ['DEMO-036', 'Tiếng Hàn'],
    ['DEMO-046', 'Tiếng Pháp'],
  ])
    assert(link(id).skill_names.includes(language));
});
