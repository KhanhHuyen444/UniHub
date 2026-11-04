import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAJOR_CAREER_MAPPING,
  getCareersForMajor,
  getCareerForMajor,
  getSuggestedSkillNames,
  categorizeSkills,
} from '../src/features/categories/major-skill-mapping.ts';
import { validateForm } from '../src/features/profile/contracts.ts';

test('MAJOR_CAREER_MAPPING covers 117 majors and 969 target careers', () => {
  assert.equal(MAJOR_CAREER_MAPPING.length, 117);

  const totalCareers = MAJOR_CAREER_MAPPING.reduce(
    (sum, m) => sum + m.careers.length,
    0,
  );
  assert.equal(totalCareers, 969);

  const seCareers = getCareersForMajor('Kỹ thuật phần mềm');
  assert.equal(seCareers.length, 11);
  assert.ok(seCareers.some((c) => c.name === 'Frontend Developer'));
  assert.ok(seCareers.some((c) => c.name === 'Backend Developer'));

  const digitalBizCareers = getCareersForMajor(
    'Kinh doanh số và trí tuệ nhân tạo',
  );
  assert.equal(digitalBizCareers.length, 7);
  assert.ok(digitalBizCareers.some((c) => c.name.includes('kinh doanh số')));

  // Verify the 5 patched anomalies are clean and valid
  const hrGeneralist = getCareerForMajor(
    'Quản trị nhân lực',
    'Chuyên viên nhân sự tổng hợp',
  );
  assert.ok(hrGeneralist);
  assert.ok(
    !hrGeneralist.coreSkills.includes('Quản lý dịch hại tổng hợp (IPM)'),
  );
  assert.ok(hrGeneralist.coreSkills.includes('Quản lý hiệu suất nhân sự'));

  const opRisk = getCareerForMajor(
    'Quản trị rủi ro',
    'Chuyên viên rủi ro hoạt động',
  );
  assert.ok(opRisk);
  assert.ok(
    !opRisk.advantageSkills.includes('Tổ chức hoạt động giáo dục mầm non'),
  );
  assert.ok(opRisk.advantageSkills.includes('Kiểm soát nội bộ'));

  const qaSupplier = getCareerForMajor(
    'Đảm bảo chất lượng',
    'Chuyên viên đánh giá nhà cung cấp',
  );
  assert.ok(qaSupplier);
  assert.ok(!qaSupplier.coreSkills.includes('Đánh giá chất lượng đất'));
  assert.ok(qaSupplier.coreSkills.includes('Đảm bảo chất lượng (QA)'));
  assert.ok(qaSupplier.advantageSkills.includes('Đàm phán thương mại'));

  const csSpecialist = getCareerForMajor(
    'Quản trị kinh doanh',
    'Chuyên viên chăm sóc khách hàng',
  );
  assert.ok(csSpecialist);
  assert.ok(!csSpecialist.coreSkills.includes('Chăm sóc người bệnh'));
  assert.ok(csSpecialist.coreSkills.includes('Chăm sóc khách hàng'));

  const podcastProducer = getCareerForMajor(
    'Báo chí',
    'Nhân viên sản xuất podcast',
  );
  assert.ok(podcastProducer);
  assert.ok(
    !podcastProducer.coreSkills.includes('Quản lý sản xuất nông nghiệp'),
  );
  assert.ok(
    podcastProducer.coreSkills.includes('Sản xuất nội dung đa phương tiện'),
  );
});

test('getCareersForMajor handles whitespace, case-insensitivity, null and unknown majors', () => {
  const normal = getCareersForMajor('Marketing');
  const lower = getCareersForMajor('marketing');
  const trimmed = getCareersForMajor('   Marketing   ');
  assert.deepEqual(lower, normal);
  assert.deepEqual(trimmed, normal);

  assert.deepEqual(getCareersForMajor(null), []);
  assert.deepEqual(getCareersForMajor(undefined), []);
  assert.deepEqual(getCareersForMajor(''), []);
  assert.deepEqual(getCareersForMajor('Ngành không tồn tại 999'), []);
});

test('getCareerForMajor retrieves matching career or null', () => {
  const fe = getCareerForMajor('Kỹ thuật phần mềm', 'Frontend Developer');
  assert.ok(fe);
  assert.equal(fe.name, 'Frontend Developer');
  assert.ok(fe.coreSkills.includes('React'));
  assert.ok(fe.coreSkills.includes('TypeScript'));
  assert.ok(fe.advantageSkills.includes('Kiểm thử phần mềm'));

  const caseInsensitive = getCareerForMajor(
    '  Kỹ thuật phần mềm  ',
    'frontend developer',
  );
  assert.deepEqual(caseInsensitive, fe);

  const mismatch = getCareerForMajor('Kỹ thuật phần mềm', 'Bác sĩ đa khoa');
  assert.equal(mismatch, null);
});

