import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  chromium,
  startHubBrowser,
  hubFixture,
  hubItems,
} from '../test-support/opportunity-hub-browser.mjs';

let harness;
const options = { skip: !chromium && 'Playwright runner is unavailable.' };
before(async () => {
  if (chromium) harness = await startHubBrowser();
});
after(async () => {
  await harness?.close();
});
const filtered =
  '/opportunities?type=Th%E1%BB%B1c+t%E1%BA%ADp&majorId=1&pageSize=6';
const cards = (page) =>
  page
    .getByRole('region', { name: 'Kết quả cơ hội', exact: true })
    .locator('article');

test(
  'Skills on cards: empty/legacy omission, linked Closed, long names and plain text without detail fan-out',
  options,
  async () => {
    await hubFixture(harness, async ({ page, state, calls, errors }) => {
      state.items = hubItems.map((item) => ({ ...item }));
      const literal = '<img src=x onerror="window.skillInjected=true">';
      state.items[0].skills = [{ id: 99, name: literal }];
      state.items[1].skills = [];
      state.items[2].skills = [{ id: 100, name: 'S'.repeat(100) }];
      state.items[3].skills = [{ id: 101, name: 'Kỹ năng Closed đã liên kết' }];
      delete state.items[4].skills;
      for (const width of [1440, 1024, 390, 375]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(harness.base + filtered);
        await cards(page).first().waitFor();
        await cards(page).first().getByText(literal, { exact: true }).waitFor();
        assert.equal(
          await cards(page)
            .nth(1)
            .getByText('Kỹ năng:', { exact: true })
            .count(),
          0,
        );
        await cards(page)
          .nth(2)
          .getByText('S'.repeat(100), { exact: true })
          .waitFor();
        await cards(page)
          .nth(3)
          .getByText('Kỹ năng Closed đã liên kết', { exact: true })
          .waitFor();
        assert.equal(
          await cards(page)
            .nth(4)
            .getByText('Kỹ năng:', { exact: true })
            .count(),
          0,
        );
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        assert.equal(
          await page.evaluate(() => window.skillInjected),
          undefined,
        );
        assert.equal(await page.locator('img[src="x"]').count(), 0);
      }
      assert.equal(
        calls.filter((path) => /^\/api\/opportunities\/\d/.test(path)).length,
        0,
      );
      assert.deepEqual(errors, []);
    });
  },
);

test(
  'Hub V2 layout: 1440, 1024, 390, 375; real CSS, no document overflow, screenshots',
  options,
  async () => {
    await hubFixture(harness, async ({ page, errors }) => {
      const metrics = [];
      for (const width of [1440, 1024, 390, 375]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(harness.base + filtered);
        await cards(page).first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        metrics.push(
          await page.evaluate(() => ({
            viewport: innerWidth,
            scroll: document.documentElement.scrollWidth,
            body: document.body.scrollWidth,
            columns: getComputedStyle(
              document.querySelector('[aria-label="Kết quả cơ hội"] ul'),
            ).gridTemplateColumns.split(' ').length,
            cardWidth: document.querySelector('article').getBoundingClientRect()
              .width,
          })),
        );
        if (process.env.HUB_UI_SCREENSHOT_DIR) {
          await mkdir(process.env.HUB_UI_SCREENSHOT_DIR, { recursive: true });
          await page.screenshot({
            path: join(
              process.env.HUB_UI_SCREENSHOT_DIR,
              `hub-v2-${width}.png`,
            ),
            fullPage: true,
          });
        }
      }
      if (process.env.HUB_UI_SCREENSHOT_DIR)
        await writeFile(
          join(process.env.HUB_UI_SCREENSHOT_DIR, 'metrics.json'),
          JSON.stringify({ metrics, errors }, null, 2),
        );
      assert.deepEqual(errors, []);
      for (const m of metrics) {
        assert.ok(m.scroll <= m.viewport + 1, JSON.stringify(m));
        assert.equal(
          m.columns,
          m.viewport === 1440 ? 3 : m.viewport === 1024 ? 2 : 1,
        );
      }
    });
  },
);

