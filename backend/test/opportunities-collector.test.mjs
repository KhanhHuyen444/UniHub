import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decodeHtmlEntities,
  htmlToCleanText,
  detectOpportunityType,
  detectWorkFormat,
  splitDescriptionAndRequirements,
  computeDateCutoff,
  matchMajorsAndSkills,
  determineAcademicYears,
  extractGreenhouse,
  extractLever,
  extractScholarships,
  processCollectedOpportunities,
  formatNeedsReviewCsv,
  DEFAULT_CONFIG,
  recruitmentReviewReason,
  extractOfficialSources,
} from '../dist/scripts/opportunities-collector.js';
import {
  validateBatch,
  planImport,
} from '../dist/scripts/opportunities-import.js';

test('HTML cleaning and entity decoding', () => {
  const rawHtml =
    '<p>Join <strong>Axon &amp; Co.</strong></p><script>alert(1)</script><ul><li>Task 1</li><li>Task 2</li></ul>';
  const cleaned = htmlToCleanText(rawHtml);
  assert.ok(!cleaned.includes('<script>'));
  assert.ok(cleaned.includes('Axon & Co.'));
  assert.ok(cleaned.includes('- Task 1'));
  assert.ok(cleaned.includes('- Task 2'));
});

test('Opportunity type and work format detection', () => {
  assert.equal(
    detectOpportunityType('Software Engineer Intern', 'join our team'),
    'Thực tập',
  );
  assert.equal(
    detectOpportunityType('Thực tập sinh Marketing', 'mô tả'),
    'Thực tập',
  );
  assert.equal(
    detectOpportunityType('Vice-Chancellor Scholarship', 'tài trợ học phí'),
    'Học bổng',
  );
  assert.equal(
    detectOpportunityType('Backend Engineer', 'full time role'),
    'Việc làm',
  );

  assert.equal(detectWorkFormat('Hanoi, Vietnam', 'office based'), 'Offline');
  assert.equal(detectWorkFormat(null, 'fully remote position'), 'Online');
  assert.equal(
    detectWorkFormat('Ho Chi Minh City', 'flexible hybrid schedule'),
    'Hybrid',
  );
  assert.equal(detectWorkFormat(null, 'general description'), null);
});

test('Section splitting into description and requirements', () => {
  const content = `## About the job\nBuild software.\n## Requirements\n- Knowledge of TypeScript\n- Final year student`;
  const split = splitDescriptionAndRequirements(content);
  assert.ok(split.description.includes('Build software'));
  assert.ok(split.requirements.includes('Knowledge of TypeScript'));
});

test('Deadline cutoff computation matches contract Asia/Ho_Chi_Minh', () => {
  const dateStr = '2026-11-30';
  const { instantIso, valid } = computeDateCutoff(dateStr);
  assert.equal(valid, true);
  // Cutoff is 86400000 ms after start of day in +07:00
  const expectedMs = Date.parse('2026-11-30T00:00:00+07:00') + 86400000;
  assert.equal(instantIso, new Date(expectedMs).toISOString());
  assert.equal(instantIso, '2026-11-30T17:00:00.000Z');

  assert.equal(computeDateCutoff('invalid-date').valid, false);
});

test('Catalog matching respects 117 Majors and 328 Skills only', () => {
  const mockCatalog = {
    majors: new Map([
      ['Kỹ thuật phần mềm', 1],
      ['Công nghệ thông tin', 2],
      ['Quản trị kinh doanh', 3],
    ]),
    skills: new Map([
      ['Kiểm thử phần mềm', 10],
      ['Tiếng Anh', 11],
      ['Git', 12],
    ]),
  };

  const title = 'Kỹ sư phần mềm Fresher';
  const content =
    'Tuyển dụng kỹ sư chuyên ngành Kỹ thuật phần mềm, yêu cầu thành thạo Git và Tiếng Anh giao tiếp tốt.';
  const { matchedMajors, matchedSkills } = matchMajorsAndSkills(
    title,
    content,
    mockCatalog,
  );

  assert.deepEqual(matchedMajors, ['Kỹ thuật phần mềm']);
  assert.ok(matchedSkills.includes('Git'));
  assert.ok(matchedSkills.includes('Tiếng Anh'));
  assert.ok(!matchedSkills.includes('Invented Skill'));
});