test('getSuggestedSkillNames returns career skills when career is specified, or union when not', () => {
  const feSkills = getSuggestedSkillNames(
    'Kỹ thuật phần mềm',
    'Frontend Developer',
  );
  assert.ok(feSkills.includes('React'));
  assert.ok(feSkills.includes('Kiểm thử phần mềm'));

  const allSeSkills = getSuggestedSkillNames('Kỹ thuật phần mềm');
  assert.ok(allSeSkills.includes('React'));
  assert.ok(allSeSkills.includes('SQL'));
  assert.ok(allSeSkills.includes('Node.js'));
});

test('categorizeSkills splits options into core, advantage, and other when career matches', () => {
  const options = [
    { id: 1, name: 'TypeScript' },
    { id: 2, name: 'React' },
    { id: 3, name: 'Node.js' },
    { id: 4, name: 'Git' },
    { id: 5, name: 'Kiểm thử phần mềm' },
    { id: 6, name: 'REST API' },
    { id: 7, name: 'SQL' },
    { id: 8, name: 'AutoCAD' },
  ];

  const result = categorizeSkills(
    options,
    'Kỹ thuật phần mềm',
    'Frontend Developer',
  );
  assert.ok(result.matchedCareer);
  assert.equal(result.matchedCareer.name, 'Frontend Developer');

  // Core skills for Frontend Developer: TypeScript, React, Node.js, Git
  assert.deepEqual(
    result.core.map((s) => s.name).sort(),
    ['Git', 'Node.js', 'React', 'TypeScript'].sort(),
  );

  // Advantage skills for Frontend Developer: Kiểm thử phần mềm, REST API
  assert.deepEqual(
    result.advantage.map((s) => s.name).sort(),
    ['Kiểm thử phần mềm', 'REST API'].sort(),
  );

  // Other skills: SQL, AutoCAD
  assert.deepEqual(
    result.other.map((s) => s.name).sort(),
    ['AutoCAD', 'SQL'].sort(),
  );

  // Zero overlap
  const allIds = [
    ...result.core.map((s) => s.id),
    ...result.advantage.map((s) => s.id),
    ...result.other.map((s) => s.id),
  ];
  assert.equal(new Set(allIds).size, allIds.length);
});

test('categorizeSkills does NOT suggest skills when careerGoal is empty; all skills remain in other', () => {
  const options = [
    { id: 1, name: 'TypeScript' },
    { id: 2, name: 'React' },
    { id: 3, name: 'AutoCAD' },
  ];

  // No career goal entered yet -> no suggestions
  const result = categorizeSkills(options, 'Kỹ thuật phần mềm', '');
  assert.equal(result.hasCareerGoal, false);
  assert.equal(result.matchedCareer, null);
  assert.equal(result.core.length, 0);
  assert.equal(result.advantage.length, 0);
  assert.equal(result.suggested.length, 0);
  assert.equal(result.other.length, 3);
});

test('categorizeSkills suggests major-level skills when custom career is entered', () => {
  const options = [
    { id: 1, name: 'TypeScript' },
    { id: 2, name: 'React' },
    { id: 3, name: 'AutoCAD' },
  ];

  const result = categorizeSkills(
    options,
    'Kỹ thuật phần mềm',
    'Custom AI Engineer',
  );
  assert.equal(result.hasCareerGoal, true);
  assert.equal(result.matchedCareer, null);
  assert.deepEqual(
    result.suggested.map((s) => s.name),
    ['TypeScript', 'React'],
  );
  assert.deepEqual(
    result.other.map((s) => s.name),
    ['AutoCAD'],
  );
});

test('categorizeSkills search query filters core, advantage, and other simultaneously', () => {
  const options = [
    { id: 1, name: 'TypeScript' },
    { id: 2, name: 'React' },
    { id: 5, name: 'Kiểm thử phần mềm' },
    { id: 9, name: 'Type-safe SQL' },
  ];

  const result = categorizeSkills(
    options,
    'Kỹ thuật phần mềm',
    'Frontend Developer',
    'type',
  );
  assert.deepEqual(
    result.core.map((s) => s.name),
    ['TypeScript'],
  );
  assert.equal(result.advantage.length, 0);
  assert.deepEqual(
    result.other.map((s) => s.name),
    ['Type-safe SQL'],
  );
});

test('validateForm enforces required careerGoal when requireCareerGoal option is set', () => {
  const form = {
    majorId: '1',
    academicYear: '2',
    skillIds: [10],
    careerGoal: '',
  };

  // Default backwards compatible: does not error on empty careerGoal
  assert.equal(validateForm(form).careerGoal, undefined);

  // Enforced mode in Profile submission:
  const errors = validateForm(form, { requireCareerGoal: true });
  assert.equal(
    errors.careerGoal,
    'Vui lòng chọn hoặc nhập vị trí nghề nghiệp mục tiêu.',
  );

  // Valid when filled
  const valid = validateForm(
    { ...form, careerGoal: 'Frontend Developer' },
    { requireCareerGoal: true },
  );
  assert.equal(valid.careerGoal, undefined);
});
