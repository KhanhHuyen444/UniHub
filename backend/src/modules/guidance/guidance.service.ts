import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { ApiError } from '../../middleware/errors.js';
import type { VerifiedAuthIdentity } from '../auth/access-token.js';

export type GuidanceReadClient = Pick<
  PrismaClient,
  'category' | 'user' | 'opportunity'
>;

const publicGuidanceWhere = {
  opportunity_type: 'Bài viết định hướng',
  status: 'Approved',
} as const;
const majorSelect = { category_id: true, name: true } as const;
const skillRelation = {
  where: { skill: { type: 'Skill' } },
  select: {
    skill: { select: { category_id: true, name: true, status: true } },
  },
  orderBy: [{ skill: { name: 'asc' } }, { skill_id: 'asc' }],
} satisfies Prisma.OpportunitySelect['skills'];
const yearsRelation = {
  select: { academic_year: true },
  orderBy: { academic_year: 'asc' },
} satisfies Prisma.OpportunitySelect['years'];

export function parseGuidanceId(
  value: string,
  code: 'INVALID_ID' | 'INVALID_QUERY',
): number {
  const id = Number(value);
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(id) ||
    id < 1 ||
    id > 2_147_483_647
  ) {
    throw new ApiError(
      400,
      code,
      'Mã định hướng hoặc chuyên ngành không hợp lệ.',
    );
  }
  return id;
}

export function parseGuidanceQuery(originalUrl: string): number | undefined {
  const params = new URL(originalUrl, 'http://unihub.invalid').searchParams;
  if (
    [...params.keys()].some((key) => key !== 'majorId') ||
    params.getAll('majorId').length > 1
  ) {
    throw new ApiError(400, 'INVALID_QUERY', 'Tham số truy vấn không hợp lệ.');
  }
  const value = params.get('majorId');
  return value === null ? undefined : parseGuidanceId(value, 'INVALID_QUERY');
}

export async function listPublicGuidance(
  client: GuidanceReadClient,
  majorId?: number,
  identity?: VerifiedAuthIdentity,
) {
  const activeMajor = (id: number) =>
    client.category.findFirst({
      where: { category_id: id, type: 'Major', status: 'Active' },
      select: majorSelect,
    });
  let major: { category_id: number; name: string } | null | undefined;
  if (majorId !== undefined) {
    major = await activeMajor(majorId);
    if (!major)
      throw new ApiError(
        400,
        'INVALID_FILTER',
        'Chuyên ngành không còn khả dụng.',
      );
  } else {
    if (identity?.role === 'Student') {
      const profile = await client.user.findUnique({
        where: { user_id: identity.userId },
        select: { major_id: true },
      });
      if (profile?.major_id !== null && profile?.major_id !== undefined) {
        major = await activeMajor(profile.major_id);
      }
    }
    major ??= await client.category.findFirst({
      where: { type: 'Major', status: 'Active' },
      select: majorSelect,
      orderBy: [{ name: 'asc' }, { category_id: 'asc' }],
    });
  }
  if (!major) return { selectedMajor: null, stages: [] };

  const rows = await client.opportunity.findMany({
    where: {
      ...publicGuidanceWhere,
      majors: { some: { major_id: major.category_id } },
      years: { some: { academic_year: { gte: 1, lte: 4 } } },
    },
    select: {
      item_id: true,
      title: true,
      created_at: true,
      skills: skillRelation,
      years: yearsRelation,
    },
    orderBy: { item_id: 'asc' },
  });
  const stages = [1, 2, 3, 4].flatMap((academicYear) => {
    const items = rows
      .filter((row) =>
        row.years.some((year) => year.academic_year === academicYear),
      )
      .map((row) => ({
        id: row.item_id,
        title: row.title,
        requiredSkills: row.skills.map(({ skill }) => ({
          id: skill.category_id,
          name: skill.name,
        })),
        createdAt: row.created_at.toISOString(),
      }));
    return items.length ? [{ academicYear, items }] : [];
  });
  return {
    selectedMajor: {
      id: major.category_id,
      name: major.name,
      type: 'Major' as const,
    },
    stages,
  };
}

export async function getPublicGuidance(
  client: GuidanceReadClient,
  id: number,
) {
  const row = await client.opportunity.findFirst({
    where: { ...publicGuidanceWhere, item_id: id },
    select: {
      item_id: true,
      title: true,
      publisher: true,
      description: true,
      requirements: true,
      created_at: true,
      majors: {
        where: { major: { type: 'Major' } },
        select: {
          major: { select: { category_id: true, name: true, status: true } },
        },
        orderBy: [{ major: { name: 'asc' } }, { major_id: 'asc' }],
      },
      skills: skillRelation,
      years: yearsRelation,
    },
  });
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên.');
  return {
    item: {
      id: row.item_id,
      title: row.title,
      publisher: row.publisher,
      descriptionText: row.description,
      requirementsText: row.requirements,
      majors: row.majors.map(({ major }) => ({
        id: major.category_id,
        name: major.name,
        status: major.status,
      })),
      skills: row.skills.map(({ skill }) => ({
        id: skill.category_id,
        name: skill.name,
        status: skill.status,
      })),
      academicYears: row.years.map(({ academic_year }) => academic_year),
      createdAt: row.created_at.toISOString(),
    },
  };
}
