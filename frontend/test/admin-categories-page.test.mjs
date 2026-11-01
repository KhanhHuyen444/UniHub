import assert from 'node:assert/strict';
import { before, after, beforeEach, afterEach, test } from 'node:test';
import {
  chromium,
  startAdminCategoriesHarness,
} from '../test-support/admin-categories-browser.mjs';
const options = { skip: !chromium && 'Playwright runner is unavailable.' };
let harness, page;
const initial = [
  { id: 1, type: 'Major', name: 'Data', status: 'Active' },
  { id: 2, type: 'Major', name: 'Design', status: 'Closed' },
];
const fulfill = (route, value, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(value),
  });
const denied = (route, code, status) =>
  fulfill(route, { error: { code, message: 'Safe error' } }, status);
before(async () => {
  if (chromium) harness = await startAdminCategoriesHarness();
});
beforeEach(async () => {
  if (!harness) return;
  page = await harness.browser.newPage();
  await page.addInitScript(() => {
    window.adminRequests = [];
    const original = window.fetch;
    window.fetch = (input, init) => {
      if (String(input).startsWith('/api/'))
        window.adminRequests.push({
          path: String(input),
          signal: init?.signal,
        });
      return original(input, init);
    };
  });
});
afterEach(async () => {
  await page?.close();
});
after(async () => {
  await harness?.close();
});
const visit = () => page.goto(harness.base + '/admin-categories-test');
const visible = (text) => page.getByText(text, { exact: true }).waitFor();

const createForm = () =>
  page.getByRole('form', { name: 'Tạo danh mục', exact: true });
const editForm = () =>
  page.getByRole('form', { name: 'Chỉnh sửa danh mục', exact: true });
const openCreate = () =>
  page.getByRole('button', { name: /Thêm chuyên ngành|Thêm kỹ năng/ }).click();
const closeDialog = () =>
  page.getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click();

test(
  'loading, Vietnamese tabs, statuses, empty and error retry',
  options,
  async () => {
    let pending;
    await page.route('**/api/admin/categories?type=Major', (route) => {
      pending = route;
    });
    await page.route('**/api/admin/categories?type=Skill', (route) =>
      fulfill(route, { items: [] }),
    );
    await visit();
    await visible('Đang tải danh mục');
    await page.waitForFunction(() => window.adminRequests.length === 1);
    assert.equal(
      pending.request().headers().authorization,
      'Bearer admin-test-token',
    );
    await fulfill(pending, { items: initial });
    await visible('Data');
    await visible('Closed');
    await page.getByRole('button', { name: /^Kỹ năng/ }).click();
    await visible('Chưa có danh mục');
    await page.unroute('**/api/admin/categories?type=Skill');
    let attempts = 0;
    await page.route('**/api/admin/categories?type=Skill', (route) =>
      ++attempts === 1
        ? denied(route, 'SERVICE_UNAVAILABLE', 503)
        : fulfill(route, {
            items: [{ id: 3, type: 'Skill', name: 'SQL', status: 'Active' }],
          }),
    );
    await page
      .getByRole('button', { name: 'Tải lại danh sách', exact: true })
      .click();
    await visible('Không tải được danh mục');
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await visible('SQL');
    assert.equal(await page.getByRole('button', { name: /Xóa/ }).count(), 0);
  },
);

test(
  'modal CRUD preserves payloads, locks pending actions, no-op and status changes',
  options,
  async () => {
    let rows = structuredClone(initial),
      pending;
    await page.route('**/api/admin/categories**', (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      if (request.method() === 'GET') return fulfill(route, { items: rows });
      if (request.method() === 'POST') {
        pending = route;
        return;
      }
      const row = rows.find((item) => item.id === Number(path.split('/')[4])),
        body = request.postDataJSON();
      const changed = path.endsWith('/status')
        ? row.status !== body.status
        : row.name !== body.name;
      if (path.endsWith('/status')) row.status = body.status;
      else row.name = body.name;
      return fulfill(route, { changed, category: row });
    });
    await visit();
    await visible('Data');
    await page
      .getByRole('button', { name: 'Đổi tên Data', exact: true })
      .click();
    await editForm()
      .getByRole('button', { name: 'Lưu thay đổi', exact: true })
      .click();
    await visible('Không có thay đổi.');
    await openCreate();
    await createForm()
      .getByLabel('Tên chuyên ngành', { exact: false })
      .fill(' New ');
    await createForm()
      .getByText('Thêm lý do (tùy chọn)', { exact: true })
      .click();
    await createForm()
      .getByLabel('Lý do tạo (tùy chọn)', { exact: true })
      .fill('Reason');
    await createForm()
      .getByRole('button', { name: 'Lưu', exact: true })
      .click();
    await page.waitForFunction(() =>
      window.adminRequests.some((r) => r.path === '/api/admin/categories'),
    );
    assert.equal(
      await page.getByRole('button', { name: /^Kỹ năng/ }).isDisabled(),
      true,
    );
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 1);
    assert.deepEqual(pending.request().postDataJSON(), {
      type: 'Major',
      name: 'New',
      reason: 'Reason',
    });
    rows.push({ id: 3, type: 'Major', name: 'New', status: 'Active' });
    await fulfill(pending, { category: rows[2] }, 201);
    await visible('New');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page
      .getByRole('button', { name: 'Đổi tên New', exact: true })
      .click();
    await editForm().getByLabel('Tên mới', { exact: false }).fill('Updated');
    await editForm()
      .getByRole('button', { name: 'Lưu thay đổi', exact: true })
      .click();
    await visible('Updated');
    for (const [action, confirm, next] of [
      ['Đóng Updated', 'Đóng', 'Mở lại Updated'],
      ['Mở lại Updated', 'Mở lại', 'Đóng Updated'],
    ]) {
      await page.getByRole('button', { name: action, exact: true }).click();
      await editForm()
        .getByRole('button', { name: confirm, exact: true })
        .click();
      await page.getByRole('button', { name: next, exact: true }).waitFor();
    }
  },
);

