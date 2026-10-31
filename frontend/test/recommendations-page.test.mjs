import assert from 'node:assert/strict';
import { before, after, beforeEach, afterEach, test } from 'node:test';
import {
  chromium,
  startRecommendationsHarness,
} from '../test-support/recommendations-browser.mjs';
const options = { skip: !chromium && 'Playwright runner is unavailable.' };
let harness, page;
const evaluatedAt = '2026-11-05T17:00:00Z';
const item = {
  id: 99,
  type: 'Thực tập',
  title: 'First opportunity',
  publisher: 'Test Publisher',
  workFormat: 'Hybrid',
  location: 'Hà Nội',
  deadline: null,
  isVerified: true,
  matchScore: 0.7632,
};
const payload = (items = [item]) => ({ items, meta: { evaluatedAt } });
const fulfill = (route, value = payload(), status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(value),
  });
const fail = (route, code, status) =>
  fulfill(route, { error: { code, message: 'Safe error' } }, status);
before(async () => {
  if (chromium) harness = await startRecommendationsHarness();
});
beforeEach(async () => {
  if (!harness) return;
  page = await harness.browser.newPage();
  await page.route('**/api/auth/refresh', (route) =>
    fail(route, 'UNAUTHORIZED', 401),
  );
  await page.addInitScript(() => {
    window.recommendationRequests = [];
    const original = window.fetch;
    window.fetch = (input, init) => {
      if (String(input).startsWith('/api/'))
        window.recommendationRequests.push({
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
const visit = () => page.goto(harness.base + '/recommendations-test');
const visible = (text) => page.getByText(text, { exact: true }).waitFor();

test(
  'loading then ordered cards, exact score/info/deadline/links and plain text rendering',
  options,
  async () => {
    let pending;
    await page.route('**/api/recommendations', (route) => {
      pending = route;
    });
    await visit();
    await visible('Đang tải cơ hội phù hợp');
    await page.waitForFunction(
      () => window.recommendationRequests.length === 1,
    );
    assert.equal(
      pending.request().headers().authorization,
      'Bearer student-test-token',
    );
    await fulfill(
      pending,
      payload([
        item,
        {
          ...item,
          id: 1,
          title: '<img src=x onerror="window.compromised=true">',
          deadline: {
            precision: 'date',
            date: '2026-11-06',
            instant: '2026-11-06T17:00:00Z',
            sourceTimeZone: null,
            state: 'open',
          },
        },
      ]),
    );
    await visible('First opportunity');
    assert.deepEqual(
      await page.getByRole('heading', { level: 2 }).allTextContents(),
      ['First opportunity', '<img src=x onerror="window.compromised=true">'],
    );
    assert.equal(
      await page.getByText('Điểm phù hợp: 76,32%', { exact: true }).count(),
      2,
    );
    assert.equal(await page.getByText('Verified', { exact: true }).count(), 2);
    assert.equal(
      await page
        .getByRole('link', {
          name: 'Xem chi tiết: First opportunity',
          exact: true,
        })
        .getAttribute('href'),
      '/opportunities/99',
    );
    await visible('Hạn nộp: Không có hạn nộp');
    await visible('Hạn nộp: 06/11/2026');
    assert.equal(await page.evaluate(() => Boolean(window.compromised)), false);
    assert.equal(await page.locator('article img').count(), 0);
  },
);

test(
  '409 PROFILE_INCOMPLETE has Profile callback and retry; empty is separate successful state',
  options,
  async () => {
    let attempts = 0;
    await page.route('**/api/recommendations', (route) =>
      ++attempts === 1
        ? fail(route, 'PROFILE_INCOMPLETE', 409)
        : fulfill(route, payload([])),
    );
    await visit();
    await visible('Cần hoàn thiện hồ sơ');
    assert.equal(
      await page.getByRole('list', { name: 'Cơ hội được gợi ý' }).count(),
      0,
    );
    await page
      .getByRole('button', { name: 'Hoàn thiện hồ sơ', exact: true })
      .click();
    assert.equal(await page.evaluate(() => window.profileRequested), true);
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await visible('Chưa có cơ hội phù hợp');
    await page
      .getByRole('button', { name: 'Cập nhật hồ sơ', exact: true })
      .click();
    assert.equal(attempts, 2);
  },
);

test(
  'service/network errors remain errors and retry restores actual cards, not fabricated empty',
  options,
  async () => {
    let attempts = 0;
    await page.route('**/api/recommendations', (route) => {
      attempts++;
      if (attempts === 1) return route.abort('failed');
      if (attempts === 2) return fail(route, 'SERVICE_UNAVAILABLE', 503);
      if (attempts === 3) return fail(route, 'INTERNAL_ERROR', 500);
      return fulfill(route);
    });
    await visit();
    await visible('Không tải được gợi ý');
    for (let retry = 0; retry < 3; retry++) {
      await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
      if (retry === 0)
        await visible('Vui lòng thử lại. Mã lỗi: SERVICE_UNAVAILABLE');
      if (retry === 1)
        await visible('Vui lòng thử lại. Mã lỗi: INTERNAL_ERROR');
    }
    await visible('First opportunity');
    assert.equal(attempts, 4);
  },
);

test(
  'Guest/Admin props never fetch; Student with invalid token gets 401, denied token gets 403',
  options,
  async () => {
    await page.route('**/api/recommendations', (route) => {
      const token = route.request().headers().authorization;
      return token === 'Bearer valid-token'
        ? fulfill(route)
        : fail(
            route,
            token === 'Bearer admin-token' ? 'FORBIDDEN' : 'UNAUTHORIZED',
            token === 'Bearer admin-token' ? 403 : 401,
          );
    });
    await visit();
    await visible('Phiên đăng nhập không hợp lệ');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    assert.equal(await page.evaluate(() => window.signInRequested), true);
    await page.evaluate(() => {
      window.recommendationTest.setToken(null);
      window.recommendationTest.setRole(null);
    });
    await visible('Cần đăng nhập Student');
    assert.equal(
      await page.evaluate(() => window.recommendationRequests.length),
      1,
    );
    await page.evaluate(() => {
      window.recommendationTest.setToken('admin-token');
      window.recommendationTest.setRole('Admin');
    });
    await visible('Không có quyền xem gợi ý');
    assert.equal(
      await page.evaluate(() => window.recommendationRequests.length),
      1,
    );
    await page.evaluate(() => window.recommendationTest.setRole('Student'));
    await visible('Tài khoản hiện tại không có quyền Student để xem gợi ý.');
    await page.evaluate(() =>
      window.recommendationTest.setToken('valid-token'),
    );
    await visible('First opportunity');
  },
);

test(
  'token change/unmount abort old requests, hide old data and ignore late results',
  options,
  async () => {
    const pending = [];
    await page.route('**/api/recommendations', (route) => {
      pending.push(route);
    });
    await visit();
    await visible('Đang tải cơ hội phù hợp');
    await page.evaluate(() =>
      window.recommendationTest.setToken('second-token'),
    );
    await page.waitForFunction(
      () =>
        window.recommendationRequests.length === 2 &&
        window.recommendationRequests[0].signal.aborted,
    );
    await fulfill(pending[1]);
    await visible('First opportunity');
    await fulfill(
      pending[0],
      payload([{ ...item, title: 'Stale private item' }]),
    ).catch(() => {});
    assert.equal(
      await page.getByText('Stale private item', { exact: true }).count(),
      0,
    );
    await page.evaluate(() =>
      window.recommendationTest.setToken('third-token'),
    );
    await visible('Đang tải cơ hội phù hợp');
    assert.equal(
      await page.getByText('First opportunity', { exact: true }).count(),
      0,
    );
    await page.waitForFunction(
      () => window.recommendationRequests.length === 3,
    );
    await page.evaluate(() => window.recommendationTest.setVisible(false));
    await visible('Unmounted');
    await page.waitForFunction(
      () => window.recommendationRequests[2].signal.aborted,
    );
  },
);

test(
  'malformed successful payload is a response error, never a partial or empty list',
  options,
  async () => {
    await page.route('**/api/recommendations', (route) =>
      fulfill(route, payload([{ ...item, matchScore: 0.4 }])),
    );
    await visit();
    await visible('Vui lòng thử lại. Mã lỗi: INVALID_RESPONSE');
    assert.equal(
      await page.getByText('Chưa có cơ hội phù hợp', { exact: true }).count(),
      0,
    );
  },
);
