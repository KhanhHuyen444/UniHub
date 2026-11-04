import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '../generated/prisma/client.js';
import { getPrismaClient, disconnectPrismaClient } from '../lib/prisma.js';
import type { ImportBatch } from './opportunities-import.js';

// Types and Contracts
export interface CollectorConfig {
  greenhouseBoards: string[];
  leverSites: string[];
  scholarshipSources: ScholarshipSourceDef[];
}

export interface ScholarshipSourceDef {
  name: string;
  publisher: string;
  url: string;
  fixedDeadlineDate?: string; // YYYY-MM-DD
  fixedMajors?: string[];
  fixedSkills?: string[];
  description: string;
  requirements: string;
}

export interface RawExtractedItem {
  sourceType: 'greenhouse' | 'lever' | 'scholarship' | 'official';
  externalId: string;
  title: string;
  publisher: string;
  sourceUrl: string;
  location: string | null;
  workFormat: 'Online' | 'Offline' | 'Hybrid' | null;
  opportunityType: 'Thực tập' | 'Việc làm' | 'Học bổng';
  description: string;
  requirements: string;
  deadlineSourceDate: string | null; // YYYY-MM-DD
  sourceStatus?: 'open' | 'closed' | 'unknown';
  rawPayload?: unknown;
}

export interface NeedsReviewRecord {
  reviewId: string;
  sourceType: string;
  title: string;
  publisher: string;
  deadlineSourceDate: string | null;
  location: string | null;
  sourceUrl: string;
  reviewStatus: 'NEEDS_REVIEW';
  reason: string;
}

export interface CatalogReference {
  majors: Map<string, number | null>; // name -> id (or null if offline)
  skills: Map<string, number | null>;
}

export const DEFAULT_CONFIG: CollectorConfig = {
  greenhouseBoards: ['axon', 'canonical'],
  leverSites: ['palantir', 'coupa'],
  scholarshipSources: [
    {
      name: 'RMIT Vice-Chancellor’s Scholars',
      publisher: 'RMIT University Vietnam',
      url: 'https://www.rmit.edu.vn/study-at-rmit/scholarships/future-undergraduate-student-scholarships',
      fixedDeadlineDate: '2026-11-30',
      fixedMajors: [
        'Công nghệ thông tin',
        'Quản trị kinh doanh',
        'Thiết kế đồ họa',
      ],
      fixedSkills: ['Tiếng Anh', 'Kỹ năng thuyết trình'],
      description:
        '## Mô tả học bổng\nHọc bổng Vice-Chancellor dành cho sinh viên Việt Nam có thành tích học tập xuất sắc và phẩm chất lãnh đạo vượt trội theo học chương trình cử nhân tại RMIT Việt Nam.\n## Giá trị học bổng\nTài trợ 100% học phí toàn khóa học cử nhân.',
      requirements:
        '## Yêu cầu ứng viên\n- Là công dân Việt Nam chuẩn bị nhập học chương trình cử nhân.\n- Điểm trung bình học tập THPT lớp 12 từ 9.0/10 trở lên.\n- Trình độ tiếng Anh tối thiểu IELTS 6.5 (không kỹ năng nào dưới 6.0) hoặc tương đương.\n- Thể hiện năng lực lãnh đạo và đóng góp tích cực cho cộng đồng.',
    },
    {
      name: 'Vingroup Science and Technology Scholarship',
      publisher: 'Tập đoàn Vingroup',
      url: 'https://vinuni.edu.vn/admission-scholarships/',
      fixedDeadlineDate: '2026-12-15',
      fixedMajors: [
        'Khoa học máy tính',
        'Kỹ thuật phần mềm',
        'Công nghệ thông tin',
      ],
      fixedSkills: ['Nghiên cứu khoa học', 'Tiếng Anh'],
      description:
        '## Mô tả học bổng\nChương trình học bổng Khoa học Công nghệ đào tạo thạc sĩ, tiến sĩ và hỗ trợ tài năng trẻ xuất sắc trong các lĩnh vực công nghệ trọng điểm.\n## Quyền lợi\nTài trợ toàn phần học phí, sinh hoạt phí và bảo hiểm y tế trong suốt thời gian đào tạo.',
      requirements:
        '## Yêu cầu ứng viên\n- Tốt nghiệp đại học loại giỏi trở lên các ngành Khoa học máy tính, Công nghệ thông tin hoặc kỹ thuật liên quan.\n- Có năng lực và đam mê nghiên cứu khoa học, ưu tiên ứng viên có bài báo khoa học.\n- Thành thạo tiếng Anh học thuật (IELTS 6.5 trở lên).',
    },
  ],
};

