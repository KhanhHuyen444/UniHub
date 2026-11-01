import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { fileURLToPath } from 'node:url';
let vite, Card;
before(async () => {
  vite = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true },
    logLevel: 'silent',
  });
  ({ RecommendationCard: Card } = await vite.ssrLoadModule(
    '/src/features/recommendations/RecommendationCard.tsx',
  ));
});
after(async () => {
  await vite?.close();
});
const item = {
  id: 1,
  type: 'Thực tập',
  title: 'Boundary',
  publisher: 'Example',
  isVerified: false,
  workFormat: null,
  location: null,
  matchScore: 0.8,
  deadline: {
    precision: 'datetime',
    date: '2026-11-02',
    instant: '2026-11-01T12:30:00Z',
    sourceTimeZone: 'Pacific/Kiritimati',
    state: 'open',
  },
};
const render = (value) =>
  renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(Card, { item: value }),
    ),
  );
test('datetime date and time use source timezone across a UTC day boundary', () => {
  const html = render(item);
  assert.ok(html.includes('02/11/2026'));
  assert.ok(html.includes('02:30'));
  assert.ok(html.includes('Pacific/Kiritimati'));
});
test('unsupported source timezone falls back both date and time to UTC', () => {
  const original = Intl.DateTimeFormat;
  try {
    Intl.DateTimeFormat = function (locale, options) {
      if (options?.timeZone === 'Pacific/Kiritimati')
        throw new RangeError('Unsupported fixture zone');
      return new original(locale, options);
    };
    const html = render(item);
    assert.ok(html.includes('01/11/2026'));
    assert.ok(html.includes('12:30'));
    assert.ok(html.includes('(UTC)'));
    assert.ok(!html.includes('02/11/2026'));
  } finally {
    Intl.DateTimeFormat = original;
  }
});
test('date-only preserves source date and null deadline remains renderable', () => {
  assert.ok(
    render({
      ...item,
      deadline: { ...item.deadline, precision: 'date', sourceTimeZone: null },
    }).includes('02/11/2026'),
  );
  assert.ok(!render({ ...item, deadline: null }).includes('(UTC)'));
});