test(
  'Hub filters apply on submit, preserve URL during pagination and detail/back; no detail fan-out or Skills placeholders',
  options,
  async () => {
    await hubFixture(harness, async ({ page, calls, errors }) => {
      await page.goto(harness.base + filtered);
      await cards(page).first().waitFor();
      const summary = page
        .getByRole('region', { name: 'Kết quả cơ hội', exact: true })
        .locator('p')
        .first();
      assert.match(await summary.innerText(), /thực tập Công nghệ thông tin/);
      await page.getByLabel('Chuyên ngành', { exact: true }).selectOption('2');
      await page
        .getByLabel('Loại cơ hội', { exact: true })
        .selectOption('Việc làm');
      assert.match(await summary.innerText(), /thực tập Công nghệ thông tin/);
      await page.getByLabel('Từ khóa', { exact: true }).fill(' React ');
      await page
        .getByLabel('Hình thức làm việc', { exact: true })
        .selectOption('Hybrid');
      await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
      await page.waitForURL((url) => url.searchParams.get('q') === 'React');
      await cards(page).first().waitFor();
      let url = new URL(page.url());
      assert.equal(url.searchParams.get('majorId'), '2');
      assert.equal(url.searchParams.get('type'), 'Việc làm');
      assert.equal(url.searchParams.get('workFormat'), 'Hybrid');
      await page.getByRole('button', { name: 'Trang 2', exact: true }).click();
      await page.waitForURL((url) => url.searchParams.get('page') === '2');
      await cards(page).first().waitFor();
      assert.equal(new URL(page.url()).searchParams.get('q'), 'React');
      assert.equal(
        calls.filter((path) => /^\/api\/opportunities\/\d/.test(path)).length,
        0,
      );
      assert.equal(
        await page.getByText('Kỹ năng:', { exact: true }).count(),
        5,
      );
      await cards(page).first().getByRole('link').click();
      await page.waitForURL('**/opportunities/1');
      await page
        .getByRole('heading', {
          name: 'Frontend Developer Intern (React / Next.js)',
          exact: true,
        })
        .waitFor();
      assert.equal(
        await page
          .locator('body')
          .evaluate((el) => el.classList.contains('opportunity-hub-page')),
        false,
      );
      await page.goBack();
      await cards(page).first().waitFor();
      assert.equal(new URL(page.url()).searchParams.get('page'), '2');
      await Promise.all([
        page.waitForResponse((response) => {
          const url = new URL(response.url());
          return (
            url.pathname === '/api/opportunities' &&
            !url.searchParams.has('majorId')
          );
        }),
        page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click(),
      ]);
      await page.waitForURL((url) => !url.searchParams.has('majorId'));
      await cards(page).first().waitFor();
      const count = calls.filter(
        (path) =>
          path.startsWith('/api/opportunities?') ||
          path === '/api/opportunities',
      ).length;
      await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
      await page
        .getByText('Nhập từ khóa hoặc chọn ít nhất một bộ lọc để tìm kiếm.', {
          exact: true,
        })
        .waitFor();
      assert.equal(
        calls.filter(
          (path) =>
            path.startsWith('/api/opportunities?') ||
            path === '/api/opportunities',
        ).length,
        count,
      );
      assert.deepEqual(errors, []);
    });
  },
);