// Text & HTML Cleaning Utilities
export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export function htmlToCleanText(html: string): string {
  if (!html) return '';
  const decoded = decodeHtmlEntities(html);
  return decoded
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n## $1\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n- $1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

export function detectOpportunityType(
  title: string,
  content: string,
): 'Thực tập' | 'Việc làm' | 'Học bổng' {
  const text = (title + ' ' + content).toLowerCase();
  if (
    text.includes('học bổng') ||
    text.includes('scholarship') ||
    text.includes('fellowship')
  ) {
    return 'Học bổng';
  }
  if (
    text.includes('thực tập') ||
    text.includes('intern') ||
    text.includes('internship') ||
    text.includes('trainee')
  ) {
    return 'Thực tập';
  }
  return 'Việc làm';
}

export function detectWorkFormat(
  locationStr: string | null,
  content: string,
): 'Online' | 'Offline' | 'Hybrid' | null {
  const combined = ((locationStr || '') + ' ' + content).toLowerCase();
  if (combined.includes('hybrid') || combined.includes('linh hoạt'))
    return 'Hybrid';
  if (
    combined.includes('remote') ||
    combined.includes('online') ||
    combined.includes('từ xa')
  )
    return 'Online';
  if (locationStr && locationStr.trim().length > 0) return 'Offline';
  return null;
}

export function splitDescriptionAndRequirements(content: string): {
  description: string;
  requirements: string;
} {
  const lines = content.split('\n');
  const reqKeywords = [
    'yêu cầu',
    'tiêu chuẩn',
    'kỹ năng',
    'requirement',
    'qualification',
    'who you are',
    'what you bring',
    'what we look for',
    "what we're looking for",
    'skills',
    'experience',
  ];

  let reqStartIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase().trim();
    if (l.startsWith('#') || l.startsWith('**') || l.endsWith(':')) {
      if (reqKeywords.some((k) => l.includes(k))) {
        reqStartIndex = i;
        break;
      }
    }
  }

  if (reqStartIndex !== -1 && reqStartIndex > 0) {
    const descLines = lines.slice(0, reqStartIndex).join('\n').trim();
    const reqLines = lines.slice(reqStartIndex).join('\n').trim();
    return {
      description: descLines.startsWith('##')
        ? descLines
        : `## Mô tả công việc\n${descLines}`,
      requirements: reqLines.startsWith('##')
        ? reqLines
        : `## Yêu cầu ứng viên\n${reqLines}`,
    };
  }

  // Fallback if no explicit heading found
  return {
    description: `## Mô tả công việc\n${content}`,
    requirements: `## Yêu cầu ứng viên\n- Xem chi tiết tại đường dẫn tuyển dụng chính thức.`,
  };
}

export function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  for (const name of [...url.searchParams.keys()]) {
    if (name.startsWith('utm_') || name === 'apply' || name === 'trid') {
      url.searchParams.delete(name);
    }
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.toString();
}

// Deadline calculation per contract:
// Cutoff is 00:00 next day in Asia/Ho_Chi_Minh (+07:00), i.e. 86400000 ms after start of date.
export function computeDateCutoff(dateStr: string): {
  instantIso: string;
  valid: boolean;
} {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { instantIso: '', valid: false };
  }
  const cutoffMs = Date.parse(`${dateStr}T00:00:00+07:00`) + 86400000;
  if (
    !Number.isFinite(cutoffMs) ||
    new Date(dateStr + 'T00:00:00Z').toISOString().slice(0, 10) !== dateStr
  ) {
    return { instantIso: '', valid: false };
  }
  return { instantIso: new Date(cutoffMs).toISOString(), valid: true };
}

