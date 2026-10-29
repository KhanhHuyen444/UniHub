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

test(
  'loading/list statuses/empty type/error/retry and authenticated headers',
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
    await page.getByRole('button', { name: 'Skill', exact: true }).click();
    await visible('Chưa có danh mục');
    assert.equal(await page.getByRole('button', { name: /Xóa/ }).count(), 0);
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
  },
);

test(
  'create saves real contract payload, pending disables controls; rename/status/no-op refresh list',
  options,
  async () => {
    let rows = structuredClone(initial),
      saveRoute;
    await page.route('**/api/admin/categories**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET') return fulfill(route, { items: rows });
      if (request.method() === 'POST') {
        saveRoute = route;
        return;
      }
      const body = request.postDataJSON();
      const row = rows.find((item) => item.id === Number(path.split('/')[4]));
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
    await page
      .getByRole('button', { name: 'Lưu thay đổi', exact: true })
      .click();
    await visible('Không có thay đổi.');
    const create = page.getByRole('form', {
      name: 'Tạo danh mục',
      exact: true,
    });
    await create.getByLabel('Tên danh mục', { exact: false }).fill(' New ');
    await create
      .getByLabel('Lý do tạo (tùy chọn)', { exact: true })
      .fill('Reason');
    await create
      .getByRole('button', { name: 'Tạo danh mục', exact: true })
      .click();
    await page.waitForFunction(() =>
      window.adminRequests.some(
        (request) => request.path === '/api/admin/categories',
      ),
    );
    assert.equal(
      await page
        .getByRole('button', { name: 'Skill', exact: true })
        .isDisabled(),
      true,
    );
    assert.deepEqual(saveRoute.request().postDataJSON(), {
      type: 'Major',
      name: 'New',
      reason: 'Reason',
    });
    rows.push({ id: 3, type: 'Major', name: 'New', status: 'Active' });
    await fulfill(saveRoute, { category: rows[2] }, 201);
    await visible('New');
    assert.equal(
      await create.getByLabel('Tên danh mục', { exact: false }).inputValue(),
      '',
    );
    await page
      .getByRole('button', { name: 'Đổi tên New', exact: true })
      .click();
    const edit = page.getByRole('form', {
      name: 'Chỉnh sửa danh mục',
      exact: true,
    });
    await edit.getByLabel('Tên mới', { exact: false }).fill('Updated');
    await edit
      .getByRole('button', { name: 'Lưu thay đổi', exact: true })
      .click();
    await visible('Updated');
    await page
      .getByRole('button', { name: 'Đóng Updated', exact: true })
      .click();
    await edit
      .getByRole('button', { name: 'Lưu thay đổi', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Mở lại Updated', exact: true })
      .waitFor();
    await page
      .getByRole('button', { name: 'Mở lại Updated', exact: true })
      .click();
    await edit
      .getByRole('button', { name: 'Lưu thay đổi', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Đóng Updated', exact: true })
      .waitFor();
  },
);

test(
  'client validation and duplicate/last Active/server errors preserve forms and show messages',
  options,
  async () => {
    let posts = 0,
      postCode = 'DUPLICATE_CATEGORY';
    await page.route('**/api/admin/categories**', (route) => {
      if (route.request().method() === 'GET')
        return fulfill(route, { items: initial });
      posts++;
      return denied(
        route,
        route.request().method() === 'POST' ? postCode : 'LAST_ACTIVE_CATEGORY',
        409,
      );
    });
    await visit();
    await visible('Data');
    const create = page.getByRole('form', {
      name: 'Tạo danh mục',
      exact: true,
    });
    await create
      .getByLabel('Tên danh mục', { exact: false })
      .fill('x'.repeat(101));
    await create
      .getByRole('button', { name: 'Tạo danh mục', exact: true })
      .click();
    await visible(
      'Dữ liệu không hợp lệ: tên 1–100 ký tự, lý do tối đa 500 ký tự.',
    );
    assert.equal(posts, 0);
    await create.getByLabel('Tên danh mục', { exact: false }).fill('Data');
    await create
      .getByRole('button', { name: 'Tạo danh mục', exact: true })
      .click();
    await visible('Tên danh mục đã tồn tại trong loại này.');
    assert.equal(
      await create.getByLabel('Tên danh mục', { exact: false }).inputValue(),
      'Data',
    );
    postCode = 'INTERNAL_ERROR';
    await create
      .getByRole('button', { name: 'Tạo danh mục', exact: true })
      .click();
    await visible(
      'Thao tác chưa thành công. Vui lòng tải lại để kiểm tra kết quả.',
    );
    await page.getByRole('button', { name: 'Đóng Data', exact: true }).click();
    await page
      .getByRole('button', { name: 'Lưu thay đổi', exact: true })
      .click();
    await visible('Không thể đóng danh mục Active cuối cùng của loại này.');
    assert.equal(
      await page
        .getByRole('form', { name: 'Chỉnh sửa danh mục', exact: true })
        .count(),
      1,
    );
  },
);

test(
  'Guest/Student do not fetch or mutate; 401/403 remove Admin controls; new token resets state',
  options,
  async () => {
    await page.route('**/api/admin/categories**', (route) =>
      route.request().headers().authorization === 'Bearer valid-token'
        ? fulfill(route, { items: initial })
        : denied(route, 'UNAUTHORIZED', 401),
    );
    await visit();
    await visible(
      'Phiên đăng nhập không hợp lệ hoặc hết hạn. Vui lòng đăng nhập lại.',
    );
    assert.equal(await page.getByRole('form').count(), 0);
    await page.evaluate(() => {
      window.adminTest.setToken('valid-token');
      window.adminTest.setRole('Student');
    });
    await visible('Không có quyền quản trị');
    assert.equal(await page.evaluate(() => window.adminRequests.length), 1);
    await page.evaluate(() => {
      window.adminTest.setToken(null);
      window.adminTest.setRole(null);
    });
    await visible('Cần đăng nhập Admin');
    assert.equal(await page.evaluate(() => window.adminRequests.length), 1);
    await page.evaluate(() => {
      window.adminTest.setToken('valid-token');
      window.adminTest.setRole('Admin');
    });
    await visible('Data');
    await page.evaluate(() => window.adminTest.setToken('expired-token'));
    await visible('Không được truy cập danh mục Admin');
  },
);

test(
  'filter switch and unmount abort stale loads; pending mutation never leaks into a new session',
  options,
  async () => {
    const pending = [];
    await page.route('**/api/admin/categories**', (route) => {
      pending.push(route);
    });
    await visit();
    await visible('Đang tải danh mục');
    await page.getByRole('button', { name: 'Skill', exact: true }).click();
    await page.waitForFunction(
      () =>
        window.adminRequests.length === 2 &&
        window.adminRequests[0].signal.aborted,
    );
    await fulfill(pending[1], { items: [] });
    await visible('Chưa có danh mục');
    await fulfill(pending[0], { items: initial }).catch(() => {});
    assert.equal(await page.getByText('Data', { exact: true }).count(), 0);
    const create = page.getByRole('form', {
      name: 'Tạo danh mục',
      exact: true,
    });
    await create.getByLabel('Tên danh mục', { exact: false }).fill('New');
    await create
      .getByRole('button', { name: 'Tạo danh mục', exact: true })
      .click();
    await page.waitForFunction(() => window.adminRequests.length === 3);
    await page.evaluate(() => window.adminTest.setVisible(false));
    await visible('Unmounted');
    await page.waitForFunction(() => window.adminRequests[2].signal.aborted);
  },
);
