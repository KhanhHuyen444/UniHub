import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  parseProfile,
  toForm,
  toInput,
  validateForm,
} from '../src/features/profile/contracts.ts';
import { getProfile, saveProfile } from '../src/features/profile/api.ts';
import { setAuthenticated, setGuest } from '../src/features/auth/auth-state.ts';
import { roleGateState } from '../src/features/auth/role-access.ts';
import { isCurrentProfileSession } from '../src/features/profile/session.ts';

test('late Profile results cannot update another account, Guest, Admin or aborted request', () => {
  const controller = new AbortController();
  setAuthenticated('first', user);
  assert.equal(isCurrentProfileSession(42, controller.signal), true);
  setAuthenticated('second', { ...user, id: 99 });
  assert.equal(isCurrentProfileSession(42, controller.signal), false);
  setGuest();
  assert.equal(isCurrentProfileSession(42, controller.signal), false);
  setAuthenticated('admin', { ...user, role: 'Admin' });
  assert.equal(isCurrentProfileSession(42, controller.signal), false);
  setAuthenticated('first', user);
  controller.abort();
  assert.equal(isCurrentProfileSession(42, controller.signal), false);
});
const original = globalThis.fetch;
const user = {
  id: 42,
  email: 'test@example.invalid',
  fullName: 'Test',
  avatarUrl: null,
  role: 'Student',
};
const response = {
  profile: {
    major: { id: 1, name: 'Major', status: 'Closed' },
    academicYear: 2,
    skills: [{ id: 3, name: 'Closed skill', status: 'Closed' }],
    careerGoal: null,
  },
  isComplete: true,
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
afterEach(() => {
  globalThis.fetch = original;
  setGuest();
});
test('Profile validation, normalization and Closed IDs survive form submission', () => {
  const form = toForm(parseProfile(response).profile);
  assert.deepEqual(validateForm(form), {});
  assert.deepEqual(toInput({ ...form, careerGoal: '  Goal  ' }), {
    majorId: 1,
    academicYear: 2,
    skillIds: [3],
    careerGoal: 'Goal',
  });
  for (const patch of [
    { majorId: '' },
    { academicYear: '0' },
    { academicYear: '5' },
    { skillIds: [] },
    { skillIds: [3, 3] },
    { careerGoal: 'a'.repeat(201) },
  ])
    assert.ok(Object.keys(validateForm({ ...form, ...patch })).length);
  assert.equal(toInput({ ...form, careerGoal: '   ' }).careerGoal, null);
});
test('Profile parser distinguishes empty profile from invalid data and projects public fields', () => {
  assert.equal(
    parseProfile({
      profile: {
        major: null,
        academicYear: null,
        skills: [],
        careerGoal: null,
      },
      isComplete: false,
    }).isComplete,
    false,
  );
  for (const v of [
    null,
    {},
    { ...response, isComplete: false },
    {
      ...response,
      profile: {
        ...response.profile,
        skills: [...response.profile.skills, ...response.profile.skills],
      },
    },
  ])
    assert.throws(() => parseProfile(v));
  assert.deepEqual(parseProfile({ ...response, private: 'secret' }), response);
});
test('Profile GET/PUT use existing protected client, exact body and abort signal', async () => {
  setAuthenticated('fixture-token', user);
  const controller = new AbortController();
  const calls = [];
  globalThis.fetch = async (path, init) => {
    calls.push({ path, init });
    return json(response);
  };
  assert.deepEqual(await getProfile(controller.signal), response);
  await saveProfile(toInput(toForm(response.profile)), controller.signal);
  assert.equal(calls[0].path, '/api/users/me/profile');
  assert.equal(calls[0].init.body, undefined);
  assert.equal(calls[1].init.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    majorId: 1,
    academicYear: 2,
    skillIds: [3],
    careerGoal: null,
  });
  assert.equal(calls[1].init.signal, controller.signal);
  assert.equal(
    calls[1].init.headers.get('Authorization'),
    'Bearer fixture-token',
  );
});
test('Profile preserves server fieldErrors, network failure and invalid responses', async () => {
  setAuthenticated('fixture-token', user);
  const fieldErrors = [
    {
      source: 'body',
      field: 'skillIds',
      code: 'INVALID_SKILL',
      message: 'Kỹ năng không hợp lệ.',
    },
  ];
  globalThis.fetch = async () =>
    json(
      {
        error: { code: 'VALIDATION_ERROR', message: 'Validation', fieldErrors },
      },
      400,
    );
  await assert.rejects(
    saveProfile(toInput(toForm(response.profile))),
    (e) =>
      e.status === 400 &&
      JSON.stringify(e.fieldErrors) === JSON.stringify(fieldErrors),
  );
  globalThis.fetch = async () => {
    throw new TypeError('private');
  };
  await assert.rejects(getProfile(), (e) => e.code === 'NETWORK_ERROR');
  globalThis.fetch = async () => json({});
  await assert.rejects(getProfile(), (e) => e.code === 'INVALID_RESPONSE');
});
test('Profile uses existing refresh flow on 401', async () => {
  setAuthenticated('old-token', user);
  let calls = 0;
  globalThis.fetch = async (path) => {
    if (path === '/api/auth/refresh')
      return json({
        accessToken: 'new-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        user,
      });
    if (path === '/api/auth/me') return json({ user });
    return ++calls === 1
      ? json({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401)
      : json(response);
  };
  assert.deepEqual(await getProfile(), response);
  assert.equal(calls, 2);
});
test('Student guard denies Guest/Admin and waits for session restoration', () => {
  assert.equal(roleGateState('guest', null, 'Student'), 'login');
  assert.equal(roleGateState('authenticated', 'Admin', 'Student'), 'forbidden');
  assert.equal(roleGateState('restoring', null, 'Student'), 'pending');
});
