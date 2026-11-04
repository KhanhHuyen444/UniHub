import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getPrismaClient,
  disconnectPrismaClient,
} from '../../../backend/dist/lib/prisma.js';
import { planImport } from '../../../backend/dist/scripts/opportunities-import.js';
import { generateRealisticMetadata } from './generate-realistic-data.mjs';

const directory = fileURLToPath(new URL('.', import.meta.url));
// Synchronize reviewed mappings onto the existing batch. Never recreate identities/dates.
export function buildDemo(existing, mappings, active, now = new Date()) {
  assert.equal(existing.items.length, 100);
  assert.equal(mappings.length, 100);
  assert.equal(new Set(mappings.map((m) => m.review_id)).size, 100);
  const batch = structuredClone(existing);
  const categories = new Map();
  for (const x of batch.items) {
    const before = existing.initial_catalog_proposal.opportunity_links.find(
      (l) => l.review_id === x.review_id,
    );
    const mapping = mappings.find((m) => m.review_id === x.review_id);
    assert(before && mapping && mapping.rationale);
    const o = x.opportunity;
    const meta = generateRealisticMetadata(x, mapping);
    o.title = meta.title;
    o.publisher = meta.publisher;
    o.description = meta.description;
    o.requirements = meta.requirements;
    if (x.evidence?.source_identity) {
      x.evidence.source_identity.basis =
        'Dữ liệu cơ hội giả lập phục vụ kiểm thử và trình diễn đồ án UniHub.';
    }
    const link = batch.initial_catalog_proposal.opportunity_links.find(
      (l) => l.review_id === x.review_id,
    );
    link.major_names = [...mapping.major_names];
    link.skill_names = [...mapping.skill_names];
    // Preserve approval state; refuse to edit a batch already approved by a human.
    assert.ok(
      link.status === 'needs_review' || link.status === 'leader_approved',
    );
    for (const [type, names] of [
      ['Major', mapping.major_names],
      ['Skill', mapping.skill_names],
    ])
      for (const name of names)
        categories.set(type + ':' + name, {
          type,
          name,
          status: link.status,
        });
  }
  batch.initial_catalog_proposal.categories = [...categories.values()];
  validateDemo(batch, active, now);
  const linkFor = (id) =>
    batch.initial_catalog_proposal.opportunity_links.find(
      (l) => l.review_id === id,
    );
  const full = linkFor('DEMO-001'),
    multi = linkFor('DEMO-003'),
    scholarship = linkFor('DEMO-076');
  assert(multi.major_names.length > 1);
  const scenarios = {
    synthetic: true,
    note: 'Profiles are name-based test inputs, not accounts to create. Pending items are excluded by production Recommendations. Scores below describe hypothetical eligibility AFTER a separately authorized Admin approval in a demo database.',
    cases: [
      {
        name: 'full_match_and_null_deadline',
        review_id: full.review_id,
        profile: {
          major: full.major_names[0],
          academic_year: 3,
          skills: full.skill_names,
        },
        expectedScore: 1,
        expectedVisibleAfterApproval: true,
      },
      {
        name: 'partial_skill_match',
        review_id: full.review_id,
        profile: {
          major: full.major_names[0],
          academic_year: 3,
          skills: [full.skill_names[0]],
        },
        expectedScore: Number((0.7 + 0.3 / full.skill_names.length).toFixed(4)),
        expectedVisibleAfterApproval: true,
      },
      {
        name: 'different_major_no_skills_overlap',
        review_id: full.review_id,
        profile: {
          major: 'Công nghệ thông tin',
          academic_year: 3,
          skills: ['Microsoft Word'],
        },
        expectedScore: 0.3,
        expectedVisibleAfterApproval: false,
      },
      {
        name: 'multiple_majors_and_skills',
        review_id: multi.review_id,
        profile: {
          major: multi.major_names[1],
          academic_year: 3,
          skills: multi.skill_names,
        },
        expectedScore: 1,
        expectedVisibleAfterApproval: true,
      },
      {
        name: 'scholarship_without_year_filter',
        review_id: scholarship.review_id,
        profile: {
          major: scholarship.major_names[0],
          academic_year: 1,
          skills: scholarship.skill_names,
        },
        expectedScore: 1,
        expectedVisibleAfterApproval: true,
      },
    ],
  };
  return { batch, scenarios };
}

