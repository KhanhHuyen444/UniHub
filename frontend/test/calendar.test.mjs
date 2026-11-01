import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import {
  calendarRange,
  eventDraft,
  localDate,
  localTime,
  parseEvent,
  parseEvents,
  prepareEvent,
  shiftMonth,
} from '../src/features/calendar/model.ts';

const event = {
  id: 1,
  title: 'Báo cáo',
  dueDate: '2026-10-25T16:59:37Z',
  remindBefore: 24,
  notes: null,
  status: 'Upcoming',
  remindedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};
test('calendar grids cover whole Monday–Sunday weeks, maximum 42 half-open Vietnam days across years/leap years', () => {
  for (let year = 2024; year <= 2028; year++)
    for (let month = 1; month <= 12; month++) {
      const key = `${year}-${String(month).padStart(2, '0')}`,
        range = calendarRange(key);
      assert.ok(range.days.length <= 42 && range.days.length % 7 === 0);
      assert.equal(new Date(range.days[0]).getUTCDay(), 1);
      assert.equal(new Date(range.days.at(-1)).getUTCDay(), 0);
      assert.ok(range.days.includes(`${key}-01`));
      assert.equal(localDate(range.from), range.days[0]);
      assert.equal(new Date(range.from).getUTCHours(), 17);
      assert.equal(
        (Date.parse(range.to) - Date.parse(range.from)) / 86400000,
        range.days.length,
      );
      assert.equal(
        localDate(new Date(Date.parse(range.to) - 1)),
        range.days.at(-1),
      );
      assert.ok(!range.days.includes(localDate(range.to)));
    }
  assert.deepEqual(calendarRange('2026-11'), {
    days: calendarRange('2026-11').days,
    from: '2026-10-25T17:00:00.000Z',
    to: '2026-12-06T17:00:00.000Z',
  });
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
});
test('VN conversion ignores browser timezone, preserves seconds, PATCH contains changed fields only and allows past content edits', () => {
  assert.equal(localDate('2026-10-25T17:00:00Z'), '2026-10-26');
  assert.equal(localTime(event.dueDate), '23:59:37');
  const draft = eventDraft(event);
  assert.deepEqual(
    prepareEvent(draft, event, Date.parse('2026-11-01')).patch,
    {},
  );
  const result = prepareEvent(
    { ...draft, title: '  Đổi tên  ', notes: 'Ghi chú' },
    event,
    Date.parse('2026-11-01'),
  );
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.patch, { title: 'Đổi tên', notes: 'Ghi chú' });
  const changed = prepareEvent(
    { ...draft, date: '2026-11-05', time: '00:00' },
    event,
    Date.parse('2026-11-01'),
  );
  assert.deepEqual(changed.patch, { dueDate: '2026-11-04T17:00:00.000Z' });
  assert.deepEqual(
    prepareEvent(
      { ...eventDraft({ ...event, notes: 'text' }), notes: '' },
      { ...event, notes: 'text' },
    ).patch,
    { notes: null },
  );
});
test('validation rejects blank/long title, invalid dates, equality/past deadlines, fractional/negative/overflow reminder and long notes', () => {
  const draft = {
    title: '  ',
    date: '2026-02-30',
    time: '23:59',
    remindBefore: '-1',
    notes: 'a'.repeat(1001),
  };
  assert.deepEqual(Object.keys(prepareEvent(draft).errors).sort(), [
    'date',
    'notes',
    'remindBefore',
    'title',
  ]);
  for (const remindBefore of ['', '1.5', '2147483648', 'NaN'])
    assert.ok(
      prepareEvent({ ...eventDraft(event), remindBefore }, event).errors
        .remindBefore,
    );
  assert.ok(
    prepareEvent({ ...eventDraft(event), title: 'x'.repeat(256) }, event).errors
      .title,
  );
  assert.ok(
    prepareEvent(eventDraft(event), undefined, Date.parse(event.dueDate)).errors
      .date,
  );
  assert.ok(
    !prepareEvent(eventDraft(event), undefined, Date.parse(event.dueDate) - 1)
      .errors.date,
  );
});
test('DTO parser rejects malformed items and duplicate IDs instead of silently displaying empty', () => {
  assert.deepEqual(parseEvent(event), event);
  assert.deepEqual(parseEvents({ items: [] }), []);
  for (const value of [
    null,
    {},
    { items: [event, event] },
    ...[
      { status: 'Unknown' },
      { id: 0 },
      { notes: 42 },
      { dueDate: '2026-02-30T00:00:00Z' },
      { remindBefore: 1.5 },
    ].map((v) => ({ items: [{ ...event, ...v }] })),
  ])
    assert.throws(() => parseEvents(value), { code: 'INVALID_RESPONSE' });
});

let vite, api, auth, fetcher;
const originalFetch = globalThis.fetch;
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
before(async () => {
  globalThis.fetch = (...args) => fetcher(...args);
  vite = await createServer({
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true },
  });
  api = await vite.ssrLoadModule('/src/features/calendar/api.ts');
  auth = await vite.ssrLoadModule('/src/features/auth/auth-state.ts');
  auth.setAuthenticated('calendar-test-token', { id: 1, role: 'Student' });
});
after(async () => {
  globalThis.fetch = originalFetch;
  await vite?.close();
});

