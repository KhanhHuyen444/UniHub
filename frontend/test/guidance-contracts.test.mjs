import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseGuidanceList,
  parseGuidanceDetail,
  isGuidanceId,
} from '../src/features/guidance/contracts.ts';

const major = { id: 4, name: 'Test Major', type: 'Major' };
const summary = () => ({
  id: 81,
  title: 'Test article',
  requiredSkills: [{ id: 31, name: 'SQL' }],
  createdAt: '2026-10-01T00:00:00Z',
});
const list = () => ({
  selectedMajor: { ...major },
  stages: [{ academicYear: 2, items: [summary()] }],
});
const detail = () => ({
  item: {
    id: 81,
    title: 'Test article',
    publisher: null,
    descriptionText: 'Plain text\n<b>display as text</b>',
    requirementsText: null,
    majors: [{ id: 4, name: 'Test Major', status: 'Active' }],
    skills: [{ id: 31, name: 'SQL', status: 'Closed' }],
    academicYears: [1, 4],
    createdAt: '2026-10-01T00:00:00.000Z',
  },
});
const invalid = { code: 'INVALID_RESPONSE', kind: 'response' };

test('valid list: preserves backend content, stage/item/skill order and timestamps', () => {
  const value = list();
  value.stages.push({ academicYear: 4, items: [{ ...summary(), id: 99 }] });
  assert.deepEqual(parseGuidanceList(value), value);
  assert.deepEqual(value.stages[0].items[0].requiredSkills, [
    { id: 31, name: 'SQL' },
  ]);
});

test('no Major and selected Major without roadmap are distinct successful states', () => {
  for (const value of [
    { selectedMajor: null, stages: [] },
    { selectedMajor: major, stages: [] },
  ])
    assert.deepEqual(parseGuidanceList(value), value);
  assert.throws(
    () => parseGuidanceList({ selectedMajor: null, stages: list().stages }),
    invalid,
  );
});

test('detail preserves Closed relations, nullable text and original relation order', () => {
  const value = detail();
  value.item.majors.push({ id: 2, name: 'Old major', status: 'Closed' });
  value.item.skills.unshift({ id: 32, name: 'Other skill', status: 'Active' });
  assert.deepEqual(parseGuidanceDetail(value), value);
});

test('no-year detail and empty relation arrays are supported without inferred defaults', () => {
  const value = detail();
  value.item.academicYears = [];
  value.item.majors = [];
  value.item.skills = [];
  value.item.descriptionText = null;
  value.item.publisher = 'Test publisher';
  value.item.requirementsText = '';
  assert.deepEqual(parseGuidanceDetail(value), value);
});

test('IDs must be numeric positive MySQL INT values', () => {
  for (const id of [1, 2147483647]) assert.equal(isGuidanceId(id), true);
  for (const id of [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    2147483648,
    Number.MAX_SAFE_INTEGER,
    '4',
    null,
    undefined,
  ]) {
    assert.equal(isGuidanceId(id), false);
    const value = detail();
    value.item.id = id;
    assert.throws(() => parseGuidanceDetail(value), invalid);
    const response = list();
    response.selectedMajor.id = id;
    assert.throws(() => parseGuidanceList(response), invalid);
    const nested = list();
    nested.stages[0].items[0].requiredSkills[0].id = id;
    assert.throws(() => parseGuidanceList(nested), invalid);
  }
});

test('rejects malformed envelopes, Major, stages and summaries instead of empty fallback', () => {
  for (const value of [
    null,
    [],
    {},
    { stages: [] },
    { selectedMajor: major },
    { selectedMajor: major, stages: null },
  ])
    assert.throws(() => parseGuidanceList(value), invalid);
  for (const mutate of [
    (v) => {
      v.selectedMajor.type = 'Skill';
    },
    (v) => {
      v.selectedMajor.name = null;
    },
    (v) => {
      v.stages[0] = null;
    },
    (v) => {
      v.stages[0].items = {};
    },
    (v) => {
      v.stages[0].items[0].id = 0;
    },
    (v) => {
      v.stages[0].items[0].title = null;
    },
    (v) => {
      delete v.stages[0].items[0].requiredSkills;
    },
    (v) => {
      v.stages[0].items[0].requiredSkills = [null];
    },
    (v) => {
      v.stages[0].items[0].requiredSkills[0].name = 31;
    },
    (v) => {
      delete v.stages[0].items[0].createdAt;
    },
  ]) {
    const value = list();
    mutate(value);
    assert.throws(() => parseGuidanceList(value), invalid);
  }
});

test('year validation rejects nonintegers and values outside 1–4 in list and detail', () => {
  for (const year of [0, 5, 2.5, '2', null, undefined]) {
    const value = list();
    value.stages[0].academicYear = year;
    assert.throws(() => parseGuidanceList(value), invalid);
    const response = detail();
    response.item.academicYears = [year];
    assert.throws(() => parseGuidanceDetail(response), invalid);
  }
});

test('timestamps require real UTC ISO date/time; original valid precision retained', () => {
  for (const createdAt of [
    '2026-10-01T00:00:00Z',
    '2026-10-01T00:00:00.123Z',
    '2024-02-29T23:59:59Z',
  ]) {
    const value = list();
    value.stages[0].items[0].createdAt = createdAt;
    assert.equal(
      parseGuidanceList(value).stages[0].items[0].createdAt,
      createdAt,
    );
  }
  for (const createdAt of [
    '2026-02-30T00:00:00Z',
    '2026-01-01T24:00:00Z',
    '2026-13-01T00:00:00Z',
    '2026-10-01',
    '2026-10-01T00:00:00',
    'invalid',
    123,
    null,
  ]) {
    const value = detail();
    value.item.createdAt = createdAt;
    assert.throws(() => parseGuidanceDetail(value), invalid);
    const response = list();
    response.stages[0].items[0].createdAt = createdAt;
    assert.throws(() => parseGuidanceList(response), invalid);
  }
});

test('detail rejects missing/wrong nullable fields, relations, statuses and envelope', () => {
  for (const value of [null, {}, { item: null }, { item: [] }])
    assert.throws(() => parseGuidanceDetail(value), invalid);
  for (const key of ['publisher', 'descriptionText', 'requirementsText']) {
    for (const wrong of [undefined, 12, {}, []]) {
      const value = detail();
      value.item[key] = wrong;
      assert.throws(() => parseGuidanceDetail(value), invalid);
    }
  }
  for (const key of ['majors', 'skills']) {
    for (const wrong of [
      undefined,
      null,
      {},
      [null],
      [{ id: 1, name: 'Test' }],
      [{ id: 0, name: 'Test', status: 'Active' }],
      [{ id: 1, name: 1, status: 'Active' }],
      [{ id: 1, name: 'Test', status: 'closed' }],
    ]) {
      const value = detail();
      value.item[key] = wrong;
      assert.throws(() => parseGuidanceDetail(value), invalid);
    }
  }
  const value = detail();
  delete value.item.academicYears;
  assert.throws(() => parseGuidanceDetail(value), invalid);
});

test('parser excludes unrelated fields and does not mutate response input', () => {
  const value = detail();
  value.item.reviewed_by = 99;
  const snapshot = structuredClone(value);
  const parsed = parseGuidanceDetail(value);
  assert.equal('reviewed_by' in parsed.item, false);
  parsed.item.academicYears.push(2);
  assert.deepEqual(value, snapshot);
});
