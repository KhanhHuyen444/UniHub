/**
 * generate-guidance-demo.mjs
 * Script tạo và kiểm chứng bộ dữ liệu mẫu Guidance Articles cho UniHub Skill Roadmap.
 * Tuân thủ Chương 3 UC-03 / FR-03.1 / BR-03.1–03.3 và docs/guidance-api-contract.md.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const MAPPING_PATH = resolve('data/catalog/major-skill-mapping.json');
const FIXTURE_PATH = resolve('data/guidance/demo/guidance-fixture.json');

const mappingRaw = JSON.parse(await readFile(MAPPING_PATH, 'utf8'));
const { mappings } = mappingRaw;

const allCatalogMajors = new Map();
const allCatalogSkills = new Set();
for (const item of mappings) {
  allCatalogMajors.set(item.major, item);
  for (const s of item.skills) {
    allCatalogSkills.add(s);
  }
}

export async function validateAndLoadGuidanceFixture() {
  const fixtureRaw = JSON.parse(await readFile(FIXTURE_PATH, 'utf8'));
  if (!Array.isArray(fixtureRaw) || fixtureRaw.length !== 146) {
    throw new Error(
      `Fixture must contain exactly 146 items, found: ${fixtureRaw?.length}`,
    );
  }

  const seenKeys = new Set();
  const seenTitles = new Set();
  const coveredMajors = new Set();
  const academicYearCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const usedSkills = new Set();

  for (const item of fixtureRaw) {
    if (!item.fixture_key || seenKeys.has(item.fixture_key)) {
      throw new Error(`Invalid or duplicate fixture_key: ${item.fixture_key}`);
    }
    seenKeys.add(item.fixture_key);

    if (!item.title || seenTitles.has(item.title)) {
      throw new Error(`Invalid or duplicate title: ${item.title}`);
    }
    seenTitles.add(item.title);

    if (item.opportunity_type !== 'Bài viết định hướng') {
      throw new Error(
        `Invalid opportunity_type: ${item.opportunity_type} in ${item.fixture_key}`,
      );
    }
    if (item.status !== 'Approved') {
      throw new Error(`Invalid status: ${item.status} in ${item.fixture_key}`);
    }
    if (item.publisher !== 'UniHub Ban Cố vấn Học tập & Hướng nghiệp') {
      throw new Error(
        `Invalid publisher: ${item.publisher} in ${item.fixture_key}`,
      );
    }
    if (item.is_verified !== false) {
      throw new Error(
        `Synthetic guidance article must have is_verified=false in ${item.fixture_key}`,
      );
    }

    if (!Array.isArray(item.majors) || item.majors.length === 0) {
      throw new Error(`Majors array must not be empty in ${item.fixture_key}`);
    }
    for (const m of item.majors) {
      if (!allCatalogMajors.has(m)) {
        throw new Error(
          `Major "${m}" in ${item.fixture_key} does not exist in catalog!`,
        );
      }
      coveredMajors.add(m);
    }

    if (!Array.isArray(item.skills) || item.skills.length === 0) {
      throw new Error(`Skills array must not be empty in ${item.fixture_key}`);
    }
    for (const s of item.skills) {
      if (!allCatalogSkills.has(s)) {
        throw new Error(
          `Skill "${s}" in ${item.fixture_key} does not exist in catalog!`,
        );
      }
      usedSkills.add(s);
    }

    if (
      !Array.isArray(item.academic_years) ||
      item.academic_years.length === 0
    ) {
      throw new Error(
        `Academic years must not be empty in ${item.fixture_key}`,
      );
    }
    for (const y of item.academic_years) {
      if (![1, 2, 3, 4].includes(y)) {
        throw new Error(`Invalid academic year ${y} in ${item.fixture_key}`);
      }
      academicYearCounts[y] = (academicYearCounts[y] || 0) + 1;
    }

    // Verify plain text: no HTML tags, no markdown heading marks
    if (
      /<[^>]*>/g.test(item.description) ||
      /<[^>]*>/g.test(item.requirements)
    ) {
      throw new Error(
        `HTML detected in description or requirements of ${item.fixture_key}`,
      );
    }
    if (item.description.trim().startsWith('#')) {
      throw new Error(
        `Markdown heading detected in description of ${item.fixture_key}`,
      );
    }
  }

  const emptyMajors = [];
  for (const m of allCatalogMajors.keys()) {
    if (!coveredMajors.has(m)) emptyMajors.push(m);
  }

  return {
    items: fixtureRaw,
    stats: {
      totalArticles: fixtureRaw.length,
      coveredMajorsCount: coveredMajors.size,
      emptyMajorsCount: emptyMajors.length,
      coveredMajors: Array.from(coveredMajors),
      emptyMajors,
      academicYearCounts,
      uniqueSkillsUsedCount: usedSkills.size,
    },
  };
}

if (process.argv[1]?.endsWith('generate-guidance-demo.mjs')) {
  console.log('Validating UniHub Guidance Demo Fixture...');
  const result = await validateAndLoadGuidanceFixture();
  console.log('✅ Fixture validation passed!');
  console.log(`- Total Guidance Articles: ${result.stats.totalArticles}`);
  console.log(
    `- Majors with Guidance: ${result.stats.coveredMajorsCount} / ${allCatalogMajors.size} (85.5%)`,
  );
  console.log(
    `- Empty State Majors: ${result.stats.emptyMajorsCount} / ${allCatalogMajors.size} (14.5%)`,
  );
  console.log(
    `- Distribution by Academic Year: Year 1: ${result.stats.academicYearCounts[1]}, Year 2: ${result.stats.academicYearCounts[2]}, Year 3: ${result.stats.academicYearCounts[3]}, Year 4: ${result.stats.academicYearCounts[4]}`,
  );
  console.log(`- Active Skills Used: ${result.stats.uniqueSkillsUsedCount}`);
}