test(
  'validation and business errors retain modal input; Escape returns focus',
  options,
  async () => {
    let posts = 0;
    await page.route('**/api/admin/categories**', (route) => {
      if (route.request().method() === 'GET')
        return fulfill(route, { items: initial });
      posts++;
      return denied(
        route,
        route.request().method() === 'POST'
          ? 'DUPLICATE_CATEGORY'
          : 'LAST_ACTIVE_CATEGORY',
        409,
      );
    });
    await visit();
    await visible('Data');
    await openCreate();
    await createForm()
      .getByLabel('Tên chuyên ngành', { exact: false })
      .fill('x'.repeat(101));
    await createForm()
      .getByRole('button', { name: 'Lưu', exact: true })
      .click();
    await visible(
      'Dữ liệu không hợp lệ: tên 1–100 ký tự, lý do tối đa 500 ký tự.',
    );
    assert.equal(posts, 0);
    await createForm()
      .getByLabel('Tên chuyên ngành', { exact: false })
      .fill('Data');
    await createForm()
      .getByRole('button', { name: 'Lưu', exact: true })
      .click();
    await visible('Tên danh mục đã tồn tại trong loại này.');
    assert.equal(
      await createForm()
        .getByLabel('Tên chuyên ngành', { exact: false })
        .inputValue(),
      'Data',
    );
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(
      await page
        .getByRole('button', { name: /Thêm chuyên ngành/ })
        .evaluate((node) => node === document.activeElement),
      true,
    );
    await page.getByRole('button', { name: 'Đóng Data', exact: true }).click();
    await editForm().getByRole('button', { name: 'Đóng', exact: true }).click();
    await visible('Không thể đóng danh mục Active cuối cùng của loại này.');
    assert.equal(await page.getByRole('dialog').count(), 1);
  },
);

test('Guest/Student cannot access controls or fetch', options, async () => {
  await page.route('**/api/admin/categories**', (route) =>
    fulfill(route, { items: initial }),
  );
  await visit();
  await visible('Data');
  await page.evaluate(() => window.adminTest.setRole('Student'));
  await visible('Không có quyền quản trị');
  assert.equal(await page.getByRole('form').count(), 0);
  await page.evaluate(() => window.adminTest.setToken(null));
  await visible('Cần đăng nhập Admin');
  assert.equal(await page.evaluate(() => window.adminRequests.length), 1);
});

test(
  'filter and unmount abort stale reads and pending mutations',
  options,
  async () => {
    const pending = [];
    await page.route('**/api/admin/categories**', (route) => {
      pending.push(route);
    });
    await visit();
    await visible('Đang tải danh mục');
    await page.getByRole('button', { name: /^Kỹ năng/ }).click();
    await page.waitForFunction(
      () =>
        window.adminRequests.length === 2 &&
        window.adminRequests[0].signal.aborted,
    );
    await fulfill(pending[1], { items: [] });
    await visible('Chưa có danh mục');
    await fulfill(pending[0], { items: initial }).catch(() => {});
    assert.equal(await page.getByText('Data', { exact: true }).count(), 0);
    await openCreate();
    await createForm().getByLabel('Tên kỹ năng', { exact: false }).fill('New');
    await createForm()
      .getByRole('button', { name: 'Lưu', exact: true })
      .click();
    await page.waitForFunction(() => window.adminRequests.length === 3);
    await page.evaluate(() => window.adminTest.setVisible(false));
    await visible('Unmounted');
    await page.waitForFunction(() => window.adminRequests[2].signal.aborted);
  },
);

