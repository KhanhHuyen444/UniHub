import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseGuidanceContent } from '../src/features/guidance/contentParser.ts';

describe('Guidance Content Parser Tests', () => {
  test('Phân tích văn bản có cấu trúc chuẩn thành các Sections, CareerRoles và PhaseCards', () => {
    const desc = `
## 1. Tổng quan
Phát triển phần mềm là ngành then chốt trong kỷ nguyên số.
Ngành yêu cầu nền tảng toán học và kỹ thuật lập trình vững chắc.

Các hướng nghề nghiệp phổ biến:
- Frontend Engineer: Phát triển giao diện web với React và TypeScript.
- Backend Engineer: Xây dựng hệ thống máy chủ và RESTful API với Node.js.

## 2. Kế hoạch học tập & Thực hành
### Giai đoạn 1: Nền tảng lập trình [Khởi đầu]
- Làm quen cú pháp TypeScript.
- Thực hành viết 30 thuật toán cơ bản.

### Giai đoạn 2: Phát triển ứng dụng Web [Tăng tốc]
- Xây dựng REST API với Express.
- Thiết kế cơ sở dữ liệu quan hệ với PostgreSQL.

## 3. Sản phẩm đầu ra & Minh chứng năng lực
- Dự án 1: Một ứng dụng Todo List có xác thực JWT.
- Dự án 2: Kho lưu trữ mã nguồn mở trên GitHub có tài liệu README.

## 4. Bước tiếp theo
Sinh viên nên tích cực tìm kiếm cơ hội thực tập sớm tại các doanh nghiệp.
    `;

    const req = `
- Kiến thức toán giải tích cơ bản.
- Máy tính cá nhân có thể cài đặt Node.js và Git.
    `;

    const result = parseGuidanceContent(desc, req);

    assert.equal(result.isStructured, true);
    assert.ok(
      result.summaryLead?.includes(
        'Phát triển phần mềm là ngành then chốt trong kỷ nguyên số.',
      ),
    );
    assert.equal(result.sections.length, 5); // 4 from desc + 1 from req

    // Section 1: Tổng quan
    const s1 = result.sections[0];
    assert.equal(s1.title, 'Tổng quan');
    assert.equal(s1.id, 'tong-quan');
    assert.ok(s1.careerRoles);
    assert.equal(s1.careerRoles.length, 2);
    assert.equal(s1.careerRoles[0].role, 'Frontend Engineer');
    assert.equal(s1.careerRoles[1].role, 'Backend Engineer');

    // Section 2: Kế hoạch học tập
    const s2 = result.sections[1];
    assert.equal(s2.title, 'Kế hoạch học tập & Thực hành');
    assert.ok(s2.phaseCards);
    assert.equal(s2.phaseCards.length, 2);
    assert.equal(s2.phaseCards[0].title, 'Giai đoạn 1: Nền tảng lập trình');
    assert.equal(s2.phaseCards[0].tag, 'Khởi đầu');
    assert.equal(s2.phaseCards[0].items.length, 2);
    assert.equal(s2.phaseCards[1].tag, 'Tăng tốc');

    // Section 3: Sản phẩm đầu ra
    const s3 = result.sections[2];
    assert.equal(s3.title, 'Sản phẩm đầu ra & Minh chứng năng lực');
    assert.ok(s3.bulletItems);
    assert.equal(s3.bulletItems.length, 2);

    // Section 5: Điều kiện tiên quyết (từ req)
    const s5 = result.sections[4];
    assert.equal(s5.title, 'Điều kiện tiên quyết & Chuẩn bị');
    assert.ok(s5.bulletItems);
    assert.equal(s5.bulletItems.length, 2);
  });

  test('Fallback an toàn cho văn bản thuần túy không có ký hiệu markdown', () => {
    const raw = 'Đây là đoạn văn bản thứ nhất.\n\nĐây là đoạn văn bản thứ hai.';
    const req = '- Yêu cầu 1\n- Yêu cầu 2';

    const result = parseGuidanceContent(raw, req);

    assert.equal(result.isStructured, false);
    assert.equal(result.summaryLead, 'Đây là đoạn văn bản thứ nhất.');
    assert.equal(result.sections.length, 2);
    assert.equal(result.sections[0].title, 'Nội dung định hướng');
    assert.equal(
      result.sections[0].paragraphs[0],
      'Đây là đoạn văn bản thứ hai.',
    );
    assert.equal(result.sections[1].title, 'Điều kiện tiên quyết & Chuẩn bị');
  });

  test('Xử lý an toàn chuỗi null, undefined hoặc rỗng', () => {
    const r1 = parseGuidanceContent(null, null);
    assert.equal(r1.sections.length, 0);
    assert.equal(r1.isStructured, false);

    const r2 = parseGuidanceContent('', undefined);
    assert.equal(r2.sections.length, 0);
    assert.equal(r2.isStructured, false);
  });

  test('Phân tích văn bản có summary lead nằm trước các thẻ ##', () => {
    const desc = `
Hướng dẫn từng bước xây dựng nền tảng tư duy và công nghệ web từ những ngày đầu bước chân vào giảng đường.

## 1. Tổng quan
Ngành Công nghệ thông tin có nhiều cơ hội phát triển.

## 2. Bước tiếp theo
Chủ động tìm kiếm các dự án thực tập.
    `;
    const result = parseGuidanceContent(desc, '');
    assert.equal(result.isStructured, true);
    assert.equal(
      result.summaryLead,
      'Hướng dẫn từng bước xây dựng nền tảng tư duy và công nghệ web từ những ngày đầu bước chân vào giảng đường.',
    );
    assert.equal(result.sections.length, 2);
    assert.equal(result.sections[0].title, 'Tổng quan');
    assert.equal(result.sections[1].title, 'Bước tiếp theo');
  });

  test('Bảo đảm nội dung chứa ký tự đặc biệt hoặc thẻ HTML không bị thực thi', () => {
    const malicious =
      '<script>alert("hack")</script>\n\n<img src=x onerror=alert(1)>';
    const result = parseGuidanceContent(malicious, '');

    // Parser chỉ lưu trữ chuỗi thô, không thực thi HTML
    assert.ok(
      result.sections[0].paragraphs[0].includes(
        '<img src=x onerror=alert(1)>',
      ) || result.summaryLead?.includes('<script>'),
    );
  });
});
