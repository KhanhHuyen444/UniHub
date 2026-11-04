import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getPrismaClient,
  disconnectPrismaClient,
} from '../../../backend/dist/lib/prisma.js';

export async function seedDevOpportunities(prismaClient = null) {
  const fixturePath = new URL(
    './dev-opportunities-fixture.json',
    import.meta.url,
  );
  const items = JSON.parse(await readFile(fixturePath, 'utf8'));
  assert.equal(items.length, 11, 'Fixture must contain exactly 11 items');

  const prisma = prismaClient ?? getPrismaClient();

  const dbQuery = await prisma.$queryRawUnsafe('SELECT DATABASE() as db');
  const targetDb = dbQuery[0]?.db;
  console.log(`Seeding dev opportunities fixture into database: "${targetDb}"`);

  // 1. Fetch categories map from target database
  const categories = await prisma.category.findMany({
    select: { category_id: true, type: true, name: true },
  });
  const catMap = new Map(
    categories.map((c) => [`${c.type}:${c.name}`, c.category_id]),
  );

  // 2. Fetch admin user id for reviewed_by if present
  const adminUser = await prisma.user.findFirst({
    where: { role: 'Admin' },
    select: { user_id: true },
  });
  const adminId = adminUser?.user_id ?? null;

  let createdCount = 0;
  let updatedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const existing = await tx.opportunity.findFirst({
        where: {
          source_url: item.source_url,
          title: item.title,
        },
        include: {
          majors: true,
          skills: true,
          years: true,
        },
      });

      if (existing) {
        // Update existing item to match fixture (e.g. status, skills)
        await tx.opportunity.update({
          where: { item_id: existing.item_id },
          data: {
            opportunity_type: item.opportunity_type,
            title: item.title,
            publisher: item.publisher,
            description: item.description,
            requirements: item.requirements,
            location: item.location,
            work_format: item.work_format,
            deadline: item.deadline ? new Date(item.deadline) : null,
            deadline_source_date: item.deadline_source_date
              ? new Date(item.deadline_source_date)
              : null,
            deadline_source_timezone: item.deadline_source_timezone,
            status: item.status,
            is_verified: item.is_verified,
            reviewed_by:
              item.status === 'Approved' || item.status === 'Rejected'
                ? adminId
                : null,
            reviewed_at:
              item.status === 'Approved' || item.status === 'Rejected'
                ? (existing.reviewed_at ?? new Date())
                : null,
          },
        });

        // Re-sync majors
        await tx.opportunityMajor.deleteMany({
          where: { item_id: existing.item_id },
        });
        for (const m of item.majors) {
          const catId = catMap.get(`Major:${m}`);
          if (catId) {
            await tx.opportunityMajor.create({
              data: { item_id: existing.item_id, major_id: catId },
            });
          }
        }

        // Re-sync skills
        await tx.opportunitySkill.deleteMany({
          where: { item_id: existing.item_id },
        });
        for (const s of item.skills) {
          const catId = catMap.get(`Skill:${s}`);
          if (catId) {
            await tx.opportunitySkill.create({
              data: { item_id: existing.item_id, skill_id: catId },
            });
          }
        }

        // Re-sync years
        await tx.opportunityYear.deleteMany({
          where: { item_id: existing.item_id },
        });
        for (const y of item.academic_years) {
          await tx.opportunityYear.create({
            data: { item_id: existing.item_id, academic_year: y },
          });
        }

        updatedCount++;
      } else {
        // Create new item
        const created = await tx.opportunity.create({
          data: {
            opportunity_type: item.opportunity_type,
            title: item.title,
            publisher: item.publisher,
            description: item.description,
            requirements: item.requirements,
            location: item.location,
            work_format: item.work_format,
            deadline: item.deadline ? new Date(item.deadline) : null,
            deadline_source_date: item.deadline_source_date
              ? new Date(item.deadline_source_date)
              : null,
            deadline_source_timezone: item.deadline_source_timezone,
            status: item.status,
            is_verified: item.is_verified,
            source_url: item.source_url,
            reviewed_by:
              item.status === 'Approved' || item.status === 'Rejected'
                ? adminId
                : null,
            reviewed_at:
              item.status === 'Approved' || item.status === 'Rejected'
                ? new Date()
                : null,
          },
        });

        for (const m of item.majors) {
          const catId = catMap.get(`Major:${m}`);
          if (catId) {
            await tx.opportunityMajor.create({
              data: { item_id: created.item_id, major_id: catId },
            });
          }
        }

        for (const s of item.skills) {
          const catId = catMap.get(`Skill:${s}`);
          if (catId) {
            await tx.opportunitySkill.create({
              data: { item_id: created.item_id, skill_id: catId },
            });
          }
        }

        for (const y of item.academic_years) {
          await tx.opportunityYear.create({
            data: { item_id: created.item_id, academic_year: y },
          });
        }

        createdCount++;
      }
    }
  });

  console.log(
    `Seeding complete. Created: ${createdCount}, Updated/Synced: ${updatedCount}`,
  );
  const totalInDb = await prisma.opportunity.count();
  console.log(`Total opportunities in "${targetDb}": ${totalInDb}`);

  return { createdCount, updatedCount, totalInDb };
}

// Allow direct CLI invocation
if (process.argv[1] && process.argv[1].endsWith('seed-dev-opportunities.mjs')) {
  seedDevOpportunities()
    .then(() => disconnectPrismaClient())
    .catch(async (err) => {
      console.error('Seed failed:', err);
      await disconnectPrismaClient();
      process.exit(1);
    });
}
