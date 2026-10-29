export type GuidanceAcademicYear = 1 | 2 | 3 | 4;
export type GuidanceCategoryStatus = 'Active' | 'Closed';

export interface GuidanceMajor {
  id: number;
  name: string;
  type: 'Major';
}

export interface GuidanceSkill {
  id: number;
  name: string;
}

export interface GuidanceCategoryLink extends GuidanceSkill {
  status: GuidanceCategoryStatus;
}

export interface GuidanceSummary {
  id: number;
  title: string;
  requiredSkills: GuidanceSkill[];
  createdAt: string;
}

export interface GuidanceStage {
  academicYear: GuidanceAcademicYear;
  items: GuidanceSummary[];
}

export interface GuidanceListResponse {
  selectedMajor: GuidanceMajor | null;
  stages: GuidanceStage[];
}

export interface GuidanceDetail {
  id: number;
  title: string;
  publisher: string | null;
  descriptionText: string | null;
  requirementsText: string | null;
  majors: GuidanceCategoryLink[];
  skills: GuidanceCategoryLink[];
  academicYears: GuidanceAcademicYear[];
  createdAt: string;
}

export interface GuidanceDetailResponse {
  item: GuidanceDetail;
}

export class GuidanceContractError extends Error {
  readonly code = 'INVALID_RESPONSE';
  readonly kind = 'response';

  constructor() {
    super('Máy chủ trả dữ liệu lộ trình không hợp lệ.');
    this.name = 'GuidanceContractError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isGuidanceId(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 2_147_483_647
  );
}

function isYear(value: unknown): value is GuidanceAcademicYear {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 4
  );
}

function isInstant(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  )
    return false;
  const date = new Date(value);
  // Round-trip the date/time portion to reject normalized invalid dates and 24:00.
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 19) === value.slice(0, 19)
  );
}

function isNullableText(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function parseSkill(value: unknown): GuidanceSkill {
  if (
    !isRecord(value) ||
    !isGuidanceId(value.id) ||
    typeof value.name !== 'string'
  )
    throw new GuidanceContractError();
  return { id: value.id, name: value.name };
}

function parseLink(value: unknown): GuidanceCategoryLink {
  const skill = parseSkill(value);
  if (
    !isRecord(value) ||
    (value.status !== 'Active' && value.status !== 'Closed')
  )
    throw new GuidanceContractError();
  return { ...skill, status: value.status };
}

function parseSummary(value: unknown): GuidanceSummary {
  if (
    !isRecord(value) ||
    !isGuidanceId(value.id) ||
    typeof value.title !== 'string' ||
    !Array.isArray(value.requiredSkills) ||
    !isInstant(value.createdAt)
  )
    throw new GuidanceContractError();
  return {
    id: value.id,
    title: value.title,
    requiredSkills: value.requiredSkills.map(parseSkill),
    createdAt: value.createdAt,
  };
}

export function parseGuidanceList(value: unknown): GuidanceListResponse {
  if (!isRecord(value) || !Array.isArray(value.stages))
    throw new GuidanceContractError();
  let selectedMajor: GuidanceMajor | null = null;
  if (value.selectedMajor !== null) {
    const major = parseSkill(value.selectedMajor);
    if (!isRecord(value.selectedMajor) || value.selectedMajor.type !== 'Major')
      throw new GuidanceContractError();
    selectedMajor = { ...major, type: 'Major' };
  }
  if (selectedMajor === null && value.stages.length !== 0)
    throw new GuidanceContractError();
  const stages = value.stages.map((stage): GuidanceStage => {
    if (
      !isRecord(stage) ||
      !isYear(stage.academicYear) ||
      !Array.isArray(stage.items)
    )
      throw new GuidanceContractError();
    return {
      academicYear: stage.academicYear,
      items: stage.items.map(parseSummary),
    };
  });
  return { selectedMajor, stages };
}

export function parseGuidanceDetail(value: unknown): GuidanceDetailResponse {
  if (!isRecord(value) || !isRecord(value.item))
    throw new GuidanceContractError();
  const item = value.item;
  if (
    !isGuidanceId(item.id) ||
    typeof item.title !== 'string' ||
    !isNullableText(item.publisher) ||
    !isNullableText(item.descriptionText) ||
    !isNullableText(item.requirementsText) ||
    !isInstant(item.createdAt) ||
    !Array.isArray(item.majors) ||
    !Array.isArray(item.skills) ||
    !Array.isArray(item.academicYears) ||
    !item.academicYears.every(isYear)
  )
    throw new GuidanceContractError();
  return {
    item: {
      id: item.id,
      title: item.title,
      publisher: item.publisher,
      descriptionText: item.descriptionText,
      requirementsText: item.requirementsText,
      majors: item.majors.map(parseLink),
      skills: item.skills.map(parseLink),
      academicYears: [...item.academicYears],
      createdAt: item.createdAt,
    },
  };
}
