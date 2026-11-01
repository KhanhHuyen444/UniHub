import type { PrismaClient, Prisma } from '../../generated/prisma/client.js';
import { ApiError } from '../../middleware/errors.js';

export type ProfileClient = Pick<PrismaClient, 'user' | '$transaction'>;
const categorySelect = { category_id: true, name: true, status: true } as const;
const profileSelect = {
  major: { select: categorySelect },
  academic_year: true,
  career_goal: true,
  skills: {
    select: { skill: { select: categorySelect } },
    orderBy: { skill_id: 'asc' },
  },
} as const;

export async function getProfile(
  client: Pick<Prisma.TransactionClient, 'user'>,
  userId: number,
) {
  const row = await client.user.findUnique({
    where: { user_id: userId },
    select: profileSelect,
  });
  if (!row)
    throw new ApiError(401, 'UNAUTHORIZED', 'Tài khoản không còn tồn tại.');
  const category = (item: {
    category_id: number;
    name: string;
    status: string;
  }) => ({ id: item.category_id, name: item.name, status: item.status });
  return {
    profile: {
      major: row.major ? category(row.major) : null,
      academicYear: row.academic_year,
      skills: row.skills.map(({ skill }) => category(skill)),
      careerGoal: row.career_goal,
    },
    isComplete:
      row.major !== null &&
      Number.isInteger(row.academic_year) &&
      row.academic_year! >= 1 &&
      row.academic_year! <= 4 &&
      row.skills.length > 0,
  };
}

export interface ProfileInput {
  majorId: number;
  academicYear: number;
  skillIds: number[];
  careerGoal: string | null;
}
function invalid(code: string): never {
  throw new ApiError(400, code, 'Dữ liệu hồ sơ không hợp lệ.');
}
function isId(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) > 0 &&
    (value as number) <= 2147483647
  );
}
export function validateProfile(value: unknown): ProfileInput {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid('INVALID_REQUEST');
  const body = value as Record<string, unknown>;
  const fields = ['majorId', 'academicYear', 'skillIds', 'careerGoal'];
  if (
    Object.keys(body).length !== fields.length ||
    fields.some((key) => !Object.hasOwn(body, key))
  )
    invalid('INVALID_REQUEST');
  if (!isId(body.majorId)) invalid('INVALID_CATEGORY');
  if (
    !Number.isInteger(body.academicYear) ||
    (body.academicYear as number) < 1 ||
    (body.academicYear as number) > 4
  )
    invalid('VALIDATION_ERROR');
  if (
    !Array.isArray(body.skillIds) ||
    !body.skillIds.length ||
    !body.skillIds.every(isId) ||
    new Set(body.skillIds).size !== body.skillIds.length
  )
    invalid('INVALID_SKILL');
  if (body.careerGoal !== null && typeof body.careerGoal !== 'string')
    invalid('VALIDATION_ERROR');
  const careerGoal =
    typeof body.careerGoal === 'string' ? body.careerGoal.trim() || null : null;
  if (careerGoal && Array.from(careerGoal).length > 200)
    invalid('VALIDATION_ERROR');
  return {
    majorId: body.majorId,
    academicYear: body.academicYear as number,
    skillIds: body.skillIds as number[],
    careerGoal,
  };
}

type CategoryRow = { category_id: number; type: string; status: string };
export async function putProfile(
  client: ProfileClient,
  userId: number,
  input: ProfileInput,
) {
  return client.$transaction(
    async (tx) => {
      // Serialize edits of this profile before reading its current Closed links.
      await tx.$queryRaw`SELECT user_id FROM users WHERE user_id = ${userId} FOR UPDATE`;
      const previous = await tx.user.findUnique({
        where: { user_id: userId },
        select: { major_id: true, skills: { select: { skill_id: true } } },
      });
      if (!previous)
        throw new ApiError(401, 'UNAUTHORIZED', 'Tài khoản không còn tồn tại.');
      const ids = [...new Set([input.majorId, ...input.skillIds])].sort(
        (a, b) => a - b,
      );
      const observed = await tx.category.findMany({
        where: { category_id: { in: ids } },
        select: { category_id: true, type: true, status: true },
      });
      const oldSkills = new Set(previous.skills.map((item) => item.skill_id));
      for (const id of ids) {
        const isMajor = id === input.majorId;
        const row = observed.find((item) => item.category_id === id);
        if (!row || row.type !== (isMajor ? 'Major' : 'Skill'))
          invalid(isMajor ? 'INVALID_CATEGORY' : 'INVALID_SKILL');
        // A valid Major ID in skillIds is still an invalid Skill.
        if (isMajor && input.skillIds.includes(id)) invalid('INVALID_SKILL');
        const existing = isMajor ? previous.major_id === id : oldSkills.has(id);
        if (row.status !== 'Active' && !existing)
          invalid(isMajor ? 'CATEGORY_NOT_ACTIVE' : 'SKILL_NOT_ACTIVE');
        // Current locking read detects a close after validation and prevents a close
        // between this check and commit. Parameterized SQL; stable ID lock order.
        const locked = await tx.$queryRaw<
          CategoryRow[]
        >`SELECT category_id, type, status FROM categories WHERE category_id = ${id} FOR SHARE`;
        if (
          !locked[0] ||
          (row.status === 'Active' && locked[0].status !== 'Active')
        )
          throw new ApiError(
            409,
            'CATEGORY_CLOSED',
            'Danh mục đã thay đổi. Vui lòng tải lại hồ sơ.',
          );
      }
      await tx.user.update({
        where: { user_id: userId },
        data: {
          major_id: input.majorId,
          academic_year: input.academicYear,
          career_goal: input.careerGoal,
        },
      });
      await tx.userSkill.deleteMany({ where: { user_id: userId } });
      await tx.userSkill.createMany({
        data: input.skillIds.map((skill_id) => ({ user_id: userId, skill_id })),
      });
      return getProfile(tx, userId);
    },
    { isolationLevel: 'ReadCommitted' },
  );
}
