import type { PrismaClient } from '../../generated/prisma/client.js';
import { ApiError } from '../../middleware/errors.js';
import {
  publicOpportunityListSelect,
  toListItem,
} from '../opportunities/opportunities.service.js';

export type RecommendationsReadClient = Pick<PrismaClient, '$transaction'>;
const publicTypes = ['Thực tập', 'Việc làm', 'Học bổng'];

export async function listRecommendations(
  client: RecommendationsReadClient,
  userId: number,
  evaluatedAt: Date,
) {
  return client.$transaction(
    async (transaction) => {
      const profile = await transaction.user.findUnique({
        where: { user_id: userId },
        select: {
          major_id: true,
          academic_year: true,
          skills: { select: { skill_id: true } },
        },
      });
      if (
        !profile ||
        profile.major_id === null ||
        !Number.isInteger(profile.academic_year) ||
        profile.academic_year! < 1 ||
        profile.academic_year! > 4 ||
        profile.skills.length === 0
      ) {
        throw new ApiError(
          409,
          'PROFILE_INCOMPLETE',
          'Vui lòng hoàn thiện chuyên ngành, năm học và kỹ năng trong hồ sơ.',
        );
      }
      const skillIds = new Set(profile.skills.map(({ skill_id }) => skill_id));
      const rows = await transaction.opportunity.findMany({
        where: {
          status: 'Approved',
          opportunity_type: { in: publicTypes },
          OR: [
            { deadline: null },
            {
              deadline_source_date: { not: null },
              deadline: { gt: evaluatedAt },
            },
            {
              deadline_source_timezone: { not: null },
              deadline: { gte: evaluatedAt },
            },
          ],
        },
        select: {
          ...publicOpportunityListSelect,
          status: true,
          majors: { select: { major_id: true } },
          skills: { select: { skill_id: true } },
          years: { select: { academic_year: true } },
        },
      });
      const matches = rows.flatMap((row) => {
        // Prisma string predicates follow MySQL collation. Confirm exact stored
        // values as well, without changing the existing Opportunities endpoints.
        if (
          row.status !== 'Approved' ||
          !publicTypes.includes(row.opportunity_type)
        )
          return [];
        const item = toListItem(row, evaluatedAt);
        if (
          item.deadline &&
          (item.deadline.precision === 'unknown' ||
            item.deadline.state !== 'open')
        )
          return [];
        // Major Eligibility Gate:
        // - Nếu cơ hội có Major cụ thể: bắt buộc Major của sinh viên nằm trong danh sách Major của cơ hội.
        // - Nếu cơ hội mở cho mọi ngành (majors: []): cho phép đi qua gate nếu có kỹ năng hợp lệ; majorMatch = 0.
        // - Phân biệt mở cho mọi ngành vs thiếu mapping: cơ hội thiếu cả Major lẫn Skill bị loại bỏ.
        const hasSpecificMajors = row.majors.length > 0;
        const matchesStudentMajor = row.majors.some(
          ({ major_id }) => major_id === profile.major_id,
        );

        if (hasSpecificMajors) {
          if (!matchesStudentMajor) {
            return []; // Excluded at Major Eligibility Gate
          }
        } else {
          // majors rỗng: loại bỏ nếu thiếu mapping (cả major và skill đều rỗng)
          if (row.skills.length === 0) {
            return []; // Excluded: unmapped opportunity
          }
        }

        const majorMatch = matchesStudentMajor ? 1 : 0;

        // YearMatch:
        // - Cơ hội không giới hạn năm học (years: []): yearMatch = 1 cho cả ba loại cơ hội.
        // - Cơ hội có quy định năm học cụ thể: so khớp năm học của sinh viên.
        const yearMatch =
          row.years.length === 0
            ? 1
            : row.years.some(
                  ({ academic_year }) =>
                    academic_year === profile.academic_year,
                )
              ? 1
              : 0;
        // Join-table primary keys guarantee distinct IDs; category status/name
        // deliberately does not participate in either the numerator or denominator.
        const skillMatch =
          row.skills.length === 0
            ? 1
            : row.skills.filter(({ skill_id }) => skillIds.has(skill_id))
                .length / row.skills.length;
        const score = 0.4 * majorMatch + 0.3 * yearMatch + 0.3 * skillMatch;
        return score < 0.5
          ? []
          : [{ item, score, deadline: row.deadline?.getTime() ?? Infinity }];
      });
      matches.sort(
        (a, b) =>
          b.score - a.score || a.deadline - b.deadline || a.item.id - b.item.id,
      );
      return {
        items: matches.map(({ item, score }) => ({
          ...item,
          matchScore: Number(score.toFixed(4)),
        })),
        meta: { evaluatedAt: evaluatedAt.toISOString().replace('.000Z', 'Z') },
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
