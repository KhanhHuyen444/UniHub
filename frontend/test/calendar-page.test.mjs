import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chromium,
  startCalendarHarness,
} from '../test-support/calendar-browser.mjs';

test(
  'Calendar browser: create/edit changed-only/complete/delete, validation, errors/retry, empty and session switch',
  { skip: !chromium && 'Playwright runner is unavailable.' },
  async () => {
    const h = await startCalendarHarness();
    try {
      const page = await h.browser.newPage({
        viewport: { width: 1280, height: 1000 },
      });
      await page.goto(h.base + '/calendar-test');
      await page
        .getByText('Nộp bài tập lớn Lập trình web', { exact: true })
        .waitFor();
      const today = new Date(Date.now() + 7 * 3600000)
        .toISOString()
        .slice(0, 10);
      await page
        .getByRole('button', {
          name: `${today.split('-').reverse().join('/')}, 1 sự kiện`,
          exact: true,
        })
        .waitFor();
      // Keep detail loading while changing context; its stale response must not open a dialog.
      let releaseDetail;
      const detailPending = new Promise((resolve) => {
        releaseDetail = resolve;
      });
      let detailStarted;
      const started = new Promise((resolve) => {
        detailStarted = resolve;
      });
      await page.route('**/api/events/1', async (route) => {
        detailStarted();
        await detailPending;
        await route.continue();
      });
      await page
        .getByRole('button', {
          name: 'Sửa: Nộp bài tập lớn Lập trình web',
          exact: true,
        })
        .click();
      await started;
      assert.equal(
        await page
          .getByRole('button', { name: '＋ Thêm sự kiện mới', exact: true })
          .isDisabled(),
        true,
      );
      await page
        .getByRole('button', { name: 'Tháng sau', exact: true })
        .click();
      releaseDetail();
      await page
        .getByRole('button', { name: '＋ Thêm sự kiện mới', exact: true })
        .waitFor();
      await page.waitForFunction(
        () =>
          !Array.from(document.querySelectorAll('button')).find((b) =>
            b.textContent.includes('Thêm sự kiện mới'),
          )?.disabled,
      );
      assert.equal(await page.getByRole('dialog').count(), 0);
      await page.unroute('**/api/events/1');
      await page.getByRole('button', { name: 'Hôm nay', exact: true }).click();
      await page
        .getByRole('button', {
          name: 'Sửa: Nộp bài tập lớn Lập trình web',
          exact: true,
        })
        .waitFor();
      await page
        .getByRole('button', { name: '＋ Thêm sự kiện mới', exact: true })
        .click();
      await page.getByRole('button', { name: '✓ Lưu', exact: true }).click();
      await page
        .getByText('Tiêu đề phải từ 1 đến 255 ký tự.', { exact: true })
        .waitFor();
      await page.getByLabel('Tiêu đề').fill('Calendar browser event');
      await page.getByLabel('Hạn chót').fill('2099-11-05');
      await page.getByRole('button', { name: '✓ Lưu', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      assert.ok(
        h.requests.some(
          (r) =>
            r.method === 'POST' &&
            r.path === '/api/events' &&
            r.body.title === 'Calendar browser event',
        ),
      );
      await page
        .getByRole('button', {
          name: 'Sửa: Nộp bài tập lớn Lập trình web',
          exact: true,
        })
        .click();
      await page.getByLabel('Ghi chú', { exact: true }).fill('Changed note');
      h.setFailure(true);
      await page.getByRole('button', { name: '✓ Lưu', exact: true }).click();
      await page
        .getByRole('alert')
        .filter({ hasText: 'Không thể lưu sự kiện' })
        .waitFor();
      assert.equal(
        await page.getByLabel('Ghi chú', { exact: true }).inputValue(),
        'Changed note',
      );
      h.setFailure(false);
      await page.getByRole('button', { name: '✓ Lưu', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      assert.deepEqual(h.requests.findLast((r) => r.method === 'PATCH').body, {
        notes: 'Changed note',
      });
      await page
        .getByRole('checkbox', {
          name: 'Hoàn thành: Nộp bài tập lớn Lập trình web',
          exact: true,
        })
        .check();
      await page.getByText('Đã hoàn thành sự kiện.', { exact: true }).waitFor();
      await page
        .getByRole('button', {
          name: 'Xóa: Nộp bài tập lớn Lập trình web',
          exact: true,
        })
        .click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Xóa', exact: true })
        .click();
      await page.getByText('Đã xóa sự kiện.', { exact: true }).waitFor();
      h.setEmpty();
      await page.reload();
      await page
        .getByText('Bạn chưa có sự kiện nào', { exact: true })
        .waitFor();
      h.setFailure(true);
      await page.reload();
      await page.getByText('Không tải được lịch', { exact: true }).waitFor();
      h.setFailure(false);
      await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
      await page
        .getByText('Bạn chưa có sự kiện nào', { exact: true })
        .waitFor();
      await page
        .getByRole('button', { name: '＋ Thêm sự kiện mới', exact: true })
        .first()
        .click();
      await page.evaluate(() =>
        window.calendarTest.setAuthenticated('other-test-token', {
          id: 2,
          role: 'Student',
          fullName: 'Other test Student',
          email: 'other@test.invalid',
          avatarUrl: null,
        }),
      );
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.evaluate(() => window.calendarTest.setGuest());
      await page
        .getByRole('heading', { name: 'Lịch & Deadline', exact: true })
        .waitFor({ state: 'hidden' });
    } finally {
      await h.close();
    }
  },
);