test(
  'Hub deadline cards use evaluatedAt/source timezone; unknown/null remain hidden; invalid payload stays error',
  options,
  async () => {
    await hubFixture(harness, async ({ page, state }) => {
      state.items = hubItems.map((item) => ({ ...item }));
      state.items[0].deadline = {
        ...hubItems[0].deadline,
        date: '2026-11-10',
        instant: '2026-11-10T17:00:00Z',
      };
      state.items[1].deadline = {
        ...hubItems[0].deadline,
        date: '2026-11-09',
        instant: '2026-11-09T17:00:00Z',
        state: 'expired',
      };
      state.items[2].deadline = null;
      state.items[3].deadline = {
        precision: 'unknown',
        date: null,
        sourceTimeZone: null,
        instant: '2026-11-09T17:00:00Z',
        state: 'unknown',
      };
      state.items[4].deadline = {
        precision: 'datetime',
        date: '2026-11-09',
        sourceTimeZone: 'America/Los_Angeles',
        instant: '2026-11-10T04:00:00Z',
        state: 'open',
      };
      await page.goto(harness.base + filtered);
      await cards(page).first().waitFor();
      await cards(page)
        .nth(0)
        .getByText('Hạn nộp: Hôm nay (10/11/2026)', { exact: true })
        .waitFor();
      await cards(page)
        .nth(1)
        .getByText('Hạn nộp: Đã hết hạn (09/11/2026)', { exact: true })
        .waitFor();
      assert.equal(
        await cards(page)
          .nth(2)
          .getByText(/Hạn nộp:/)
          .count(),
        0,
      );
      assert.equal(
        await cards(page)
          .nth(3)
          .getByText(/Hạn nộp:/)
          .count(),
        0,
      );
      await cards(page)
        .nth(4)
        .getByText('Hạn nộp: Hôm nay (09/11/2026)', { exact: true })
        .waitFor();
      state.items[0].deadline.date = '2026-02-30';
      await page.reload();
      await page
        .getByText('Chưa thể tải danh sách cơ hội', { exact: true })
        .waitFor();
      assert.equal(await page.getByText(/NaN/).count(), 0);
    });
  },
);

test(
  'Hub out-of-range pagination and Closed Major recover without silently dropping filters',
  options,
  async () => {
    await hubFixture(harness, async ({ page }) => {
      await page.goto(harness.base + filtered + '&page=6');
      await page
        .getByText('Trang này chưa có cơ hội', { exact: true })
        .waitFor();
      await page
        .getByRole('button', { name: 'Về trang cuối', exact: true })
        .click();
      await page.waitForURL((url) => url.searchParams.get('page') === '5');
      await cards(page).first().waitFor();
      assert.equal(new URL(page.url()).searchParams.get('majorId'), '1');
      assert.equal(
        await page
          .getByRole('button', { name: 'Trang tiếp', exact: true })
          .isDisabled(),
        true,
      );
      await page.goto(
        harness.base +
          '/opportunities?majorId=999&type=Th%E1%BB%B1c+t%E1%BA%ADp',
      );
      await page
        .getByText('Bộ lọc chuyên ngành không còn khả dụng', { exact: true })
        .waitFor();
      assert.equal(new URL(page.url()).searchParams.get('majorId'), '999');
      await page
        .getByRole('button', { name: 'Xóa bộ lọc chuyên ngành', exact: true })
        .click();
      await cards(page).first().waitFor();
      assert.equal(new URL(page.url()).searchParams.get('type'), 'Thực tập');
      assert.equal(new URL(page.url()).searchParams.has('majorId'), false);
    });
  },
);

test(
  'Hub loading, empty, service error/retry, malformed response and Major retry stay distinct',
  options,
  async () => {
    await hubFixture(harness, async ({ page, state, release }) => {
      state.delay = true;
      await page.goto(harness.base + '/opportunities');
      await page.getByText('Đang tải cơ hội', { exact: true }).waitFor();
      state.delay = false;
      await release();
      await cards(page).first().waitFor();
      state.empty = true;
      await page.reload();
      await page
        .getByText('Hiện chưa có cơ hội nào được công bố', { exact: true })
        .waitFor();
      await page.goto(harness.base + filtered);
      await page
        .getByText('Không tìm thấy cơ hội phù hợp', { exact: true })
        .waitFor();
      state.empty = false;
      state.fail = true;
      await page.reload();
      await page
        .getByText('Chưa thể tải danh sách cơ hội', { exact: true })
        .waitFor();
      state.fail = false;
      await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
      await cards(page).first().waitFor();
      state.invalid = true;
      await page.reload();
      await page
        .getByText('Chưa thể tải danh sách cơ hội', { exact: true })
        .waitFor();
      assert.equal(await cards(page).count(), 0);
      state.invalid = false;
      state.majorFail = true;
      await page.reload();
      await cards(page).first().waitFor();
      await page
        .getByText('Không tải được danh sách chuyên ngành.', { exact: true })
        .waitFor();
      state.majorFail = false;
      await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
      await page.getByLabel('Chuyên ngành', { exact: true }).selectOption('1');
    });
  },
);
