import type { OpportunityType } from './contracts';

export interface OpportunityDetailSection {
  title: string;
  paragraphs: string[];
  majors: Array<{ id: number; name: string }>;
  skills: Array<{ id: number; name: string }>;
  academicYears: number[];
}

export interface OpportunityDetailContentInput {
  type: OpportunityType;
  descriptionText: string | null;
  requirementsText: string | null;
  majors: Array<{ id: number; name: string }>;
  skills: Array<{ id: number; name: string }>;
  eligibleAcademicYears: number[];
}

interface ParsedSection {
  title: string;
  paragraphs: string[];
  sourceIndex: number;
}

const headingsByType: Record<OpportunityType, string[]> = {
  'Thực tập': [
    'Mô tả thực tập',
    'Đối tượng thực tập',
    'Yêu cầu',
    'Quyền lợi và hỗ trợ',
  ],
  'Việc làm': [
    'Mô tả công việc',
    'Yêu cầu kinh nghiệm',
    'Yêu cầu ứng viên',
    'Quyền lợi và đãi ngộ',
  ],
  'Học bổng': [
    'Giới thiệu học bổng',
    'Đối tượng và điều kiện xét tuyển',
    'Giá trị học bổng',
    'Hồ sơ cần chuẩn bị',
    'Hướng dẫn đăng ký',
  ],
};

const fallbackHeadings: Record<
  OpportunityType,
  { description: string; requirements: string }
> = {
  'Thực tập': {
    description: 'Mô tả thực tập',
    requirements: 'Yêu cầu',
  },
  'Việc làm': {
    description: 'Mô tả công việc',
    requirements: 'Yêu cầu ứng viên',
  },
  'Học bổng': {
    description: 'Giới thiệu học bổng',
    requirements: 'Đối tượng và điều kiện xét tuyển',
  },
};

const targetHeading: Record<OpportunityType, string> = {
  'Thực tập': 'Đối tượng thực tập',
  'Việc làm': 'Yêu cầu ứng viên',
  'Học bổng': 'Đối tượng và điều kiện xét tuyển',
};

const requirementHeading: Record<OpportunityType, string> = {
  'Thực tập': 'Yêu cầu',
  'Việc làm': 'Yêu cầu ứng viên',
  'Học bổng': 'Đối tượng và điều kiện xét tuyển',
};

function normalizeHeading(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

function parseTextSections(
  text: string | null,
  fallbackTitle: string,
  firstIndex: number,
): ParsedSection[] {
  if (!text?.trim()) return [];

  const sections: ParsedSection[] = [];
  let title = fallbackTitle;
  let lines: string[] = [];
  let sourceIndex = firstIndex;

  const commit = () => {
    const paragraphs = lines
      .join('\n')
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
    if (paragraphs.length > 0) {
      sections.push({ title, paragraphs, sourceIndex });
      sourceIndex += 1;
    }
  };

  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = /^##(?!#)\s+(.+?)\s*$/.exec(line);
    if (heading) {
      commit();
      title = heading[1].trim();
      lines = [];
      continue;
    }
    lines.push(line);
  }
  commit();

  // Plain text without section markers remains under this field's type-specific
  // fallback heading rather than being dropped.
  return sections;
}

export function buildOpportunityDetailSections({
  type,
  descriptionText,
  requirementsText,
  majors,
  skills,
  eligibleAcademicYears,
}: OpportunityDetailContentInput): OpportunityDetailSection[] {
  const preferredHeadings = headingsByType[type];
  const canonicalByKey = new Map(
    preferredHeadings.map((heading) => [normalizeHeading(heading), heading]),
  );
  const parsed = [
    ...parseTextSections(
      descriptionText,
      fallbackHeadings[type].description,
      0,
    ),
    ...parseTextSections(
      requirementsText,
      fallbackHeadings[type].requirements,
      100,
    ),
  ];

  const collected = new Map<
    string,
    OpportunityDetailSection & { sourceIndex: number }
  >();

  for (const section of parsed) {
    const title =
      canonicalByKey.get(normalizeHeading(section.title)) ?? section.title;
    const key = normalizeHeading(title);
    const existing = collected.get(key);
    if (existing) {
      existing.paragraphs.push(...section.paragraphs);
      existing.sourceIndex = Math.min(
        existing.sourceIndex,
        section.sourceIndex,
      );
    } else {
      collected.set(key, {
        title,
        paragraphs: [...section.paragraphs],
        majors: [],
        skills: [],
        academicYears: [],
        sourceIndex: section.sourceIndex,
      });
    }
  }

  const ensureSection = (title: string) => {
    const key = normalizeHeading(title);
    let section = collected.get(key);
    if (!section) {
      section = {
        title,
        paragraphs: [],
        majors: [],
        skills: [],
        academicYears: [],
        sourceIndex: 200,
      };
      collected.set(key, section);
    }
    return section;
  };

  if (majors.length > 0 || eligibleAcademicYears.length > 0) {
    const target = ensureSection(targetHeading[type]);
    target.majors = majors;
    target.academicYears = eligibleAcademicYears;
  }
  if (skills.length > 0)
    ensureSection(requirementHeading[type]).skills = skills;

  return [...collected.values()]
    .filter(
      (section) =>
        section.paragraphs.length > 0 ||
        section.majors.length > 0 ||
        section.skills.length > 0 ||
        section.academicYears.length > 0,
    )
    .sort((left, right) => {
      const leftOrder = preferredHeadings.findIndex(
        (heading) => normalizeHeading(heading) === normalizeHeading(left.title),
      );
      const rightOrder = preferredHeadings.findIndex(
        (heading) =>
          normalizeHeading(heading) === normalizeHeading(right.title),
      );
      const leftRank = leftOrder < 0 ? Number.MAX_SAFE_INTEGER : leftOrder;
      const rightRank = rightOrder < 0 ? Number.MAX_SAFE_INTEGER : rightOrder;
      return leftRank - rightRank || left.sourceIndex - right.sourceIndex;
    })
    .map(({ sourceIndex: _sourceIndex, ...section }) => section);
}

export function safeOpportunityReturnTo(value: unknown): string {
  const fallback = '/opportunities';
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    value !== value.trim()
  ) {
    return fallback;
  }

  try {
    const url = new URL(value, 'https://unihub.invalid');
    if (
      url.origin !== 'https://unihub.invalid' ||
      url.pathname !== '/opportunities' ||
      url.hash
    ) {
      return fallback;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