test('Academic years determination adheres to contract', () => {
  assert.deepEqual(
    determineAcademicYears('Học bổng', 'open to all candidates'),
    [],
  );
  assert.deepEqual(
    determineAcademicYears('Việc làm', 'fresher software engineer'),
    [4],
  );
  assert.deepEqual(
    determineAcademicYears('Thực tập', 'dành cho sinh viên năm 3 hoặc năm 4'),
    [3, 4],
  );
  assert.deepEqual(
    determineAcademicYears('Thực tập', 'ưu tiên sinh viên năm 2 trở lên'),
    [2, 3, 4],
  );
});

test('Greenhouse extractor parses mock response correctly', async () => {
  const mockPayload = {
    jobs: [
      {
        id: 9991,
        title: 'Software Engineer Intern',
        absolute_url: 'https://job-boards.greenhouse.io/axon/jobs/9991',
        location: { name: 'Ho Chi Minh City, Vietnam' },
        content:
          '<p>Mô tả công việc lập trình</p><h3>Requirements</h3><p>Kiến thức C++ và Git</p>',
        application_deadline: '2026-11-30',
      },
    ],
  };

  const mockFetch = async () => ({
    ok: true,
    json: async () => mockPayload,
  });

  const extracted = await extractGreenhouse('axon', mockFetch);
  assert.equal(extracted.length, 1);
  assert.equal(extracted[0].title, 'Software Engineer Intern');
  assert.equal(extracted[0].opportunityType, 'Thực tập');
  assert.equal(extracted[0].location, 'Ho Chi Minh City, Vietnam');
  assert.equal(extracted[0].workFormat, 'Offline');
  assert.equal(extracted[0].deadlineSourceDate, '2026-11-30');
});

test('Lever extractor parses mock response correctly', async () => {
  const mockPayload = [
    {
      id: 'lev-123',
      text: 'QA Intern',
      hostedUrl: 'https://jobs.lever.co/palantir/lev-123',
      categories: { location: 'Remote, Vietnam', commitment: 'Intern' },
      descriptionPlain: 'Mô tả công việc kiểm thử phần mềm',
      additionalPlain:
        'Yêu cầu: Hạn nộp: 2026-11-30\nKỹ năng: Kiểm thử phần mềm',
    },
  ];

  const mockFetch = async () => ({
    ok: true,
    json: async () => mockPayload,
  });

  const extracted = await extractLever('palantir', mockFetch);
  assert.equal(extracted.length, 1);
  assert.equal(extracted[0].title, 'QA Intern');
  assert.equal(extracted[0].opportunityType, 'Thực tập');
  assert.equal(extracted[0].workFormat, 'Online');
  assert.equal(extracted[0].deadlineSourceDate, '2026-11-30');
});

test('Scholarship extractor loads configured programs', () => {
  const scholarships = extractScholarships(DEFAULT_CONFIG.scholarshipSources);
  assert.ok(scholarships.length >= 2);
  assert.ok(scholarships.every((s) => s.opportunityType === 'Học bổng'));
  assert.ok(scholarships.every((s) => s.deadlineSourceDate !== null));
});

