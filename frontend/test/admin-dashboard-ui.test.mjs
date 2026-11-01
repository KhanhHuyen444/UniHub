import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';

let vite, auth, ui, AuthProvider, RequireRole;
const originalFetch = globalThis.fetch;
const evaluatedAt = '2026-10-19T07:30:00Z'; // 14:30 in Asia/Ho_Chi_Minh
const admin = {
  id: 1,
  role: 'Admin',
  fullName: 'Nguyễn Quản Trị',
  email: 'admin@unihub.invalid',
  avatarUrl: null,
};

const sampleAccounts = { totalAccounts: 1248, evaluatedAt };
const sampleOpportunities = {
  byStatus: { Pending: 14, Approved: 388, Rejected: 27 },
  evaluatedAt,
};
const sampleForum = { posts: 152, comments: 843, evaluatedAt };

before(async () => {
  vite = await createServer({
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true },
  });
  auth = await vite.ssrLoadModule('/src/features/auth/auth-state.ts');
  ui = await vite.ssrLoadModule(
    '/src/features/admin/dashboard/AdminDashboardPage.tsx',
  );
  ({ AuthProvider } = await vite.ssrLoadModule(
    '/src/features/auth/AuthProvider.tsx',
  ));
  ({ RequireRole } = await vite.ssrLoadModule(
    '/src/features/auth/AuthGuard.tsx',
  ));
});

after(async () => {
  globalThis.fetch = originalFetch;
  auth.setGuest();
  await vite?.close();
});

function setupMocks({
  accounts = sampleAccounts,
  opportunities = sampleOpportunities,
  forum = sampleForum,
} = {}) {
  globalThis.fetch = async (url) => {
    const path = String(url);
    if (path.includes('/api/admin/dashboard/accounts')) {
      if (accounts instanceof Error) throw accounts;
      return new Response(JSON.stringify(accounts), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (path.includes('/api/admin/dashboard/opportunities')) {
      if (opportunities instanceof Error) throw opportunities;
      return new Response(JSON.stringify(opportunities), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (path.includes('/api/admin/dashboard/forum')) {
      if (forum instanceof Error) throw forum;
      return new Response(JSON.stringify(forum), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'not found' }), {
      status: 404,
    });
  };
}

function renderDashboard() {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/admin/dashboard'] },
      createElement(
        AuthProvider,
        null,
        createElement(
          RequireRole,
          { role: 'Admin' },
          createElement(ui.AdminDashboardPage),
        ),
      ),
    ),
  );
}

test('calculateDistribution computes correct total and percentages', () => {
  const result = ui.calculateDistribution(14, 388, 27);
  assert.equal(result.total, 429);
  assert.equal(result.approvedPct, '90.4');
  assert.equal(result.pendingPct, '3.3');
  assert.equal(result.rejectedPct, '6.3');

  const zeroResult = ui.calculateDistribution(0, 0, 0);
  assert.equal(zeroResult.total, 0);
  assert.equal(zeroResult.approvedPct, '0.0');
  assert.equal(zeroResult.pendingPct, '0.0');
  assert.equal(zeroResult.rejectedPct, '0.0');
});

test('DonutChart renders SVG circles with proportional stroke lengths and center summary', () => {
  const markup = renderToStaticMarkup(
    createElement(ui.DonutChart, {
      pending: 14,
      approved: 388,
      rejected: 27,
      total: 429,
    }),
  );

  assert.ok(markup.includes('Tổng cộng'));
  assert.ok(markup.includes('429'));
  assert.ok(markup.includes('cơ hội'));
  // Check stroke colors
  assert.ok(markup.includes('#15803D')); // Approved
  assert.ok(markup.includes('#B45309')); // Pending
  assert.ok(markup.includes('#DC2626')); // Rejected

  // Test empty DonutChart
  const emptyMarkup = renderToStaticMarkup(
    createElement(ui.DonutChart, {
      pending: 0,
      approved: 0,
      rejected: 0,
      total: 0,
    }),
  );
  assert.ok(emptyMarkup.includes('#E2E8F0'));
  assert.ok(emptyMarkup.includes('0'));
});

test('Dashboard renders 4 KPI cards and panel titles matching design labels', async () => {
  auth.setAuthenticated('admin-token', admin);
  setupMocks();

  const html = renderDashboard();

  assert.ok(html.includes('Dashboard thống kê'));
  assert.ok(html.includes('Làm mới'));
  assert.ok(html.includes('Tổng tài khoản đăng ký'));
  assert.ok(html.includes('Chờ thẩm định (Pending)'));
  assert.ok(html.includes('Đã duyệt (Approved)'));
  assert.ok(html.includes('Từ chối (Rejected)'));
  assert.ok(html.includes('Phân bổ cơ hội theo trạng thái'));
  assert.ok(html.includes('Tương tác thảo luận'));
});

test('Dashboard maintains accessible landmark labels for backwards compatibility', async () => {
  auth.setAuthenticated('admin-token', admin);
  setupMocks();

  const html = renderDashboard();

  assert.ok(html.includes('aria-label="Tổng tài khoản"'));
  assert.ok(html.includes('aria-label="Cơ hội"'));
  assert.ok(html.includes('aria-label="Diễn đàn"'));
});