export function validateDemo(batch, active, now = new Date()) {
  assert.equal(batch.items.length, 100);
  assert.ok(
    batch.initial_catalog_proposal.status === 'needs_review' ||
      batch.initial_catalog_proposal.status === 'leader_approved',
  );
  const categories = new Set(
    active
      .filter((c) => c.status === 'Active')
      .map((c) => c.type + ':' + c.name),
  );
  const ids = new Set(),
    urls = new Set(),
    titles = new Set();
  const counts = {};
  for (const x of batch.items) {
    const o = x.opportunity,
      l = batch.initial_catalog_proposal.opportunity_links.find(
        (l) => l.review_id === x.review_id,
      );
    assert(
      !ids.has(x.review_id) && !urls.has(o.source_url) && !titles.has(o.title),
    );
    ids.add(x.review_id);
    urls.add(o.source_url);
    titles.add(o.title);
    assert(
      l &&
        (l.status === 'needs_review' || l.status === 'leader_approved') &&
        l.major_names.length &&
        l.skill_names.length,
    );
    for (const [type, values] of [
      ['Major', l.major_names],
      ['Skill', l.skill_names],
    ]) {
      assert.equal(new Set(values).size, values.length);
      for (const name of values) assert(categories.has(type + ':' + name));
    }
    assert(
      !o.title.includes('DEMO') &&
        !o.title.includes('SYNTHETIC') &&
        !o.publisher.includes('DEMO') &&
        !o.publisher.includes('SYNTHETIC') &&
        !o.publisher.includes('giả lập') &&
        !o.description.includes('DEMO') &&
        !o.description.includes('SYNTHETIC') &&
        !o.description.includes('Không phải cơ hội thật') &&
        !o.description.includes('Nội dung minh họa') &&
        !o.requirements.includes('DEMO') &&
        !o.requirements.includes('SYNTHETIC') &&
        !o.requirements.includes('Không phải cơ hội thật') &&
        !o.requirements.includes('Nội dung minh họa'),
    );
    assert(
      o.title.length <= 255 &&
        o.publisher.length <= 255 &&
        o.source_url.length <= 500,
    );
    assert(o.description.trim() && o.requirements.trim());
    assert(o.location === null || o.location.length <= 100);
    assert.equal(new URL(o.source_url).hostname, 'unihub-demo.invalid');
    assert.equal(o.status, 'Pending');
    assert.equal(o.is_verified, false);
    assert.equal(o.reviewed_by, null);
    assert.equal(o.reviewed_at, null);
    assert.deepEqual(x.relations.major_ids, []);
    assert.deepEqual(x.relations.skill_ids, []);
    assert(
      x.relations.academic_years.every(
        (y) => Number.isInteger(y) && y >= 1 && y <= 4,
      ),
    );
    assert.equal(
      new Set(x.relations.academic_years).size,
      x.relations.academic_years.length,
    );
    assert(['Online', 'Offline', 'Hybrid'].includes(o.work_format));
    if (o.work_format !== 'Online') assert(o.location);
    if (o.deadline === null) {
      assert.equal(o.deadline_source_date, null);
      assert.equal(o.deadline_source_timezone, null);
      assert.equal(x.evidence.source_status, 'open');
    } else {
      assert(Date.parse(o.deadline) > now.getTime());
      assert.equal(
        Date.parse(o.deadline),
        Date.parse(o.deadline_source_date + 'T00:00:00+07:00') + 86400000,
      );
      assert.equal(o.deadline_source_timezone, null);
    }
    counts[o.opportunity_type] = (counts[o.opportunity_type] ?? 0) + 1;
  }
  assert.deepEqual(counts, { 'Thực tập': 40, 'Việc làm': 35, 'Học bổng': 25 });
  assert.equal(batch.initial_catalog_proposal.opportunity_links.length, 100);
  assert(
    batch.initial_catalog_proposal.categories.every(
      (c) =>
        (c.status === 'needs_review' || c.status === 'leader_approved') &&
        categories.has(c.type + ':' + c.name),
    ),
  );
}

async function main() {
  const prisma = getPrismaClient();
  try {
    const active = await prisma.category.findMany({
      where: { status: 'Active' },
      select: { type: true, name: true, status: true },
    });
    assert.equal(active.filter((c) => c.type === 'Major').length, 117);
    assert.equal(active.filter((c) => c.type === 'Skill').length, 328);
    const groups = JSON.parse(
      await readFile(resolve('data/catalog/major-skill-mapping.json'), 'utf8'),
    ).groups;
    const existing = JSON.parse(
      await readFile(resolve(directory, 'batch-proposal.json'), 'utf8'),
    );
    const mappings = JSON.parse(
      await readFile(resolve(directory, 'reviewed-mapping.json'), 'utf8'),
    );
    const metadata = JSON.parse(
      await readFile(resolve(directory, 'coverage.json'), 'utf8'),
    );
    const { batch, scenarios } = buildDemo(existing, mappings, active);
    const plan = await planImport(prisma, batch);
    assert.equal(plan.blocked, false);
    assert(plan.categories.every((c) => c.action === 'reuse'));
    assert(plan.opportunities.every((o) => o.action === 'create'));
    const groupReport = Object.fromEntries(
      Object.keys(groups).map((g) => [
        g,
        metadata.filter((m) => m.group === g).length,
      ]),
    );
    const report = {
      synthetic: true,
      writes: 0,
      total: 100,
      byType: { 'Thực tập': 40, 'Việc làm': 35, 'Học bổng': 25 },
      byGroup: groupReport,
      activeCatalog: { Major: 117, Skill: 328 },
      usedMajors: batch.initial_catalog_proposal.categories.filter(
        (c) => c.type === 'Major',
      ).length,
      usedSkills: batch.initial_catalog_proposal.categories.filter(
        (c) => c.type === 'Skill',
      ).length,
      nullDeadlines: batch.items.filter((x) => x.opportunity.deadline === null)
        .length,
      multiMajorItems: batch.initial_catalog_proposal.opportunity_links.filter(
        (l) => l.major_names.length > 1,
      ).length,
      validation: 'passed_demo_checks',
      mapping:
        'explicit reviewed per-item mapping; no coverage padding or index-based Skill selection',
      databaseIsolation:
        'NOT VERIFIED; last review target unihub_dev is not an isolated demo database',
      readOnlyPlan: {
        blocked: plan.blocked,
        create: 100,
        reuse: plan.categories.length,
        newCategories: 0,
      },
      approval: 'needs_review; importer dry-run must stop at leader approval',
    };
    for (const [file, value] of [
      ['batch-proposal.json', batch],
      ['scenarios.json', scenarios],
      ['report.json', report],
      ['coverage.json', metadata],
    ])
      await writeFile(
        resolve(directory, file),
        JSON.stringify(value, null, 2) + '\n',
      );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await disconnectPrismaClient();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch(() => {
    console.error(
      'Demo generation failed: catalog/mapping invalid, duplicates or database unavailable. No database writes.',
    );
    process.exitCode = 1;
  });
