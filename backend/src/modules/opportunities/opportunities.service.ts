import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { ApiError } from '../../middleware/errors.js';

const PUBLIC_TYPES = ['Thực tập', 'Việc làm', 'Học bổng'] as const;
const ALLOWED_QUERY_KEYS = new Set([
  'q',
  'majorId',
  'type',
  'workFormat',
  'page',
  'pageSize',
]);
const MAX_MYSQL_INT = 2_147_483_647;
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export type OpportunityReadClient = PrismaClient;

interface ListQuery {
  q?: string;
  majorId?: number;
  type?: (typeof PUBLIC_TYPES)[number];
  workFormat?: 'Online' | 'Offline' | 'Hybrid';
  page: number;
  pageSize: number;
}

function invalidQuery(): ApiError {
  return new ApiError(
    400,
    'INVALID_QUERY',
    'Tham số tìm kiếm hoặc lọc không hợp lệ.',
  );
}

function invalidFilter(): ApiError {
  return new ApiError(
    400,
    'INVALID_FILTER',
    'Bộ lọc chuyên ngành không còn hợp lệ.',
  );
}

function readQuery(originalUrl: string): ListQuery {
  const url = new URL(originalUrl, 'http://unihub.invalid');
  const values = new Map<string, string>();

  for (const [key, value] of url.searchParams) {
    if (!ALLOWED_QUERY_KEYS.has(key) || values.has(key)) throw invalidQuery();
    values.set(key, value);
  }

  const parseBoundedInteger = (
    key: 'page' | 'pageSize',
    fallback: number,
    min: number,
    max: number,
  ) => {
    const value = values.get(key);
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(value)) throw invalidQuery();
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
      throw invalidQuery();
    }
    return parsed;
  };

  const result: ListQuery = {
    page: parseBoundedInteger('page', 1, 1, 1_000_000),
    pageSize: parseBoundedInteger('pageSize', 20, 1, 100),
  };

  const rawQuery = values.get('q');
  if (rawQuery !== undefined) {
    const trimmed = rawQuery.trim();
    if (Array.from(trimmed).length > 100) throw invalidQuery();
    if (trimmed) result.q = trimmed.normalize('NFC');
  }

  const rawMajorId = values.get('majorId');
  if (rawMajorId !== undefined) {
    if (!/^\d+$/.test(rawMajorId)) throw invalidFilter();
    const majorId = Number(rawMajorId);
    if (
      !Number.isSafeInteger(majorId) ||
      majorId < 1 ||
      majorId > MAX_MYSQL_INT
    ) {
      throw invalidFilter();
    }
    result.majorId = majorId;
  }

  const rawType = values.get('type');
  if (rawType !== undefined) {
    if (!PUBLIC_TYPES.includes(rawType as (typeof PUBLIC_TYPES)[number])) {
      throw invalidQuery();
    }
    result.type = rawType as (typeof PUBLIC_TYPES)[number];
  }

  const rawWorkFormat = values.get('workFormat');
  if (rawWorkFormat !== undefined) {
    if (!['Online', 'Offline', 'Hybrid'].includes(rawWorkFormat)) {
      throw invalidQuery();
    }
    result.workFormat = rawWorkFormat as ListQuery['workFormat'];
  }

  return result;
}

function literalContainsPattern(query: string): string {
  // ESCAPE '!' makes %, _, and ! literal without treating backslash specially.
  return `%${query.replace(/[!%_]/g, (character) => `!${character}`)}%`;
}