test('processCollectedOpportunities deduplicates and validates against importer v2', async () => {
  const mockCatalog = {
    majors: new Map([
      ['Công nghệ thông tin', 1],
      ['Quản trị kinh doanh', 2],
      ['Thiết kế đồ họa', 3],
    ]),
    skills: new Map([
      ['Tiếng Anh', 10],
      ['Kỹ năng thuyết trình', 11],
      ['Git', 12],
    ]),
  };

  const rawItems = [
    // Valid item
    {
      sourceType: 'scholarship',
      externalId: 'SCH-01',
      title: 'RMIT Vice-Chancellor’s Scholars',
      publisher: 'RMIT University Vietnam',
      sourceUrl:
        'https://www.rmit.edu.vn/study-at-rmit/scholarships/future-undergraduate-student-scholarships',
      location: 'Hà Nội & Hồ Chí Minh',
      workFormat: 'Offline',
      opportunityType: 'Học bổng',
      description:
        'Scholarship for Công nghệ thông tin students with strong academic performance.',
      requirements:
        'Git knowledge required alongside excellent academic performance.',
      sourceStatus: 'open',
      deadlineSourceDate: '2026-11-30',
    },
    // Duplicate URL item
    {
      sourceType: 'greenhouse',
      externalId: 'GH-02',
      title: 'Duplicate Job',
      publisher: 'Company',
      sourceUrl:
        'https://www.rmit.edu.vn/study-at-rmit/scholarships/future-undergraduate-student-scholarships',
      location: 'Hà Nội',
      workFormat: 'Offline',
      opportunityType: 'Việc làm',
      description: 'Description',
      requirements: 'Requirements',
      sourceStatus: 'open',
      deadlineSourceDate: '2026-11-30',
    },
    // Missing deadline item
    {
      sourceType: 'greenhouse',
      externalId: 'GH-03',
      title: 'Job Without Deadline',
      publisher: 'Company',
      sourceUrl: 'https://example.com/jobs/nodeadline',
      location: 'Hà Nội',
      workFormat: 'Offline',
      opportunityType: 'Việc làm',
      description: 'Description text is sufficiently long.',
      requirements: 'Requirements text is sufficiently long.',
      deadlineSourceDate: null,
    },
  ];

  const now = new Date('2026-11-01T22:45:05+07:00');
  const result = await processCollectedOpportunities(
    rawItems,
    mockCatalog,
    [],
    now,
  );

  assert.equal(result.stats.totalExtracted, 3);
  assert.equal(result.stats.validCandidatesCount, 1);
  assert.equal(result.stats.needsReviewCount, 2);

  // Validate importer v2 batch
  const batch = result.importCandidatesBatch;
  assert.equal(batch.format_version, 2);
  assert.equal(batch.items.length, 1);
  assert.equal(batch.items[0].opportunity.opportunity_type, 'Học bổng');
  assert.deepEqual(batch.items[0].relations.academic_years, []);

  // validateBatch strictly passes
  assert.throws(() => validateBatch(batch, now), /leader approval/);
  assert.equal(batch.initial_catalog_proposal.status, 'needs_review');

  // Verify CSV formatting
  const csv = formatNeedsReviewCsv(result.needsReviewRows);
  assert.ok(csv.includes('DUPLICATE_BATCH_INTERNAL'));
  assert.ok(csv.includes('SOURCE_NOT_CONFIRMED_OPEN'));
});

test('null deadline passes only for confirmed open postings; expired, invalid and unknown remain review', async () => {
  const base = {
    sourceType: 'greenhouse',
    externalId: 'unit',
    title: 'Intern',
    publisher: 'Unit',
    sourceUrl: 'https://example.invalid/job',
    location: 'Vietnam',
    workFormat: 'Online',
    opportunityType: 'Thực tập',
    description: 'Công nghệ thông tin internship description',
    requirements: 'Git knowledge required for this internship',
    deadlineSourceDate: null,
    sourceStatus: 'open',
  };
  const catalog = {
    majors: new Map([['Công nghệ thông tin', 1]]),
    skills: new Map([['Git', 2]]),
  };
  for (const [date, state, count] of [
    [null, 'open', 1],
    ['2099-12-31', 'open', 1],
    ['2020-01-01', 'open', 0],
    ['2027-02-30', 'open', 0],
    [null, 'unknown', 0],
    [null, 'closed', 0],
  ]) {
    const r = await processCollectedOpportunities(
      [{ ...base, deadlineSourceDate: date, sourceStatus: state }],
      catalog,
    );
    assert.equal(r.importCandidatesBatch.items.length, count);
    if (count && date === null) {
      const o = r.importCandidatesBatch.items[0].opportunity;
      assert.equal(o.deadline, null);
      assert.equal(o.deadline_source_date, null);
      assert.equal(o.deadline_source_timezone, null);
    }
  }
});

