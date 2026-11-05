/**
 * guidance-demo.test.mjs
 * Kiểm thử tính toàn vẹn của dữ liệu Fixture Guidance Demo.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateAndLoadGuidanceFixture } from './generate-guidance-demo.mjs';

describe('Guidance Demo Fixture Integrity Tests', () => {
  test('Fixture chứa chính xác 146 bài viết định hướng hợp lệ', async () => {
    const { items, stats } = await validateAndLoadGuidanceFixture();

    assert.equal(items.length, 146);
    assert.equal(stats.totalArticles, 146);
    assert.equal(stats.coveredMajorsCount, 100);
    assert.equal(stats.emptyMajorsCount, 17);
    assert.equal(stats.academicYearCounts[1], 45);
    assert.equal(stats.academicYearCounts[2], 45);
    assert.equal(stats.academicYearCounts[3], 28);
    assert.equal(stats.academicYearCounts[4], 28);
  });

  test('Tất cả bài viết đều tuân thủ Business Contract UC-03', async () => {
    const { items } = await validateAndLoadGuidanceFixture();

    for (const item of items) {
      assert.equal(item.opportunity_type, 'Bài viết định hướng');
      assert.equal(item.status, 'Approved');
      assert.equal(item.publisher, 'UniHub Ban Cố vấn Học tập & Hướng nghiệp');
      assert.equal(item.is_verified, false);
      assert.ok(item.title.length >= 10, `Title too short: ${item.title}`);
      assert.ok(
        item.description.length >= 100,
        `Description too short: ${item.fixture_key}`,
      );
      assert.ok(
        item.requirements.length >= 20,
        `Requirements too short: ${item.fixture_key}`,
      );
      assert.ok(
        item.majors.length >= 1,
        `Must have at least 1 major: ${item.fixture_key}`,
      );
      assert.ok(
        item.skills.length >= 2,
        `Must have at least 2 skills: ${item.fixture_key}`,
      );
      assert.ok(
        item.academic_years.length >= 1,
        `Must have at least 1 year: ${item.fixture_key}`,
      );

      // Định dạng plain text, không HTML, không markdown heading
      assert.equal(
        /<[^>]*>/g.test(item.description),
        false,
        `HTML found in desc of ${item.fixture_key}`,
      );
      assert.equal(
        /<[^>]*>/g.test(item.requirements),
        false,
        `HTML found in req of ${item.fixture_key}`,
      );
      assert.equal(
        item.description.trim().startsWith('#'),
        false,
        `Markdown header in ${item.fixture_key}`,
      );
    }
  });

  test('28 Core Majors có đủ 4 giai đoạn năm học (Years 1 - 4)', async () => {
    const { items } = await validateAndLoadGuidanceFixture();

    const CORE_28_MAJORS = [
      'Công nghệ thông tin',
      'Khoa học máy tính',
      'Kỹ thuật phần mềm',
      'Hệ thống thông tin',
      'Khoa học dữ liệu',
      'Trí tuệ nhân tạo',
      'An toàn thông tin',
      'Thương mại điện tử',
      'Quản trị kinh doanh',
      'Marketing',
      'Kế toán',
      'Tài chính - Ngân hàng',
      'Công nghệ tài chính',
      'Kinh doanh quốc tế',
      'Logistics và Quản lý chuỗi cung ứng',
      'Luật kinh tế',
      'Ngôn ngữ Anh',
      'Quan hệ quốc tế',
      'Truyền thông đa phương tiện',
      'Tâm lý học',
      'Kỹ thuật điện',
      'Kỹ thuật điều khiển và tự động hóa',
      'Kỹ thuật cơ điện tử',
      'Kỹ thuật xây dựng',
      'Toán ứng dụng',
      'Công nghệ sinh học',
      'Công nghệ thực phẩm',
      'Thiết kế đồ họa',
    ];

    for (const major of CORE_28_MAJORS) {
      const majorArticles = items.filter(
        (i) => i.majors.length === 1 && i.majors[0] === major,
      );
      assert.equal(
        majorArticles.length,
        4,
        `Core major "${major}" must have exactly 4 stages, found: ${majorArticles.length}`,
      );

      const years = majorArticles.map((a) => a.academic_years[0]).sort();
      assert.deepEqual(
        years,
        [1, 2, 3, 4],
        `Core major "${major}" must span years 1, 2, 3, 4`,
      );
    }
  });

  test('17 Cụm ngành bao phủ 72 majors với giai đoạn năm 1 và năm 2', async () => {
    const { items } = await validateAndLoadGuidanceFixture();

    const clusterArticles = items.filter(
      (i) => i.majors.length > 1 || i.fixture_key.includes('cluster-law'),
    );
    assert.equal(
      clusterArticles.length,
      34,
      `Expected 34 cluster articles (17 clusters x 2 stages), got: ${clusterArticles.length}`,
    );

    const clusterMajors = new Set();
    for (const ca of clusterArticles) {
      for (const m of ca.majors) {
        clusterMajors.add(m);
      }
      assert.ok(
        [1, 2].includes(ca.academic_years[0]),
        `Cluster article year must be 1 or 2, got: ${ca.academic_years}`,
      );
    }

    assert.equal(
      clusterMajors.size,
      72,
      `Expected 72 unique cluster majors, got: ${clusterMajors.size}`,
    );
  });

  test('17 Chuyên ngành Empty State được bảo toàn chính xác', async () => {
    const { stats } = await validateAndLoadGuidanceFixture();

    const EXPECTED_EMPTY_MAJORS = [
      'Hải dương học',
      'Địa chất học',
      'Địa lý tự nhiên',
      'Y học cổ truyền',
      'Răng - Hàm - Mặt',
      'Thiết kế thời trang',
      'Thiết kế nội thất',
      'Thú y',
      'Nuôi trồng thủy sản',
      'Bất động sản',
      'Quản lý công',
      'Thông tin - Thư viện',
      'Quản lý thông tin',
      'Du lịch học',
      'Văn học',
      'Lịch sử',
      'Triết học',
    ];

    assert.equal(stats.emptyMajorsCount, 17);
    for (const m of EXPECTED_EMPTY_MAJORS) {
      assert.ok(
        stats.emptyMajors.includes(m),
        `Expected empty major "${m}" was not in emptyMajors`,
      );
    }
  });
});
