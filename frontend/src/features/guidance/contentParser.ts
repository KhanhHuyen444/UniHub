/**
 * contentParser.ts
 * Parser tất định (deterministic parser) chuyển đổi văn bản plain text có cấu trúc
 * thành các Section và Block React type-safe, không phụ thuộc HTML renderer độc hại.
 */

export interface PhaseCard {
  title: string;
  tag?: string;
  items: string[];
}

export interface CareerRole {
  role: string;
  description: string;
}

export interface ContentSection {
  id: string;
  title: string;
  leadParagraph?: string;
  paragraphs: string[];
  careerRoles?: CareerRole[];
  phaseCards?: PhaseCard[];
  bulletItems?: string[];
  skillTags?: string[];
}

export interface ParsedGuidanceContent {
  summaryLead?: string;
  sections: ContentSection[];
  isStructured: boolean;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Phân tích chuỗi descriptionText và requirementsText thành các khối nội dung có cấu trúc.
 */
export function parseGuidanceContent(
  descriptionText: string | null | undefined,
  requirementsText: string | null | undefined,
): ParsedGuidanceContent {
  const rawDesc = (descriptionText ?? '').trim();
  const rawReq = (requirementsText ?? '').trim();

  if (!rawDesc) {
    return {
      sections: [],
      isStructured: false,
    };
  }

  // Kiểm tra nếu nội dung có các section đánh dấu bằng "## "
  const hasHeadingMarkers =
    rawDesc.includes('\n## ') || rawDesc.startsWith('## ');

  if (!hasHeadingMarkers) {
    // Fallback: Xử lý dạng văn bản thường
    const paragraphs = rawDesc
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    const summaryLead = paragraphs.length > 1 ? paragraphs[0] : undefined;
    const bodyParagraphs = summaryLead ? paragraphs.slice(1) : paragraphs;

    const fallbackSections: ContentSection[] = [
      {
        id: 'tong-quan',
        title: 'Nội dung định hướng',
        paragraphs: bodyParagraphs,
      },
    ];

    if (rawReq) {
      fallbackSections.push({
        id: 'yeu-cau',
        title: 'Điều kiện tiên quyết & Chuẩn bị',
        paragraphs: rawReq
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean),
      });
    }

    return {
      summaryLead,
      sections: fallbackSections,
      isStructured: false,
    };
  }

