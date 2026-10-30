import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../dist/app.js';

// In-memory Prisma fixture: tests HTTP/rules/transaction callback behavior,
// not MySQL locking, constraints, isolation or actual database rollback.
const input = { majorId: 1, academicYear: 2, skillIds: [2], careerGoal: null };
const categories = [
  { category_id: 1, name: 'Major', type: 'Major', status: 'Active' },
  { category_id: 2, name: 'Skill', type: 'Skill', status: 'Active' },
  { category_id: 3, name: 'Closed skill', type: 'Skill', status: 'Closed' },
  { category_id: 4, name: 'Closed major', type: 'Major', status: 'Closed' },
];
async function fixture(options = {}, run) {
  let state = {
    major_id: null,
    academic_year: null,
    career_goal: null,
    skills: [],
    ...options.initial,
  };
  const calls = [];
  let committed = 0;
  const fail = (step) => {
    if (options.fail === step)
      throw Object.assign(new Error('private fixture failure'), {
        code: options.dbCode,
      });
  };
  const client = {
    user: {
      findUnique: async ({ where, select }) => {
        calls.push(where.user_id);
        assert.equal(where.user_id, 42);
        fail('read');
        if (options.missing) return null;
        if (!select.major) return structuredClone(state);
        return {
          ...state,
          major:
            categories.find((c) => c.category_id === state.major_id) ?? null,
          skills: state.skills.map(({ skill_id }) => ({
            skill: categories.find((c) => c.category_id === skill_id),
          })),
        };
      },
      update: async ({ where, data }) => {
        assert.equal(where.user_id, 42);
        Object.assign(state, data);
        fail('update');
      },
    },
    category: {
      findMany: async ({ where }) =>
        categories.filter((c) => where.category_id.in.includes(c.category_id)),
    },
    $queryRaw: async (strings, id) => {
      if (strings.join('').includes('FROM users')) {
        assert.equal(id, 42);
        return [{ user_id: 42 }];
      }
      const row = categories.find((c) => c.category_id === id);
      return [{ ...row, ...(options.race === id ? { status: 'Closed' } : {}) }];
    },
    userSkill: {
      deleteMany: async ({ where }) => {
        assert.equal(where.user_id, 42);
        state.skills = [];
        fail('delete');
      },
      createMany: async ({ data }) => {
        state.skills = data.map(({ user_id, skill_id }) => {
          assert.equal(user_id, 42);
          return { skill_id };
        });
        fail('create');
      },
    },
    $transaction: async (callback, settings) => {
      assert.equal(settings.isolationLevel, 'ReadCommitted');
      const before = structuredClone(state);
      try {
        const result = await callback(client);
        committed++;
        return result;
      } catch (error) {
        state = before;
        throw error;
      }
    },
  };
  const app = createApp({
    profile: {
      getPrismaClient: () => client,
      auth: {
        verifyToken: async (token) => {
          if (token === 'bad.bad.bad') throw new Error('invalid');
          return {
            userId: 42,
            role: token === 'admin.test.token' ? 'Admin' : 'Student',
            sessionId: 'fixture',
          };
        },
        getPrismaClient: () => ({
          authSession: {
            findUnique: async () => ({
              user_id: 42,
              revoked_at: null,
              expires_at: new Date(Date.now() + 60000),
            }),
          },
        }),
      },
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const request = async (
    method = 'GET',
    body,
    token = 'student.test.token',
    suffix = '',
  ) => {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/users/me/profile${suffix}`,
      {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
        ...(body === undefined
          ? {}
          : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
      },
    );
    return { status: response.status, body: await response.json() };
  };
  try {
    await run({
      request,
      calls,
      state: () => state,
      committed: () => committed,
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('Profile GET/PUT use shared Auth and Student role gate', async () => {
  await fixture({}, async ({ request, calls }) => {
    for (const method of ['GET', 'PUT']) {
      for (const [token, status, code] of [
        [null, 401, 'UNAUTHORIZED'],
        ['admin.test.token', 403, 'FORBIDDEN'],
        ['bad.bad.bad', 401, 'UNAUTHORIZED'],
      ]) {
        const r = await request(
          method,
          method === 'PUT' ? input : undefined,
          token,
        );
        assert.equal(r.status, status);
        assert.equal(r.body.error.code, code);
      }
    }
    assert.deepEqual(calls, []);
  });
});
test('empty profile, successful save, exact public response and ownership', async () => {
  await fixture({}, async ({ request }) => {
    assert.deepEqual((await request()).body, {
      profile: {
        major: null,
        academicYear: null,
        skills: [],
        careerGoal: null,
      },
      isComplete: false,
    });
    const r = await request('PUT', { ...input, careerGoal: '  Goal  ' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, {
      profile: {
        major: { id: 1, name: 'Major', status: 'Active' },
        academicYear: 2,
        skills: [{ id: 2, name: 'Skill', status: 'Active' }],
        careerGoal: 'Goal',
      },
      isComplete: true,
    });
    assert.deepEqual((await request()).body, r.body);
    assert.equal(
      (await request('GET', undefined, undefined, '?userId=99')).status,
      400,
    );
    assert.equal(
      (await request('PUT', { ...input, userId: 99 })).body.error.code,
      'INVALID_REQUEST',
    );
  });
});
test('shape, fields, years, IDs, types, duplicates and careerGoal validation', async () => {
  await fixture({}, async ({ request, committed }) => {
    const cases = [
      [{}, 'INVALID_REQUEST'],
      [[], 'INVALID_REQUEST'],
      [{ ...input, role: 'Admin' }, 'INVALID_REQUEST'],
      ...[0, 5, 1.5, '2', null].map((academicYear) => [
        { ...input, academicYear },
        'VALIDATION_ERROR',
      ]),
      ...[0, 2147483648, '1', 99, 2].map((majorId) => [
        { ...input, majorId },
        'INVALID_CATEGORY',
      ]),
      ...[[], [2, 2], [0], ['2'], [99], [1], null].map((skillIds) => [
        { ...input, skillIds },
        'INVALID_SKILL',
      ]),
      ...[5, 'a'.repeat(201)].map((careerGoal) => [
        { ...input, careerGoal },
        'VALIDATION_ERROR',
      ]),
      [{ ...input, majorId: 4 }, 'CATEGORY_NOT_ACTIVE'],
      [{ ...input, skillIds: [3] }, 'SKILL_NOT_ACTIVE'],
    ];
    for (const [body, code] of cases) {
      const r = await request('PUT', body);
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, code, JSON.stringify(body));
    }
    assert.equal((await request('PUT', '{')).body.error.code, 'INVALID_JSON');
    assert.equal(committed(), 0);
    for (const academicYear of [1, 4]) {
      const r = await request('PUT', {
        ...input,
        academicYear,
        careerGoal: '   ',
      });
      assert.equal(r.status, 200);
      assert.equal(r.body.profile.careerGoal, null);
    }
    assert.equal(
      (await request('PUT', { ...input, careerGoal: '😀'.repeat(200) })).status,
      200,
    );
  });
});
test('Closed links returned/preserved; replace removes omitted links and prevents reattachment', async () => {
  await fixture(
    { initial: { major_id: 4, academic_year: 3, skills: [{ skill_id: 3 }] } },
    async ({ request }) => {
      assert.equal((await request()).body.profile.skills[0].status, 'Closed');
      const saved = await request('PUT', {
        ...input,
        majorId: 4,
        skillIds: [2, 3],
      });
      assert.equal(saved.status, 200);
      assert.equal(saved.body.profile.major.status, 'Closed');
      assert.equal((await request('PUT', input)).status, 200);
      assert.deepEqual(
        (await request()).body.profile.skills.map((s) => s.id),
        [2],
      );
      assert.equal(
        (await request('PUT', { ...input, skillIds: [3] })).body.error.code,
        'SKILL_NOT_ACTIVE',
      );
      assert.equal(
        (await request('PUT', { ...input, majorId: 4 })).body.error.code,
        'CATEGORY_NOT_ACTIVE',
      );
    },
  );
});
test('concurrent closure yields 409 and rolls back; existing Closed belongs only to current user', async () => {
  for (const race of [1, 2])
    await fixture({ race }, async ({ request, state, committed }) => {
      const r = await request('PUT', input);
      assert.equal(r.status, 409);
      assert.equal(r.body.error.code, 'CATEGORY_CLOSED');
      assert.equal(state().major_id, null);
      assert.equal(committed(), 0);
    });
});
test('write failures roll back all fixture state and hide internal error details', async () => {
  for (const fail of ['update', 'delete', 'create'])
    await fixture({ fail }, async ({ request, state, committed }) => {
      const before = structuredClone(state());
      const r = await request('PUT', input);
      assert.equal(r.status, 500);
      assert.equal(r.body.error.code, 'INTERNAL_ERROR');
      assert.deepEqual(state(), before);
      assert.equal(committed(), 0);
      assert.ok(!JSON.stringify(r.body).includes('private'));
    });
});
test('database errors are 503, never empty success; missing account is unauthorized', async () => {
  for (const method of ['GET', 'PUT']) {
    await fixture({ fail: 'read', dbCode: 'P1001' }, async ({ request }) => {
      const r = await request(method, method === 'PUT' ? input : undefined);
      assert.equal(r.status, 503);
      assert.equal(r.body.error.code, 'SERVICE_UNAVAILABLE');
    });
    await fixture({ missing: true }, async ({ request }) => {
      assert.equal(
        (await request(method, method === 'PUT' ? input : undefined)).status,
        401,
      );
    });
  }
});