test(
  'rotation preserves modal draft; user switch and logout remove previous workspace',
  options,
  async () => {
    await page.route('**/api/admin/categories**', (route) =>
      fulfill(route, { items: initial }),
    );
    await visit();
    await visible('Data');
    await openCreate();
    const input = page.locator('#category-create-name');
    await input.fill('Private draft');
    await page.evaluate(() => window.adminTest.setToken('rotated'));
    assert.equal(await input.inputValue(), 'Private draft');
    await page.evaluate(() => window.adminTest.setUser(2));
    await visible('Data');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await openCreate();
    assert.equal(await input.inputValue(), '');
    await input.fill('Second draft');
    await page.evaluate(() => window.adminTest.setToken(null));
    await visible('Cần đăng nhập Admin');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.evaluate(() => window.adminTest.setToken('new-session'));
    await visible('Data');
    await openCreate();
    assert.equal(await input.inputValue(), '');
  },
);

test(
  'Skill search and eight-row pagination use the loaded API list, not additional query parameters',
  options,
  async () => {
    await page.route('**/api/admin/categories**', (route) =>
      fulfill(route, {
        items:
          new URL(route.request().url()).searchParams.get('type') === 'Skill'
            ? Array.from({ length: 17 }, (_, i) => ({
                id: i + 10,
                type: 'Skill',
                name: `Skill ${i + 1}`,
                status: 'Active',
              }))
            : initial,
      }),
    );
    await visit();
    await visible('Data');
    await page.getByRole('button', { name: /^Kỹ năng/ }).click();
    await visible('Skill 1');
    assert.equal(await page.locator('tbody tr').count(), 8);
    await page.getByRole('button', { name: 'Tiếp', exact: true }).click();
    await visible('Skill 9');
    await page.getByRole('searchbox', { name: 'Tìm kỹ năng' }).fill('Skill 17');
    await visible('Skill 17');
    assert.equal(await page.locator('tbody tr').count(), 1);
    assert.equal(await page.evaluate(() => window.adminRequests.length), 2);
  },
);

test(
  'creation date uses Vietnamese format and Ho Chi Minh timezone with safe fallback',
  options,
  async () => {
    await page.close();
    page = await harness.browser.newPage({ timezoneId: 'America/Los_Angeles' });
    await page.route('**/api/admin/categories**', (route) =>
      fulfill(route, {
        items: [
          { ...initial[0], createdAt: '2026-10-28T18:30:00.000Z' },
          { ...initial[1], createdAt: '2026-02-30T00:00:00.000Z' },
          { ...initial[0], id: 3, name: 'Missing date' },
        ],
      }),
    );
    await visit();
    await visible('29/10/2026');
    assert.equal(
      await page.locator('time').getAttribute('datetime'),
      '2026-10-28T18:30:00.000Z',
    );
    assert.equal(
      await page
        .getByLabel('Ngày tạo chưa có thông tin', { exact: true })
        .count(),
      2,
    );
    assert.equal(await page.locator('tbody tr').count(), 3);
  },
);

test(
  'Skill reload clamps the stored page and reports matching totals without page jumps',
  options,
  async () => {
    let count = 17;
    await page.route('**/api/admin/categories**', (route) =>
      fulfill(route, {
        items:
          new URL(route.request().url()).searchParams.get('type') === 'Skill'
            ? Array.from({ length: count }, (_, index) => ({
                id: index + 10,
                type: 'Skill',
                name: `Skill ${index + 1}`,
                status: 'Active',
              }))
            : initial,
      }),
    );
    await visit();
    await visible('Data');
    await page.getByRole('button', { name: /^Kỹ năng/ }).click();
    await visible('Hiển thị 1–8 / 17 kỹ năng');
    await page.getByRole('button', { name: 'Tiếp', exact: true }).click();
    await visible('Hiển thị 9–16 / 17 kỹ năng');
    await page.getByRole('button', { name: 'Tiếp', exact: true }).click();
    await visible('Hiển thị 17–17 / 17 kỹ năng');
    count = 8;
    await page
      .getByRole('button', { name: 'Tải lại danh sách', exact: true })
      .click();
    await visible('Trang 1 / 1');
    count = 17;
    await page
      .getByRole('button', { name: 'Tải lại danh sách', exact: true })
      .click();
    await visible('Trang 1 / 3');
    await visible('Hiển thị 1–8 / 17 kỹ năng');
    const search = page.getByRole('searchbox', { name: 'Tìm kỹ năng' });
    await search.fill('missing');
    await visible('Không tìm thấy kỹ năng');
    await visible('Hiển thị 0–0 / 0 kỹ năng');
    count = 0;
    await search.fill('   ');
    await page
      .getByRole('button', { name: 'Tải lại danh sách', exact: true })
      .click();
    await visible('Chưa có danh mục');
  },
);