function whereFor(query: ListQuery): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`o.status COLLATE utf8mb4_0900_as_cs = 'Approved'`,
    Prisma.sql`o.opportunity_type COLLATE utf8mb4_0900_as_cs IN ('Thực tập', 'Việc làm', 'Học bổng')`,
  ];

  if (query.type) {
    conditions.push(Prisma.sql`o.opportunity_type = ${query.type}`);
  }
  if (query.workFormat) {
    conditions.push(Prisma.sql`o.work_format = ${query.workFormat}`);
  }
  if (query.majorId !== undefined) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1
      FROM opportunity_majors AS om
      INNER JOIN categories AS major ON major.category_id = om.major_id
      WHERE om.item_id = o.item_id
        AND om.major_id = ${query.majorId}
        AND major.type COLLATE utf8mb4_0900_as_cs = 'Major'
        AND major.status COLLATE utf8mb4_0900_as_cs = 'Active'
    )`);
  }
  if (query.q) {
    const pattern = literalContainsPattern(query.q);
    conditions.push(Prisma.sql`(
      o.title COLLATE utf8mb4_0900_as_ci LIKE ${pattern} ESCAPE '!'
      OR o.publisher COLLATE utf8mb4_0900_as_ci LIKE ${pattern} ESCAPE '!'
      OR EXISTS (
        SELECT 1
        FROM opportunity_skills AS os
        INNER JOIN categories AS skill ON skill.category_id = os.skill_id
        WHERE os.item_id = o.item_id
          AND skill.type COLLATE utf8mb4_0900_as_cs = 'Skill'
          AND skill.name COLLATE utf8mb4_0900_as_ci LIKE ${pattern} ESCAPE '!'
      )
    )`);
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

function formatInstant(value: Date): string {
  return value.toISOString().replace('.000Z', 'Z');
}

function formatUtcDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatVietnamDate(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const fields = new Map(parts.map((part) => [part.type, part.value]));
  return `${fields.get('year')}-${fields.get('month')}-${fields.get('day')}`;
}

function deadlineDto(
  row: Pick<
    OpportunityWithRelations,
    'deadline' | 'deadline_source_date' | 'deadline_source_timezone'
  >,
  evaluatedAt: Date,
) {
  if (!row.deadline) return null;

  const instant = formatInstant(row.deadline);
  if (row.deadline_source_date && !row.deadline_source_timezone) {
    return {
      precision: 'date' as const,
      date: formatUtcDate(row.deadline_source_date),
      sourceTimeZone: null,
      instant,
      state:
        evaluatedAt >= row.deadline ? ('expired' as const) : ('open' as const),
    };
  }

  if (!row.deadline_source_date && row.deadline_source_timezone) {
    return {
      precision: 'datetime' as const,
      date: formatVietnamDate(row.deadline),
      sourceTimeZone: row.deadline_source_timezone,
      instant,
      state:
        row.deadline < evaluatedAt ? ('expired' as const) : ('open' as const),
    };
  }

  return {
    precision: 'unknown' as const,
    date: null,
    sourceTimeZone: null,
    instant,
    state: 'unknown' as const,
  };
}

function safeSourceUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? value
      : null;
  } catch {
    return null;
  }
}

function toPublicItem(row: OpportunityWithRelations, evaluatedAt: Date) {
  return {
    id: row.item_id,
    type: row.opportunity_type,
    title: row.title,
    publisher: row.publisher,
    descriptionText: row.description,
    requirementsText: row.requirements,
    workFormat: row.work_format,
    location: row.work_format === 'Online' ? null : row.location,
    deadline: deadlineDto(row, evaluatedAt),
    isVerified: row.is_verified,
    sourceUrl: safeSourceUrl(row.source_url),
    majors: row.majors.map(({ major }) => ({
      id: major.category_id,
      name: major.name,
    })),
    skills: row.skills.map(({ skill }) => ({
      id: skill.category_id,
      name: skill.name,
    })),
    eligibleAcademicYears: row.years.map(({ academic_year }) => academic_year),
  };
}

export function toAdminOpportunityItem(
  row: OpportunityWithRelations,
  evaluatedAt: Date,
) {
  return {
    ...toPublicItem(row, evaluatedAt),
    createdAt: formatInstant(row.created_at),
    status: row.status,
    reviewedAt: row.reviewed_at ? formatInstant(row.reviewed_at) : null,
  };
}

function toListItem(row: PublicOpportunityListRow, evaluatedAt: Date) {
  return {
    id: row.item_id,
    type: row.opportunity_type,
    title: row.title,
    publisher: row.publisher,
    workFormat: row.work_format,
    location: row.work_format === 'Online' ? null : row.location,
    deadline: deadlineDto(row, evaluatedAt),
    isVerified: row.is_verified,
  };
}

const publicOpportunityWhere = {
  status: 'Approved',
  opportunity_type: { in: [...PUBLIC_TYPES] },
} satisfies Prisma.OpportunityWhereInput;

export const opportunityRelationsInclude = {
  majors: {
    where: { major: { type: 'Major' } },
    select: { major: { select: { category_id: true, name: true } } },
    orderBy: [{ major: { name: 'asc' } }, { major_id: 'asc' }],
  },
  skills: {
    where: { skill: { type: 'Skill' } },
    select: { skill: { select: { category_id: true, name: true } } },
    orderBy: [{ skill: { name: 'asc' } }, { skill_id: 'asc' }],
  },
  years: {
    select: { academic_year: true },
    orderBy: { academic_year: 'asc' },
  },
} as const satisfies Prisma.OpportunityInclude;

export type OpportunityWithRelations = Prisma.OpportunityGetPayload<{
  include: typeof opportunityRelationsInclude;
}>;

const publicOpportunityListSelect = {
  item_id: true,
  opportunity_type: true,
  title: true,
  publisher: true,
  work_format: true,
  location: true,
  deadline: true,
  deadline_source_date: true,
  deadline_source_timezone: true,
  is_verified: true,
} as const satisfies Prisma.OpportunitySelect;

type PublicOpportunityListRow = Prisma.OpportunityGetPayload<{
  select: typeof publicOpportunityListSelect;
}>;

export function parseOpportunityId(rawId: string): number {
  if (!/^\d+$/.test(rawId)) {
    throw new ApiError(400, 'INVALID_ID', 'Mã cơ hội không hợp lệ.');
  }
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1 || id > MAX_MYSQL_INT) {
    throw new ApiError(400, 'INVALID_ID', 'Mã cơ hội không hợp lệ.');
  }
  return id;
}

export async function listPublicOpportunities(
  client: OpportunityReadClient,
  originalUrl: string,
  evaluatedAt: Date,
) {
  const query = readQuery(originalUrl);
  const offset = (query.page - 1) * query.pageSize;
  const where = whereFor(query);

  const result = await client.$transaction(async (transaction) => {
    if (query.majorId !== undefined) {
      const activeMajor = await transaction.category.findFirst({
        where: {
          category_id: query.majorId,
          type: 'Major',
          status: 'Active',
        },
        select: { category_id: true },
      });
      if (!activeMajor) throw invalidFilter();
    }

    const countRows = await transaction.$queryRaw<
      Array<{ total: bigint | number }>
    >(Prisma.sql`SELECT COUNT(*) AS total FROM opportunities AS o ${where}`);
    const total = Number(countRows[0]?.total ?? 0);
    if (!Number.isSafeInteger(total))
      throw new Error('Opportunity count is invalid.');

    const idRows = await transaction.$queryRaw<Array<{ item_id: number }>>(
      Prisma.sql`SELECT o.item_id
        FROM opportunities AS o
        ${where}
        ORDER BY
          CASE
            WHEN o.deadline IS NULL THEN 1
            WHEN o.deadline_source_date IS NULL AND o.deadline_source_timezone IS NULL THEN 2
            WHEN o.deadline_source_date IS NOT NULL AND o.deadline > ${evaluatedAt} THEN 0
            WHEN o.deadline_source_timezone IS NOT NULL AND o.deadline >= ${evaluatedAt} THEN 0
            ELSE 3
          END ASC,
          CASE
            WHEN o.deadline_source_date IS NOT NULL OR o.deadline_source_timezone IS NOT NULL
            THEN o.deadline
            ELSE NULL
          END ASC,
          o.item_id ASC
        LIMIT ${query.pageSize} OFFSET ${offset}`,
    );
    const ids = idRows.map(({ item_id }) => item_id);

    const rows = ids.length
      ? await transaction.opportunity.findMany({
          where: {
            ...publicOpportunityWhere,
            item_id: { in: ids },
          },
          select: publicOpportunityListSelect,
        })
      : [];
    const rowsById = new Map(rows.map((row) => [row.item_id, row]));

    return {
      total,
      items: ids.flatMap((id) => {
        const row = rowsById.get(id);
        return row ? [toListItem(row, evaluatedAt)] : [];
      }),
    };
  });

  return {
    items: result.items,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
      totalPages:
        result.total === 0 ? 0 : Math.ceil(result.total / query.pageSize),
      evaluatedAt: formatInstant(evaluatedAt),
    },
  };
}

export async function getPublicOpportunity(
  client: OpportunityReadClient,
  rawId: string,
  evaluatedAt: Date,
) {
  const id = parseOpportunityId(rawId);
  const row = await client.$transaction(async (transaction) => {
    const publicIds = await transaction.$queryRaw<Array<{ item_id: number }>>(
      Prisma.sql`SELECT o.item_id
        FROM opportunities AS o
        WHERE o.item_id = ${id}
          AND o.status COLLATE utf8mb4_0900_as_cs = 'Approved'
          AND o.opportunity_type COLLATE utf8mb4_0900_as_cs IN ('Thực tập', 'Việc làm', 'Học bổng')
        LIMIT 1`,
    );
    if (publicIds.length === 0) return null;

    return transaction.opportunity.findUnique({
      where: { item_id: id },
      include: opportunityRelationsInclude,
    });
  });

  if (!row) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy cơ hội.');
  }

  return {
    item: toPublicItem(row, evaluatedAt),
    evaluatedAt: formatInstant(evaluatedAt),
  };
}
