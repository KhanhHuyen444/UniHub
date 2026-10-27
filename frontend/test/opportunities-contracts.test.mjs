import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOpportunityQuery,
  filtersFromSearch,
  formatOpportunityDate,
  hasOpportunityFilters,
  parseMajorOptions,
  parseOpportunityDetail,
  parseOpportunityList,
  pageFromSearch,
} from '../src/features/opportunities/contracts.ts';

const deadline = {
  precision: 'date',
  date: '2026-11-05',
  sourceTimeZone: null,
  instant: '2026-11-05T17:00:00Z',
  state: 'open',
};

function item(overrides = {}) {
  return {
    id: 41,
    type: 'Học bổng',
    title: 'Cơ hội thử nghiệm',
    publisher: 'Đơn vị thử nghiệm',
    workFormat: null,
    location: null,
    deadline,
    isVerified: false,
    ...overrides,
  };
}

function listResponse(overrides = {}) {
  return {
    items: [item()],
    meta: {
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
      evaluatedAt: '2026-10-26T03:00:00Z',
    },
    ...overrides,
  };
}

test('parses list response and keeps backend deadline state and source date', () => {
  const response = parseOpportunityList(listResponse());
  assert.equal(response.items[0].deadline.precision, 'date');
  assert.equal(response.items[0].deadline.date, '2026-11-05');
  assert.equal(
    formatOpportunityDate(response.items[0].deadline.date),
    '05/11/2026',
  );
});

test('parses datetime and legacy unknown without inferring display date', () => {
  const datetime = {
    precision: 'datetime',
    date: '2026-11-06',
    sourceTimeZone: 'Asia/Ho_Chi_Minh',
    instant: '2026-11-05T17:00:00Z',
    state: 'expired',
  };
  const unknown = {
    precision: 'unknown',
    date: null,
    sourceTimeZone: null,
    instant: '2026-11-05T17:00:00Z',
    state: 'unknown',
  };
  const response = parseOpportunityList({
    items: [item({ deadline: datetime }), item({ id: 42, deadline: unknown })],
    meta: {
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
      evaluatedAt: '2026-10-26T03:00:00Z',
    },
  });
  assert.equal(response.items[0].deadline.date, '2026-11-06');
  assert.equal(response.items[1].deadline.date, null);
  assert.equal(response.items[1].deadline.state, 'unknown');
});

test('rejects malformed deadline, internal enum and oversized list page', () => {
  assert.throws(
    () =>
      parseOpportunityList({
        ...listResponse(),
        items: [item({ type: 'Bài viết định hướng' })],
      }),
    { code: 'INVALID_RESPONSE' },
  );
  assert.throws(
    () =>
      parseOpportunityList({
        ...listResponse(),
        items: [item({ deadline: { ...deadline, date: '2026-02-30' } })],
      }),
    { code: 'INVALID_RESPONSE' },
  );
  assert.throws(
    () =>
      parseOpportunityList({
        ...listResponse(),
        items: Array(21).fill(item()),
      }),
    { code: 'INVALID_RESPONSE' },
  );
});

test('serializes filters with NFC and URL-safe literal search characters', () => {
  const query = buildOpportunityQuery({
    q: '  ca phe%_\\  ',
    majorId: '12',
    type: 'Thực tập',
    workFormat: 'Hybrid',
  });
  assert.equal(query.get('q'), 'ca phe%_\\');
  assert.equal(query.get('majorId'), '12');
  assert.equal(query.get('type'), 'Thực tập');
  assert.equal(query.get('workFormat'), 'Hybrid');
  assert.equal(query.has('sort'), false);
  assert.equal(query.has('page'), false);
  const paginated = buildOpportunityQuery(
    { q: '', majorId: '', type: '', workFormat: '' },
    { page: 3, pageSize: 50 },
  );
  assert.equal(paginated.get('page'), '3');
  assert.equal(paginated.get('pageSize'), '50');
});

test('reads URL filters and recognizes blank search as no active filter', () => {
  assert.deepEqual(
    filtersFromSearch(
      '?q=viec%20lam&majorId=12&type=Vi%E1%BB%87c%20l%C3%A0m&page=3',
    ),
    {
      q: 'viec lam',
      majorId: '12',
      type: 'Việc làm',
      workFormat: '',
    },
  );
  assert.equal(hasOpportunityFilters('?q=%20&page=2'), false);
  assert.equal(hasOpportunityFilters('?workFormat=Online'), true);
  assert.equal(pageFromSearch('?page=1000000'), 1_000_000);
});

test('only accepts active Major-shaped option responses', () => {
  assert.deepEqual(
    parseMajorOptions({
      items: [{ id: 12, name: 'Khoa học dữ liệu', type: 'Major' }],
    }),
    [{ id: 12, name: 'Khoa học dữ liệu', type: 'Major' }],
  );
  assert.deepEqual(parseMajorOptions({ items: [] }), []);
  assert.throws(
    () =>
      parseMajorOptions({
        items: [{ id: 13, name: 'Skill thử', type: 'Skill' }],
      }),
    { code: 'INVALID_RESPONSE' },
  );
});

test('validates detail fields without interpreting text as markup', () => {
  const response = parseOpportunityDetail({
    item: {
      ...item(),
      descriptionText: '## Giới thiệu\nDòng chữ thường.',
      requirementsText: null,
      sourceUrl: 'https://example.invalid/source',
      majors: [{ id: 12, name: 'Khoa học dữ liệu' }],
      skills: [],
      eligibleAcademicYears: [],
      reviewerEmail: 'ignored@example.invalid',
    },
    meta: { evaluatedAt: '2026-10-26T03:00:00Z' },
  });
  assert.equal(
    response.item.descriptionText,
    '## Giới thiệu\nDòng chữ thường.',
  );
  assert.deepEqual(response.item.eligibleAcademicYears, []);
  assert.equal('reviewerEmail' in response.item, false);
  assert.throws(
    () =>
      parseOpportunityDetail({
        item: {
          ...item(),
          descriptionText: null,
          requirementsText: null,
          sourceUrl: 'javascript:alert(1)',
          majors: [],
          skills: [],
          eligibleAcademicYears: [],
        },
        meta: { evaluatedAt: '2026-10-26T03:00:00Z' },
      }),
    { code: 'INVALID_RESPONSE' },
  );
});