test('public extractors preserve absent dates and explicit closed states; malformed dates require review', async () => {
  const gh = await extractGreenhouse('unit', async () => ({
    ok: true,
    json: async () => ({
      jobs: [
        {
          id: 1,
          title: 'Intern',
          absolute_url: 'https://example.invalid/1',
          content: 'description',
          status: 'closed',
        },
        {
          id: 2,
          title: 'Intern',
          absolute_url: 'https://example.invalid/2',
          content: 'description',
          application_deadline: 'bad-date',
        },
      ],
    }),
  }));
  assert.equal(gh[0].deadlineSourceDate, null);
  assert.equal(gh[0].sourceStatus, 'closed');
  assert.equal(gh[1].sourceStatus, 'open');
  assert.equal(computeDateCutoff(gh[1].deadlineSourceDate).valid, false);
  const lev = await extractLever('unit', async () => ({
    ok: true,
    json: async () => [
      {
        id: '1',
        text: 'Intern',
        hostedUrl: 'https://example.invalid/1',
        state: 'closed',
      },
    ],
  }));
  assert.equal(lev[0].deadlineSourceDate, null);
  assert.equal(lev[0].sourceStatus, 'closed');
});

test('student and Vietnam gates reject senior roles and geographically restricted remote', () => {
  const base = {
    opportunityType: 'Việc làm',
    title: 'Software Intern',
    requirements: 'No prior experience required',
    location: 'Vietnam',
    workFormat: 'Online',
  };
  assert.equal(recruitmentReviewReason(base), null);
  for (const title of [
    'Senior Engineer',
    'Lead Developer',
    'Engineering Manager',
    'Staff Engineer',
  ])
    assert.equal(
      recruitmentReviewReason({ ...base, title }),
      'SENIORITY_NOT_STUDENT_SUITABLE',
    );
  for (const location of ['Remote APAC', 'Remote', null])
    assert.equal(
      recruitmentReviewReason({ ...base, location }),
      'VIETNAM_ELIGIBILITY_UNCONFIRMED',
    );
  for (const location of [
    'Remote US',
    'Remote Europe',
    'Remote Worldwide - US only',
  ])
    assert.equal(
      recruitmentReviewReason({ ...base, location }),
      'LOCATION_EXCLUDES_VIETNAM',
    );
  assert.equal(
    recruitmentReviewReason({ ...base, location: 'Remote Worldwide' }),
    null,
  );
  assert.equal(
    recruitmentReviewReason({
      ...base,
      title: 'Junior Engineer',
      requirements: '3+ years of experience',
    }),
    'EXPERIENCE_NOT_STUDENT_SUITABLE',
  );
  assert.equal(
    recruitmentReviewReason({
      ...base,
      title: 'Junior Engineer',
      requirements: 'Skills required',
    }),
    'JUNIOR_REQUIREMENTS_UNCONFIRMED',
  );
  assert.equal(
    recruitmentReviewReason({
      ...base,
      title: 'Junior Engineer',
      requirements: '1 year of experience',
    }),
    null,
  );
  assert.equal(
    recruitmentReviewReason({
      ...base,
      location: 'Remote Worldwide',
      requirements: 'Candidates must be based in the United States',
    }),
    'LOCATION_EXCLUDES_VIETNAM',
  );
});