test('PublicLayout exposes Calendar only to authenticated Students and preserves public links', async () => {
  const { PublicLayout } = await vite.ssrLoadModule(
    '/src/layouts/PublicLayout.tsx',
  );
  const { AuthProvider } = await vite.ssrLoadModule(
    '/src/features/auth/AuthProvider.tsx',
  );
  for (const role of [null, 'Student', 'Admin']) {
    if (role)
      auth.setAuthenticated('test-token', {
        id: 1,
        role,
        fullName: 'Test',
        email: 'test@example.invalid',
        avatarUrl: null,
      });
    else auth.setGuest();
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(
          AuthProvider,
          null,
          createElement(PublicLayout, null, 'Content'),
        ),
      ),
    );
    const nav = html.match(/<nav[\s\S]*?<\/nav>/)[0];
    assert.equal(nav.includes('href="/calendar"'), role === 'Student');
    for (const path of ['/', '/opportunities', '/roadmaps', '/forum'])
      assert.ok(nav.includes(`href="${path}"`));
  }
  auth.setAuthenticated('calendar-test-token', { id: 1, role: 'Student' });
});
test('all six endpoints use shared authenticated client with exact payloads, signal and no ownership fields', async () => {
  const signal = new AbortController().signal;
  const input = prepareEvent(eventDraft(event), undefined, 0).input;
  const range = calendarRange('2026-11');
  const cases = [
    [
      () => api.listEvents(range.from, range.to, signal),
      'GET',
      '/api/events',
      undefined,
      { items: [event] },
    ],
    [
      () => api.createEvent(input, signal),
      'POST',
      '/api/events',
      input,
      { event },
    ],
    [
      () => api.getEvent(1, signal),
      'GET',
      '/api/events/1',
      undefined,
      { event },
    ],
    [
      () => api.editEvent(1, { notes: null }, signal),
      'PATCH',
      '/api/events/1',
      { notes: null },
      { event },
    ],
    [
      () => api.completeEvent(1, signal),
      'PATCH',
      '/api/events/1/status',
      { status: 'Completed' },
      { event: { ...event, status: 'Completed' } },
    ],
    [
      () => api.deleteEvent(1, signal),
      'DELETE',
      '/api/events/1',
      undefined,
      undefined,
    ],
  ];
  for (const [call, method, path, body, response] of cases) {
    fetcher = async (url, options) => {
      const parsed = new URL(url, 'http://test.invalid');
      assert.equal(parsed.pathname, path);
      assert.equal(options.method, method);
      assert.equal(
        options.headers.get('Authorization'),
        'Bearer calendar-test-token',
      );
      assert.equal(options.signal, signal);
      assert.deepEqual(
        options.body === undefined ? undefined : JSON.parse(options.body),
        body,
      );
      assert.deepEqual(
        [...parsed.searchParams.keys()],
        method === 'GET' && path === '/api/events' ? ['from', 'to'] : [],
      );
      if (parsed.search) {
        assert.equal(parsed.searchParams.get('from'), range.from);
        assert.equal(parsed.searchParams.get('to'), range.to);
      }
      return response === undefined
        ? new Response(null, { status: 204 })
        : json(response);
    };
    await call();
  }
});
test('shared auth refresh retries expired access; HTTP, network, malformed response and abort remain errors', async () => {
  let calls = 0;
  fetcher = async (url, options) => {
    if (url === '/api/auth/refresh')
      return json({
        accessToken: 'refreshed-calendar-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 1,
          fullName: 'Test Student',
          email: 'student@test.invalid',
          avatarUrl: null,
          role: 'Student',
        },
      });
    if (url === '/api/auth/me')
      return json({
        user: {
          id: 1,
          fullName: 'Test Student',
          email: 'student@test.invalid',
          avatarUrl: null,
          role: 'Student',
        },
      });
    calls++;
    return calls === 1
      ? json({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401)
      : json({ items: [] });
  };
  assert.deepEqual(await api.listEvents('from', 'to'), []);
  assert.equal(calls, 2);
  for (const [status, code] of [
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [400, 'VALIDATION_ERROR'],
    [503, 'SERVICE_UNAVAILABLE'],
    [500, 'INTERNAL_ERROR'],
  ]) {
    fetcher = async () =>
      json({ error: { code, message: 'Test error' } }, status);
    await assert.rejects(api.getEvent(1), { status, code });
  }
  fetcher = async () => json({ items: null });
  await assert.rejects(api.listEvents('from', 'to'), {
    code: 'INVALID_RESPONSE',
  });
  fetcher = async () => {
    throw new Error('Network');
  };
  await assert.rejects(api.getEvent(1), { code: 'NETWORK_ERROR' });
  const abort = new DOMException('Aborted', 'AbortError');
  fetcher = async () => {
    throw abort;
  };
  await assert.rejects(api.getEvent(1), (e) => e === abort);
});