  // Xử lý nội dung có cấu trúc "## "
  const rawSections = rawDesc
    .split(/(?=\n## |^## )/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const parsedSections: ContentSection[] = [];
  let summaryLead: string | undefined;

  let startIndex = 0;
  if (rawSections.length > 0 && !rawSections[0].startsWith('## ')) {
    summaryLead = rawSections[0];
    startIndex = 1;
  }

  for (let i = startIndex; i < rawSections.length; i++) {
    const rawSec = rawSections[i];
    const lines = rawSec.split('\n').map((l) => l.trim());
    const headerLine = lines[0].replace(/^##\s+/, '').trim();

    // Loại bỏ số thứ tự ở đầu tiêu đề nếu có (ví dụ "1. Tổng quan" -> "Tổng quan")
    const cleanTitle = headerLine.replace(/^\d+[\.\)]\s*/, '').trim();
    const sectionId = slugify(cleanTitle) || `section-${i + 1}`;

    const contentLines = lines.slice(1).join('\n').trim();

    // Tách các đoạn hoặc khối con "### "
    const paragraphs: string[] = [];
    const careerRoles: CareerRole[] = [];
    const phaseCards: PhaseCard[] = [];
    const bulletItems: string[] = [];

    // Kiểm tra có các khối con "### "
    if (contentLines.includes('### ')) {
      const parts = contentLines
        .split(/(?=\n### |^### )/g)
        .map((p) => p.trim())
        .filter(Boolean);
      for (const part of parts) {
        if (part.startsWith('### ')) {
          const subLines = part
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);
          const subHeader = subLines[0].replace(/^###\s+/, '').trim();

          // Trích xuất tag ví dụ: "### Giai đoạn 1: Xây dựng nền tảng [Khởi đầu]"
          const tagMatch = subHeader.match(/\[(.*?)\]$/);
          const phaseTag = tagMatch ? tagMatch[1].trim() : undefined;
          const phaseTitle = tagMatch
            ? subHeader.replace(/\[(.*?)\]$/, '').trim()
            : subHeader;

          const items: string[] = [];
          for (const line of subLines.slice(1)) {
            if (
              line.startsWith('- ') ||
              line.startsWith('* ') ||
              line.startsWith('• ')
            ) {
              items.push(line.replace(/^[-*•]\s+/, '').trim());
            } else {
              items.push(line);
            }
          }

          phaseCards.push({
            title: phaseTitle,
            tag: phaseTag,
            items,
          });
        } else {
          // Đoạn text dẫn đầu trước các khối con
          const leadingParas = part
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean);
          for (const p of leadingParas) {
            paragraphs.push(p);
          }
        }
      }
    } else {
      // Phân tích các đoạn thông thường
      const paras = contentLines
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);
      for (const para of paras) {
        const linesInPara = para
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        const tempRoles: CareerRole[] = [];
        const tempBullets: string[] = [];
        const nonBulletLines: string[] = [];

        const isCareerBlock =
          cleanTitle.toLowerCase().includes('nghề nghiệp') ||
          (cleanTitle.toLowerCase().includes('tổng quan') &&
            (para.toLowerCase().includes('nghề nghiệp') ||
              para.toLowerCase().includes('vị trí') ||
              para.toLowerCase().includes('vai trò')));

        for (const line of linesInPara) {
          if (isCareerBlock) {
            const roleMatch = line.match(
              /^[-*•]\s*([A-Za-zÀ-ỹ0-9\s/().,&-]+?):\s*(.+)$/,
            );
            if (roleMatch && roleMatch[1].length < 80) {
              tempRoles.push({
                role: roleMatch[1].trim(),
                description: roleMatch[2].trim(),
              });
              continue;
            }
          }

          if (
            line.startsWith('- ') ||
            line.startsWith('* ') ||
            line.startsWith('• ')
          ) {
            tempBullets.push(line.replace(/^[-*•]\s+/, '').trim());
          } else {
            nonBulletLines.push(line);
          }
        }

        if (tempRoles.length > 0) {
          careerRoles.push(...tempRoles);
        }
        if (tempBullets.length > 0) {
          bulletItems.push(...tempBullets);
        }
        if (nonBulletLines.length > 0) {
          paragraphs.push(nonBulletLines.join('\n'));
        }
      }
    }

    // Nếu là section đầu tiên (Tổng quan), lấy đoạn đầu tiên làm lead paragraph nếu phù hợp
    if (i === 0 && paragraphs.length > 0 && !summaryLead) {
      summaryLead = paragraphs[0];
    }

    parsedSections.push({
      id: sectionId,
      title: cleanTitle,
      paragraphs,
      careerRoles: careerRoles.length > 0 ? careerRoles : undefined,
      phaseCards: phaseCards.length > 0 ? phaseCards : undefined,
      bulletItems: bulletItems.length > 0 ? bulletItems : undefined,
    });
  }

  // Thêm section Yêu cầu nếu có requirementsText
  if (rawReq) {
    const reqLines = rawReq
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const reqBullets: string[] = [];
    const reqParas: string[] = [];

    for (const l of reqLines) {
      if (l.startsWith('- ') || l.startsWith('* ') || l.startsWith('• ')) {
        reqBullets.push(l.replace(/^[-*•]\s+/, '').trim());
      } else if (!l.startsWith('## ')) {
        reqParas.push(l);
      }
    }

    parsedSections.push({
      id: 'dieu-kien-tien-quyet',
      title: 'Điều kiện tiên quyết & Chuẩn bị',
      paragraphs: reqParas,
      bulletItems: reqBullets.length > 0 ? reqBullets : undefined,
    });
  }

  return {
    summaryLead,
    sections: parsedSections,
    isStructured: true,
  };
}
