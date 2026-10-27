import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOpportunityDetailSections,
  safeOpportunityReturnTo,
} from '../src/features/opportunities/detail-content.ts';

test('orders scholarship sections by BR-01.8 and maps API associations', () => {
  const sections = buildOpportunityDetailSections({
    type: 'Học bổng',
    descriptionText:
      '## Hướng dẫn đăng ký\nCách đăng ký.\n\n## Giới thiệu học bổng\nGiới thiệu.',
    requirementsText:
      '## Giá trị học bổng\nGiá trị từ API.\n\n## Đối tượng và điều kiện xét tuyển\nĐiều kiện từ API.',
    majors: [{ id: 3, name: 'Ngành đóng vẫn giữ' }],
    skills: [{ id: 7, name: 'Kỹ năng liên quan' }],
    eligibleAcademicYears: [2, 4],
  });

  assert.deepEqual(
    sections.map((section) => section.title),
    [
      'Giới thiệu học bổng',
      'Đối tượng và điều kiện xét tuyển',
      'Giá trị học bổng',
      'Hướng dẫn đăng ký',
    ],
  );
  assert.equal(sections[1].majors[0].name, 'Ngành đóng vẫn giữ');
  assert.deepEqual(sections[1].academicYears, [2, 4]);
  assert.equal(sections[1].skills[0].name, 'Kỹ năng liên quan');
});

test('uses type-specific headings, omits empty sections, and keeps plain text safe', () => {
  const internship = buildOpportunityDetailSections({
    type: 'Thực tập',
    descriptionText: '<b>Văn bản</b>\n## Quyền lợi và hỗ trợ\nThông tin.',
    requirementsText: null,
    majors: [],
    skills: [],
    eligibleAcademicYears: [],
  });
  const job = buildOpportunityDetailSections({
    type: 'Việc làm',
    descriptionText: null,
    requirementsText: 'Yêu cầu dạng văn bản thuần.',
    majors: [],
    skills: [],
    eligibleAcademicYears: [],
  });

  assert.deepEqual(
    internship.map(({ title }) => title),
    ['Mô tả thực tập', 'Quyền lợi và hỗ trợ'],
  );
  assert.equal(internship[0].paragraphs[0], '<b>Văn bản</b>');
  assert.deepEqual(
    job.map(({ title }) => title),
    ['Yêu cầu ứng viên'],
  );
  assert.deepEqual(
    buildOpportunityDetailSections({
      type: 'Học bổng',
      descriptionText: null,
      requirementsText: null,
      majors: [],
      skills: [],
      eligibleAcademicYears: [],
    }),
    [],
  );
});

test('preserves unrecognized headings after the type-specific heading order', () => {
  const sections = buildOpportunityDetailSections({
    type: 'Việc làm',
    descriptionText:
      '## Ghi chú riêng\nNội dung cần giữ.\n\n## Mô tả công việc\nMô tả.',
    requirementsText: null,
    majors: [],
    skills: [],
    eligibleAcademicYears: [],
  });

  assert.deepEqual(
    sections.map(({ title }) => title),
    ['Mô tả công việc', 'Ghi chú riêng'],
  );
});

test('only accepts an internal Hub list return path', () => {
  assert.equal(
    safeOpportunityReturnTo('/opportunities?q=react&type=Thực%20tập&page=3'),
    '/opportunities?q=react&type=Th%E1%BB%B1c%20t%E1%BA%ADp&page=3',
  );
  assert.equal(
    safeOpportunityReturnTo('https://outside.invalid'),
    '/opportunities',
  );
  assert.equal(
    safeOpportunityReturnTo('//outside.invalid/path'),
    '/opportunities',
  );
  assert.equal(safeOpportunityReturnTo('/\outside.invalid'), '/opportunities');
  assert.equal(safeOpportunityReturnTo('/_dev/health'), '/opportunities');
});