test('proposal requires both JD-backed Major and Skill; title alone cannot supply mapping', async () => {
  const base = {
    sourceType: 'lever',
    externalId: 'test',
    title: 'Software Intern',
    publisher: 'Unit',
    sourceUrl: 'https://example.invalid/job',
    location: 'Vietnam',
    workFormat: 'Online',
    opportunityType: 'Việc làm',
    description:
      'Computer Science internship with real development responsibilities.',
    requirements: 'Git knowledge and ability to work with a development team.',
    deadlineSourceDate: null,
    sourceStatus: 'open',
  };
  const full = {
    majors: new Map([['Computer Science', 1]]),
    skills: new Map([['Git', 2]]),
  };
  for (const [item, catalog, reason] of [
    [base, { ...full, skills: new Map() }, 'NO_JD_SKILL_MATCH'],
    [base, { ...full, majors: new Map() }, 'NO_JD_MAJOR_MATCH'],
    [
      {
        ...base,
        title: 'Computer Science Intern',
        description: 'General internship with development responsibilities.',
      },
      full,
      'NO_JD_MAJOR_MATCH',
    ],
  ]) {
    const r = await processCollectedOpportunities([item], catalog, []);
    assert.equal(r.importCandidatesBatch.items.length, 0);
    assert.equal(r.needsReviewRows[0].reason, reason);
  }
  const r = await processCollectedOpportunities([base], full, []);
  assert.equal(r.importCandidatesBatch.items.length, 1);
  assert.deepEqual(
    r.importCandidatesBatch.initial_catalog_proposal.opportunity_links[0]
      .skill_names,
    ['Git'],
  );
});

test('reviewed official pages fail closed on blocked, changed, closed or redirected sources', async () => {
  const source = {
    item: {
      sourceType: 'official',
      externalId: 'UNIT',
      title: 'Intern',
      publisher: 'Unit',
      sourceUrl: 'https://example.invalid/job',
      location: 'Vietnam',
      workFormat: 'Offline',
      opportunityType: 'Việc làm',
      description: 'Reviewed factual summary for development work.',
      requirements: 'Computer Science and Git knowledge.',
      deadlineSourceDate: '2099-01-01',
    },
    scopeStart: 'START',
    scopeEnd: 'END',
    requiredEvidence: ['Computer Science', 'Git', '2099-01-01'],
    openEvidence: 'Apply now',
  };
  for (const [body, code] of [
    ['START Computer Science Git 2099-01-01 Apply now END', null],
    [
      'START Computer Science 2099-01-01 Apply now END',
      'SOURCE_EVIDENCE_CHANGED',
    ],
    [
      'START Computer Science Git 2099-01-01 Application deadline closed. END',
      'SOURCE_CLOSED',
    ],
    [
      'START Computer Science Git 2099-01-01 END',
      'SOURCE_OPEN_STATUS_UNCONFIRMED',
    ],
  ]) {
    const r = await extractOfficialSources([source], async (_url, options) => {
      assert.equal(options.redirect, 'error');
      return { ok: true, text: async () => body };
    });
    assert.equal(r.items.length, code ? 0 : 1);
    if (code) assert.equal(r.needsReview[0].reason, code);
    else assert.equal(r.items[0].sourceStatus, 'open');
  }
  const blocked = await extractOfficialSources([source], async () => ({
    ok: false,
    status: 403,
  }));
  assert.equal(blocked.needsReview[0].reason, 'SOURCE_HTTP_403');
  const redirect = await extractOfficialSources([source], async () => {
    throw Error('redirect');
  });
  assert.equal(redirect.needsReview[0].reason, 'SOURCE_FETCH_FAILED');
  const related = await extractOfficialSources([source], async () => ({
    ok: true,
    text: async () =>
      'START Computer Science Git 2099-01-01 Apply now END related job Application deadline closed.',
  }));
  assert.equal(related.items.length, 1);
});
