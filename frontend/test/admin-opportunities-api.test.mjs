import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import {
  loginDestination,
  safeReturnPath,
} from '../src/features/auth/return-path.ts';
import {
  parseAdminOpportunity,
  parseAdminOpportunityMutation,
  parsePendingOpportunities,
  isReviewTargetCurrent,
  lastValidQueuePage,
} from '../src/features/admin/opportunities/contracts.ts';

const frontendRoot = fileURLToPath(new URL('..', import.meta.url));

function opportunity(overrides = {}) {
  return {
    id: 41,
    type: 'Thực tập',
    title: 'Thực tập sinh Phân tích dữ liệu',
    publisher: 'Đơn vị minh họa',
    descriptionText: 'Mô tả từ API',
    requirementsText: 'Yêu cầu từ API',
    workFormat: 'Hybrid',
    location: 'Hà Nội',
    deadline: {
      precision: 'date',
      date: '2026-11-05',
      sourceTimeZone: null,
      instant: '2026-11-05T17:00:00Z',
      state: 'open',
    },
    isVerified: false,
    sourceUrl: 'https://jobs.example.invalid/41',
    majors: [{ id: 12, name: 'Kỹ thuật phần mềm' }],
    skills: [{ id: 33, name: 'SQL' }],
    eligibleAcademicYears: [3, 4],
    createdAt: '2026-10-28T00:00:00Z',
    status: 'Pending',
    reviewedAt: null,
    ...overrides,
  };
}

const adminUser = {
  id: 9,
  email: 'admin@example.invalid',
  fullName: 'Admin Test',
  avatarUrl: null,
  role: 'Admin',
};

test('Admin API parsers validate pending items, deadline and mutation envelope', () => {
  const queue = parsePendingOpportunities({
    items: [opportunity()],
    meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  });
  assert.equal(queue.items[0].majors[0].name, 'Kỹ thuật phần mềm');
  assert.equal(queue.items[0].deadline.date, '2026-11-05');
  assert.deepEqual(
    parseAdminOpportunityMutation({
      item: {
        id: 41,
        status: 'Approved',
        isVerified: true,
        reviewedAt: '2026-10-29T00:00:00Z',
      },
    }),
    {
      id: 41,
      status: 'Approved',
      isVerified: true,
      reviewedAt: '2026-10-29T00:00:00Z',
    },
  );
  assert.throws(
    () =>
      parseAdminOpportunity(opportunity({ sourceUrl: 'javascript:alert(1)' })),
    { code: 'INVALID_RESPONSE' },
  );
  assert.throws(
    () => parsePendingOpportunities({ items: [], meta: { page: 0 } }),
    { code: 'INVALID_RESPONSE' },
  );
});

test('pending queue accepts a missing publisher without dropping the item', () => {
  const queue = parsePendingOpportunities({
    items: [opportunity({ id: 41, publisher: null }), opportunity({ id: 42 })],
    meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
  });

  assert.equal(queue.items.length, 2);
  assert.equal(queue.items[0].publisher, null);
  assert.equal(queue.items[1].publisher, 'Đơn vị minh họa');
});

test('review confirmation stays bound to the current route and loaded item', () => {
  assert.equal(isReviewTargetCurrent(41, '41', 41), true);
  assert.equal(isReviewTargetCurrent(41, '42', 41), false);
  assert.equal(isReviewTargetCurrent(41, '41', 42), false);
  assert.equal(isReviewTargetCurrent(null, '41', 41), false);
  assert.equal(isReviewTargetCurrent(41, undefined, 41), false);
});

test('queue page correction never renders an invalid final or empty page', () => {
  assert.equal(lastValidQueuePage(3, 2), 2);
  assert.equal(lastValidQueuePage(1, 1), 1);
  assert.equal(lastValidQueuePage(2, 0), 1);
});

test('admin direct login destination and returnTo stay within the application', () => {
  assert.equal(loginDestination(null, 'Admin'), '/admin/opportunities');
  assert.equal(loginDestination(null, 'Student'), '/opportunities');
  assert.equal(
    loginDestination('/admin/opportunities/41?page=2', 'Admin'),
    '/admin/opportunities/41?page=2',
  );
  assert.equal(
    safeReturnPath('//attacker.invalid', 'https://unihub.invalid'),
    '/opportunities',
  );
  assert.equal(
    loginDestination('https://attacker.invalid', 'Admin'),
    '/opportunities',
  );
});

test('four Admin API calls use protected bearer requests and contract routes', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const vite = await createServer({
    appType: 'custom',
    configFile: false,
    logLevel: 'silent',
    root: frontendRoot,
    server: { middlewareMode: true },
  });
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    calls.push({ path, init });
    let body;
    if (path.startsWith('/api/admin/opportunities?')) {
      body = {
        items: [opportunity()],
        meta: { page: 2, pageSize: 20, total: 21, totalPages: 2 },
      };
    } else if (path === '/api/admin/opportunities/41') {
      body = { item: opportunity() };
    } else if (path.endsWith('/approve')) {
      body = {
        item: {
          id: 41,
          status: 'Approved',
          isVerified: true,
          reviewedAt: '2026-10-29T00:00:00Z',
        },
      };
    } else if (path.endsWith('/reject')) {
      body = {
        item: {
          id: 41,
          status: 'Rejected',
          isVerified: false,
          reviewedAt: '2026-10-29T00:00:00Z',
        },
      };
    } else {
      throw new Error(`Unexpected request: ${path}`);
    }
    return new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const authState = await vite.ssrLoadModule(
      '/src/features/auth/auth-state.ts',
    );
    authState.setAuthenticated('test-access-token', adminUser);
    const {
      getPendingOpportunities,
      getAdminOpportunity,
      approveAdminOpportunity,
      rejectAdminOpportunity,
    } = await vite.ssrLoadModule('/src/features/admin/opportunities/api.ts');
    const signal = new AbortController().signal;
    assert.equal((await getPendingOpportunities(2, signal)).meta.total, 21);
    assert.equal((await getAdminOpportunity('41', signal)).status, 'Pending');
    assert.equal((await approveAdminOpportunity(41, true)).isVerified, true);
    assert.equal(
      (await rejectAdminOpportunity(41, 'Không phù hợp')).status,
      'Rejected',
    );

    assert.deepEqual(
      calls.map(({ path, init }) => [path, init.method ?? 'GET']),
      [
        ['/api/admin/opportunities?page=2&pageSize=20', 'GET'],
        ['/api/admin/opportunities/41', 'GET'],
        ['/api/admin/opportunities/41/approve', 'POST'],
        ['/api/admin/opportunities/41/reject', 'POST'],
      ],
    );
    for (const { init } of calls) {
      assert.equal(
        init.headers.get('Authorization'),
        'Bearer test-access-token',
      );
    }
    assert.equal(JSON.parse(calls[2].init.body).verified, true);
    assert.equal(JSON.parse(calls[3].init.body).reason, 'Không phù hợp');
    authState.setGuest();
  } finally {
    globalThis.fetch = originalFetch;
    await vite.close();
  }
});