// Catalog Loading and Matching
export async function loadActiveCatalog(
  prisma?: PrismaClient,
): Promise<CatalogReference> {
  const majors = new Map<string, number | null>();
  const skills = new Map<string, number | null>();

  if (prisma) {
    try {
      const dbCats = await prisma.category.findMany({
        where: { status: 'Active' },
        select: { category_id: true, type: true, name: true },
      });
      for (const c of dbCats) {
        if (c.type === 'Major') majors.set(c.name, c.category_id);
        if (c.type === 'Skill') skills.set(c.name, c.category_id);
      }
      if (majors.size > 0 && skills.size > 0) {
        return { majors, skills };
      }
    } catch {
      // Fallback to static JSON catalog files
    }
  }

  // Fallback to repository catalog data files
  try {
    const majorsFile = resolve(
      fileURLToPath(import.meta.url),
      '../../../data/catalog/expanded-majors.json',
    );
    const skillsFile = resolve(
      fileURLToPath(import.meta.url),
      '../../../data/catalog/expanded-skills.json',
    );
    const majorsData: { name: string }[] = JSON.parse(
      await readFile(majorsFile, 'utf8'),
    );
    const skillsData: { name: string }[] = JSON.parse(
      await readFile(skillsFile, 'utf8'),
    );
    for (const m of majorsData) majors.set(m.name, null);
    for (const s of skillsData) skills.set(s.name, null);
  } catch {
    // If not found, leave maps empty
  }

  return { majors, skills };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchMajorsAndSkills(
  title: string,
  content: string,
  catalog: CatalogReference,
): { matchedMajors: string[]; matchedSkills: string[] } {
  const text = `${title} ${content}`.toLowerCase();
  const matchedMajors: string[] = [];
  const matchedSkills: string[] = [];

  // Match majors
  for (const majorName of catalog.majors.keys()) {
    const lower = majorName.toLowerCase();
    if (text.includes(lower)) {
      matchedMajors.push(majorName);
    }
  }

  // Match skills
  for (const skillName of catalog.skills.keys()) {
    const lower = skillName.toLowerCase();
    if (lower.length === 1) {
      // Single letter skills like "C" or "R" require explicit programming/language context to prevent matching arbitrary letters
      const singleLetterReg = new RegExp(
        `(?:\\b(lập trình|ngôn ngữ|language|programming)\\s+${escapeRegex(lower)}\\b|\\b${escapeRegex(lower)}\\s+(?:programming|language)\\b|\\b${escapeRegex(lower)}\\/c\\+\\+\\b)`,
        'i',
      );
      if (singleLetterReg.test(text)) {
        matchedSkills.push(skillName);
      }
    } else if (lower.length <= 4) {
      const reg = new RegExp(
        `(^|[^a-zA-Z0-9_#+])${escapeRegex(lower)}($|[^a-zA-Z0-9_#+])`,
        'i',
      );
      if (reg.test(text)) matchedSkills.push(skillName);
    } else {
      if (text.includes(lower)) matchedSkills.push(skillName);
    }
  }

  return {
    matchedMajors: [...new Set(matchedMajors)],
    matchedSkills: [...new Set(matchedSkills)],
  };
}

// Conservative collection gates; ambiguous evidence stays in the review queue.
export function recruitmentReviewReason(item: RawExtractedItem): string | null {
  if (item.opportunityType === 'Học bổng') return null;
  const title = item.title.normalize('NFC').toLowerCase();
  const jd = item.requirements.normalize('NFC').toLowerCase();
  if (
    /\b(senior|sr\.?|lead|manager|principal|staff|director|head)\b/.test(title)
  )
    return 'SENIORITY_NOT_STUDENT_SUITABLE';
  if (
    !/\b(intern(?:ship)?|fresher|graduate|junior|entry[- ]level|trainee)\b|thực tập|mới tốt nghiệp/.test(
      title,
    )
  )
    return 'STUDENT_SUITABILITY_UNCONFIRMED';
  const experience = [
    ...jd.matchAll(
      /(\d+)\s*(?:\+|[-–]\s*\d+)?\s*(?:years?|năm)(?:\s+of)?\s*(?:experience|kinh nghiệm)/g,
    ),
  ];
  if (experience.some((m) => Math.max(Number(m[1]), Number(m[2] ?? 0)) > 2))
    return 'EXPERIENCE_NOT_STUDENT_SUITABLE';
  if (
    /\bjunior\b/.test(title) &&
    experience.length === 0 &&
    !/no (?:prior )?experience|không yêu cầu kinh nghiệm|new graduates?/.test(
      jd,
    )
  )
    return 'JUNIOR_REQUIREMENTS_UNCONFIRMED';
  const location = (item.location ?? '').normalize('NFC').toLowerCase();
  const vietnam =
    /vietnam|viet nam|việt nam|ho chi minh|hồ chí minh|hanoi|hà nội|da nang|đà nẵng/;
  // Restrictive residence/work authorization text overrides broad remote marketing.
  if (
    /(?:must|only|required|candidates).*?(?:reside|based|authorized to work|citizen).*?(?:united states|usa|\bus\b|europe|\beu\b|united kingdom|\buk\b)/.test(
      jd,
    )
  )
    return 'LOCATION_EXCLUDES_VIETNAM';
  if (vietnam.test(location)) return null;
  if (
    /\b(us|usa|uk|eu|europe|emea|americas)\b|united states|united kingdom/.test(
      location,
    )
  )
    return 'LOCATION_EXCLUDES_VIETNAM';
  if (
    (item.workFormat === 'Online' || /remote/.test(location)) &&
    /worldwide|global(?:ly)?|anywhere in the world|remote.*vietnam|remote.*viet nam/.test(
      location,
    )
  )
    return null;
  return 'VIETNAM_ELIGIBILITY_UNCONFIRMED';
}

export function determineAcademicYears(
  opportunityType: 'Thực tập' | 'Việc làm' | 'Học bổng',
  content: string,
): number[] {
  if (opportunityType === 'Học bổng') {
    // Per contract rule: Scholarships open across years use empty academic_years array
    return [];
  }
  const text = content.toLowerCase();
  if (
    text.includes('năm 3') ||
    text.includes('năm ba') ||
    text.includes('third year')
  ) {
    return [3, 4];
  }
  if (
    text.includes('năm 2') ||
    text.includes('năm hai') ||
    text.includes('second year')
  ) {
    return [2, 3, 4];
  }
  if (
    text.includes('năm cuối') ||
    text.includes('final-year') ||
    text.includes('sắp tốt nghiệp') ||
    opportunityType === 'Việc làm'
  ) {
    return [4];
  }
  // Default for university internships
  return [3, 4];
}

// Extraction Fetchers
export async function extractGreenhouse(
  boardToken: string,
  fetchFn = fetch,
): Promise<RawExtractedItem[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`;
  const res = await fetchFn(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    return [];
  }
  const data = (await res.json()) as {
    jobs?: Array<{
      id: number;
      title: string;
      absolute_url: string;
      location?: { name: string };
      content?: string;
      application_deadline?: string | null;
      updated_at?: string;
      status?: string;
    }>;
  };

  const results: RawExtractedItem[] = [];
  for (const j of data.jobs || []) {
    const cleanContent = htmlToCleanText(j.content || '');
    const { description, requirements } =
      splitDescriptionAndRequirements(cleanContent);
    const loc = j.location?.name?.trim() || null;
    const workFormat = detectWorkFormat(loc, cleanContent);
    const opportunityType = detectOpportunityType(j.title, cleanContent);

    // Format deadline date if provided
    let deadlineDate: string | null = null;
    if (
      j.application_deadline &&
      /^\d{4}-\d{2}-\d{2}/.test(j.application_deadline)
    ) {
      deadlineDate =
        j.application_deadline.length === 10
          ? j.application_deadline
          : 'INVALID_DATETIME_REQUIRES_REVIEW';
    }

    if (j.application_deadline && !deadlineDate)
      deadlineDate = 'INVALID_DEADLINE';
    results.push({
      sourceType: 'greenhouse',
      externalId: `GH-${boardToken}-${j.id}`,
      title: j.title.trim(),
      publisher: boardToken.charAt(0).toUpperCase() + boardToken.slice(1),
      sourceUrl: j.absolute_url,
      location: loc,
      workFormat,
      opportunityType,
      description,
      requirements,
      deadlineSourceDate: deadlineDate,
      // Successful public posting lists confirm publication; explicit closed states override it.
      sourceStatus:
        ('status' in j && j.status !== undefined && j.status !== 'open') ||
        ('state' in j && j.state !== undefined && j.state !== 'published')
          ? 'closed'
          : 'open',
      rawPayload: j,
    });
  }
  return results;
}

export async function extractLever(
  site: string,
  fetchFn = fetch,
): Promise<RawExtractedItem[]> {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`;
  const res = await fetchFn(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    return [];
  }
  const data = (await res.json()) as Array<{
    id: string;
    state?: string;
    text: string;
    hostedUrl: string;
    categories?: {
      location?: string;
      commitment?: string;
      team?: string;
    };
    descriptionPlain?: string;
    additionalPlain?: string;
    description?: string;
    lists?: Array<{ text: string; content: string }>;
  }>;

  const results: RawExtractedItem[] = [];
  for (const j of data || []) {
    let combinedContent = j.descriptionPlain || '';
    if (j.lists && j.lists.length > 0) {
      combinedContent +=
        '\n' +
        j.lists
          .map((l) => `## ${l.text}\n${htmlToCleanText(l.content)}`)
          .join('\n');
    }
    if (j.additionalPlain) {
      combinedContent += '\n' + j.additionalPlain;
    }

    const { description, requirements } =
      splitDescriptionAndRequirements(combinedContent);
    const loc = j.categories?.location?.trim() || null;
    const workFormat = detectWorkFormat(loc, combinedContent);
    const opportunityType = detectOpportunityType(j.text, combinedContent);

    // Lever usually leaves deadline unspecified in public JSON; extract if date appears in body
    let deadlineDate: string | null = null;
    const dlMatch = combinedContent.match(
      /(?:hạn nộp|deadline|closing date)[:\s]+(\d{4}-\d{2}-\d{2})/i,
    );
    if (dlMatch) {
      deadlineDate = dlMatch[1];
    } else if (/(?:h?n n?p|deadline|closing date)\s*:/i.test(combinedContent)) {
      deadlineDate = 'UNRESOLVED_DEADLINE';
    }

    results.push({
      sourceType: 'lever',
      externalId: `LEV-${site}-${j.id}`,
      title: j.text.trim(),
      publisher: site.charAt(0).toUpperCase() + site.slice(1),
      sourceUrl: j.hostedUrl,
      location: loc,
      workFormat,
      opportunityType,
      description,
      requirements,
      deadlineSourceDate: deadlineDate,
      // Successful public posting lists confirm publication; explicit closed states override it.
      sourceStatus:
        ('status' in j && j.status !== undefined && j.status !== 'open') ||
        ('state' in j && j.state !== undefined && j.state !== 'published')
          ? 'closed'
          : 'open',
      rawPayload: j,
    });
  }
  return results;
}

export function extractScholarships(
  sources: ScholarshipSourceDef[],
): RawExtractedItem[] {
  const results: RawExtractedItem[] = [];
  for (const s of sources) {
    results.push({
      sourceType: 'scholarship',
      externalId: `SCH-${s.name.replace(/\s+/g, '-').toLowerCase()}`,
      title: s.name,
      publisher: s.publisher,
      sourceUrl: s.url,
      location: 'Hà Nội & Hồ Chí Minh',
      workFormat: 'Offline',
      opportunityType: 'Học bổng',
      description: s.description,
      requirements: s.requirements,
      deadlineSourceDate: s.fixedDeadlineDate || null,
    });
  }
  return results;
}

// Processing & Deduplication Pipeline
export interface ProcessCollectorResult {
  stats: {
    totalExtracted: number;
    bySource: Record<string, number>;
    withDeadlineCount: number;
    validCandidatesCount: number;
    needsReviewCount: number;
  };
  importCandidatesBatch: ImportBatch;
  needsReviewRows: NeedsReviewRecord[];
}

export async function processCollectedOpportunities(
  rawItems: RawExtractedItem[],
  catalog: CatalogReference,
  existingDbOpportunities: Array<{
    item_id: number;
    source_url: string | null;
    publisher: string | null;
    title: string;
  }> = [],
  now = new Date(),
): Promise<ProcessCollectorResult> {
  const stats = {
    totalExtracted: rawItems.length,
    bySource: {} as Record<string, number>,
    withDeadlineCount: 0,
    validCandidatesCount: 0,
    needsReviewCount: 0,
  };

  const existingUrls = new Set(
    existingDbOpportunities
      .map((o) => (o.source_url ? normalizeUrl(o.source_url) : ''))
      .filter(Boolean),
  );
  const existingPubTitles = new Set(
    existingDbOpportunities
      .filter((o) => Boolean(o.publisher && o.title))
      .map(
        (o) =>
          `${(o.publisher || '').trim().toLowerCase()}::${o.title.trim().toLowerCase()}`,
      ),
  );

  const seenUrls = new Set<string>();
  const seenPubTitles = new Set<string>();

  const candidatesItems: ImportBatch['items'] = [];
  const proposedCategoriesMap = new Map<
    string,
    { type: 'Major' | 'Skill'; name: string }
  >();
  const proposedLinks: ImportBatch['initial_catalog_proposal']['opportunity_links'] =
    [];
  const needsReviewRows: NeedsReviewRecord[] = [];

  for (let idx = 0; idx < rawItems.length; idx++) {
    const item = rawItems[idx];
    const srcType = item.sourceType;
    stats.bySource[srcType] = (stats.bySource[srcType] || 0) + 1;

    const reviewId = `COL-${String(idx + 1).padStart(3, '0')}`;
    const pubTitleKey = `${item.publisher.trim().toLowerCase()}::${item.title.trim().toLowerCase()}`;

    let normUrl = '';
    try {
      normUrl = normalizeUrl(item.sourceUrl);
    } catch {
      needsReviewRows.push({
        reviewId,
        sourceType: item.sourceType,
        title: item.title,
        publisher: item.publisher,
        deadlineSourceDate: item.deadlineSourceDate,
        location: item.location,
        sourceUrl: item.sourceUrl,
        reviewStatus: 'NEEDS_REVIEW',
        reason: 'MALFORMED_SOURCE_URL',
      });
      stats.needsReviewCount++;
      continue;
    }

    // Deduplication check
    if (existingUrls.has(normUrl) || existingPubTitles.has(pubTitleKey)) {
      needsReviewRows.push({
        reviewId,
        sourceType: item.sourceType,
        title: item.title,
        publisher: item.publisher,
        deadlineSourceDate: item.deadlineSourceDate,
        location: item.location,
        sourceUrl: item.sourceUrl,
        reviewStatus: 'NEEDS_REVIEW',
        reason: 'DUPLICATE_EXISTING_DB',
      });
      stats.needsReviewCount++;
      continue;
    }

    if (seenUrls.has(normUrl) || seenPubTitles.has(pubTitleKey)) {
      needsReviewRows.push({
        reviewId,
        sourceType: item.sourceType,
        title: item.title,
        publisher: item.publisher,
        deadlineSourceDate: item.deadlineSourceDate,
        location: item.location,
        sourceUrl: item.sourceUrl,
        reviewStatus: 'NEEDS_REVIEW',
        reason: 'DUPLICATE_BATCH_INTERNAL',
      });
      stats.needsReviewCount++;
      continue;
    }
    seenUrls.add(normUrl);
    seenPubTitles.add(pubTitleKey);

    // Unknown source status never becomes an open-ended opportunity.
    const cutoff =
      item.deadlineSourceDate === null
        ? null
        : computeDateCutoff(item.deadlineSourceDate);
    const reason =
      item.sourceStatus !== 'open'
        ? 'SOURCE_NOT_CONFIRMED_OPEN'
        : cutoff &&
            (!cutoff.valid || Date.parse(cutoff.instantIso) <= now.getTime())
          ? 'EXPIRED_OR_INVALID_DEADLINE'
          : null;
    if (reason) {
      needsReviewRows.push({
        reviewId,
        sourceType: item.sourceType,
        title: item.title,
        publisher: item.publisher,
        deadlineSourceDate: item.deadlineSourceDate,
        location: item.location,
        sourceUrl: item.sourceUrl,
        reviewStatus: 'NEEDS_REVIEW',
        reason,
      });
      stats.needsReviewCount++;
      continue;
    }
    const instantIso = cutoff?.instantIso ?? null;
    if (cutoff) stats.withDeadlineCount++;

    // Content completeness
    if (
      !item.description ||
      !item.requirements ||
      item.description.length < 20 ||
      item.requirements.length < 20
    ) {
      needsReviewRows.push({
        reviewId,
        sourceType: item.sourceType,
        title: item.title,
        publisher: item.publisher,
        deadlineSourceDate: item.deadlineSourceDate,
        location: item.location,
        sourceUrl: item.sourceUrl,
        reviewStatus: 'NEEDS_REVIEW',
        reason: 'INSUFFICIENT_DESCRIPTION_OR_REQUIREMENTS',
      });
      stats.needsReviewCount++;
      continue;
    }

    // Category mapping
    const combinedText = `${item.title} ${item.description} ${item.requirements}`;
    const { matchedMajors, matchedSkills } = matchMajorsAndSkills(
      '',
      `${item.description} ${item.requirements}`,
      catalog,
    );

    const qualityReason =
      recruitmentReviewReason(item) ??
      (matchedMajors.length === 0
        ? 'NO_JD_MAJOR_MATCH'
        : matchedSkills.length === 0
          ? 'NO_JD_SKILL_MATCH'
          : null);
    if (qualityReason) {
      needsReviewRows.push({
        reviewId,
        sourceType: item.sourceType,
        title: item.title,
        publisher: item.publisher,
        deadlineSourceDate: item.deadlineSourceDate,
        location: item.location,
        sourceUrl: item.sourceUrl,
        reviewStatus: 'NEEDS_REVIEW',
        reason: qualityReason,
      });
      stats.needsReviewCount++;
      continue;
    }

    // Academic years assignment
    const academicYears = determineAcademicYears(
      item.opportunityType,
      combinedText,
    );

    // Build valid candidate item
    candidatesItems.push({
      review_id: reviewId,
      evidence: {
        source_status: item.sourceStatus,
        source_identity: {
          url_kind: 'detail',
          basis: `Thu thập tự động từ cổng tuyển dụng chính thức (${item.sourceType}: ${item.publisher})`,
        },
      },
      opportunity: {
        opportunity_type: item.opportunityType,
        title: item.title.slice(0, 255),
        publisher: item.publisher.slice(0, 255),
        description: item.description,
        requirements: item.requirements,
        source_url: item.sourceUrl.slice(0, 500),
        location: item.location ? item.location.slice(0, 100) : null,
        work_format: item.workFormat,
        deadline: instantIso,
        deadline_source_date: item.deadlineSourceDate,
        deadline_source_timezone: null,
        status: 'Pending',
        is_verified: false,
        reviewed_by: null,
        reviewed_at: null,
      },
      relations: {
        major_ids: [],
        skill_ids: [],
        academic_years: academicYears,
      },
    });

    for (const m of matchedMajors)
      proposedCategoriesMap.set(`Major:${m}`, { type: 'Major', name: m });
    for (const s of matchedSkills)
      proposedCategoriesMap.set(`Skill:${s}`, { type: 'Skill', name: s });

    proposedLinks.push({
      review_id: reviewId,
      major_names: matchedMajors,
      skill_names: matchedSkills,
      status: 'needs_review', // Requires explicit leader approval
    });

    stats.validCandidatesCount++;
  }

  const importCandidatesBatch: ImportBatch = {
    format_version: 2,
    items: candidatesItems,
    initial_catalog_proposal: {
      status: 'needs_review',
      categories: Array.from(proposedCategoriesMap.values()).map((c) => ({
        ...c,
        status: 'needs_review',
      })),
      opportunity_links: proposedLinks,
    },
  };

  return {
    stats,
    importCandidatesBatch,
    needsReviewRows,
  };
}

export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function formatNeedsReviewCsv(records: NeedsReviewRecord[]): string {
  const header =
    'review_id,source_type,title,publisher,deadline_source_date,location,source_url,review_status,rejection_or_review_reason';
  const lines = records.map((r) =>
    [
      escapeCsvField(r.reviewId),
      escapeCsvField(r.sourceType),
      escapeCsvField(r.title),
      escapeCsvField(r.publisher),
      escapeCsvField(r.deadlineSourceDate),
      escapeCsvField(r.location),
      escapeCsvField(r.sourceUrl),
      escapeCsvField(r.reviewStatus),
      escapeCsvField(r.reason),
    ].join(','),
  );
  return [header, ...lines].join('\n') + '\n';
}

// Main CLI Controller
export async function runCollector(args: string[] = process.argv.slice(2)) {
  const isOffline = args.includes('--offline');
  const outCandidatesArg = args.indexOf('--out-candidates');
  const outCandidates =
    outCandidatesArg !== -1
      ? args[outCandidatesArg + 1]
      : 'data/opportunities/import-candidates.json';

  const outReviewArg = args.indexOf('--out-review');
  const outReview =
    outReviewArg !== -1
      ? args[outReviewArg + 1]
      : 'data/opportunities/needs-review.csv';

  process.stdout.write(`=== UniHub Opportunities ETL Collector ===\n`);
  process.stdout.write(
    `Mode: ${isOffline ? 'OFFLINE (fixtures / catalog fallback)' : 'ONLINE (APIs & official sites)'}\n`,
  );

  let prisma: PrismaClient | undefined;
  let existingDbOpportunities: Array<{
    item_id: number;
    source_url: string | null;
    publisher: string | null;
    title: string;
  }> = [];

  try {
    prisma = getPrismaClient();
    existingDbOpportunities = await prisma.opportunity.findMany({
      select: { item_id: true, source_url: true, publisher: true, title: true },
    });
    process.stdout.write(
      `Connected to database: ${existingDbOpportunities.length} existing opportunities loaded for deduplication.\n`,
    );
  } catch {
    process.stdout.write(
      `Database not configured or offline; deduplication using internal cache.\n`,
    );
  }

  const catalog = await loadActiveCatalog(prisma);
  process.stdout.write(
    `Active catalog ready: ${catalog.majors.size} Majors, ${catalog.skills.size} Skills.\n`,
  );

  const rawItems: RawExtractedItem[] = [];

  if (!isOffline) {
    // 1. Greenhouse
    for (const board of DEFAULT_CONFIG.greenhouseBoards) {
      try {
        const ghJobs = await extractGreenhouse(board);
        process.stdout.write(
          `Greenhouse [${board}]: Extracted ${ghJobs.length} jobs.\n`,
        );
        rawItems.push(...ghJobs);
      } catch (err) {
        process.stdout.write(
          `Greenhouse [${board}] error: ${(err as Error).message}\n`,
        );
      }
    }

    // 2. Lever
    for (const site of DEFAULT_CONFIG.leverSites) {
      try {
        const levJobs = await extractLever(site);
        process.stdout.write(
          `Lever [${site}]: Extracted ${levJobs.length} jobs.\n`,
        );
        rawItems.push(...levJobs);
      } catch (err) {
        process.stdout.write(
          `Lever [${site}] error: ${(err as Error).message}\n`,
        );
      }
    }
  }

  // 3. Official Scholarships
  const scholarships = extractScholarships(DEFAULT_CONFIG.scholarshipSources);
  process.stdout.write(
    `Official Scholarships: Loaded ${scholarships.length} programs.\n`,
  );
  rawItems.push(...scholarships);

  // Process & Deduplicate
  const result = await processCollectedOpportunities(
    rawItems,
    catalog,
    existingDbOpportunities,
  );

  // Write outputs
  await mkdir('data/opportunities', { recursive: true });
  await writeFile(
    resolve(outCandidates),
    JSON.stringify(result.importCandidatesBatch, null, 2) + '\n',
    'utf8',
  );
  await writeFile(
    resolve(outReview),
    formatNeedsReviewCsv(result.needsReviewRows),
    'utf8',
  );

  // Also mirror at project root for convenience
  await writeFile(
    'import-candidates.json',
    JSON.stringify(result.importCandidatesBatch, null, 2) + '\n',
    'utf8',
  );
  await writeFile(
    'needs-review.csv',
    formatNeedsReviewCsv(result.needsReviewRows),
    'utf8',
  );

  process.stdout.write(`\n=== Extraction & Validation Summary ===\n`);
  process.stdout.write(`Total Extracted: ${result.stats.totalExtracted}\n`);
  for (const [src, cnt] of Object.entries(result.stats.bySource)) {
    process.stdout.write(` - ${src}: ${cnt}\n`);
  }
  process.stdout.write(
    `With Confirmed Future Deadline: ${result.stats.withDeadlineCount}\n`,
  );
  process.stdout.write(
    `Candidates Awaiting Leader Review: ${result.stats.validCandidatesCount}\n`,
  );
  process.stdout.write(
    `Needs Review / Discarded: ${result.stats.needsReviewCount}\n`,
  );
  process.stdout.write(`\nExported: ${outCandidates} & ${outReview}\n`);

  if (prisma) {
    await disconnectPrismaClient();
  }

  return result;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runCollector().catch((err) => {
    process.stderr.write(`Collector failed: ${err.message}\n`);
    process.exitCode = 1;
  });
}

export interface OfficialPageSource {
  item: RawExtractedItem;
  scopeStart: string;
  scopeEnd: string;
  requiredEvidence: string[];
  openEvidence: string;
}

// Explicitly reviewed pages only. Changed evidence fails closed for human review.
export async function extractOfficialSources(
  sources: OfficialPageSource[],
  fetchFn = fetch,
) {
  const items: RawExtractedItem[] = [];
  const needsReview: NeedsReviewRecord[] = [];
  const norm = (text: string) =>
    text.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
  for (const source of sources) {
    const item = source.item;
    let reason: string | null = null;
    try {
      const response = await fetchFn(item.sourceUrl, {
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
      });
      if (!response.ok) reason = 'SOURCE_HTTP_' + response.status;
      else {
        const text = htmlToCleanText(await response.text());
        const start = text.indexOf(source.scopeStart);
        const end = text.indexOf(
          source.scopeEnd,
          start + source.scopeStart.length,
        );
        const scope =
          start >= 0 && end > start ? norm(text.slice(start, end)) : '';
        if (
          !scope ||
          !source.requiredEvidence.every((e) => scope.includes(norm(e)))
        )
          reason = 'SOURCE_EVIDENCE_CHANGED';
        else if (scope.includes('application deadline closed'))
          reason = 'SOURCE_CLOSED';
        else if (
          !source.openEvidence ||
          !scope.includes(norm(source.openEvidence))
        )
          reason = 'SOURCE_OPEN_STATUS_UNCONFIRMED';
      }
    } catch {
      reason = 'SOURCE_FETCH_FAILED';
    }
    if (reason)
      needsReview.push({
        reviewId: item.externalId,
        sourceType: item.publisher,
        title: item.title,
        publisher: item.publisher,
        deadlineSourceDate: item.deadlineSourceDate,
        location: item.location,
        sourceUrl: item.sourceUrl,
        reviewStatus: 'NEEDS_REVIEW',
        reason,
      });
    else items.push({ ...item, sourceStatus: 'open' });
  }
  return { items, needsReview };
}
