import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hubDeadlineLabel } from '../src/features/opportunities/hub-deadline.ts';

const deadline = {
  precision: 'date',
  date: '2026-11-15',
  sourceTimeZone: null,
  instant: '2026-11-15T17:00:00Z',
  state: 'open',
};
test('date-only counts Vietnam calendar days, not 24-hour periods or cutoff day', () => {
  assert.match(
    hubDeadlineLabel(deadline, '2026-11-10T16:59:59Z').text,
    /Còn 5 ngày/,
  );
  assert.match(
    hubDeadlineLabel(deadline, '2026-11-10T17:00:00Z').text,
    /Còn 4 ngày/,
  );
  for (const instant of ['2026-11-14T17:00:00Z', '2026-11-15T16:59:59Z'])
    assert.match(
      hubDeadlineLabel(deadline, instant).text,
      /Hôm nay \(15\/11\/2026\)/,
    );
});
test('warning threshold includes day 7 and excludes day 8', () => {
  assert.equal(
    hubDeadlineLabel(deadline, '2026-11-08T03:00:00Z').variant,
    'warning',
  );
  assert.equal(
    hubDeadlineLabel(deadline, '2026-11-07T03:00:00Z').variant,
    'plain',
  );
});
test('server expiry remains authoritative, including exact date-only cutoff', () => {
  const expired = { ...deadline, state: 'expired' };
  assert.match(hubDeadlineLabel(expired, deadline.instant).text, /Đã hết hạn/);
  assert.equal(
    hubDeadlineLabel(expired, '2020-01-01T00:00:00Z').variant,
    'error',
  );
  assert.equal(
    hubDeadlineLabel(deadline, '2030-01-01T00:00:00Z').variant,
    'plain',
  );
});
test('datetime uses source timezone calendar and equality remains open', () => {
  const timed = {
    ...deadline,
    precision: 'datetime',
    sourceTimeZone: 'America/Los_Angeles',
    instant: '2026-11-16T04:00:00Z',
  };
  assert.match(hubDeadlineLabel(timed, '2026-11-15T20:00:00Z').text, /Hôm nay/);
  assert.match(hubDeadlineLabel(timed, timed.instant).text, /Hôm nay/);
  assert.equal(
    hubDeadlineLabel({ ...timed, state: 'expired' }, '2026-11-16T04:00:01Z')
      .variant,
    'error',
  );
});
test('calendar counting handles leap days and year boundaries', () => {
  assert.match(
    hubDeadlineLabel(
      { ...deadline, date: '2028-03-01', instant: '2028-03-01T17:00:00Z' },
      '2028-02-28T03:00:00Z',
    ).text,
    /Còn 2 ngày/,
  );
  assert.match(
    hubDeadlineLabel(
      { ...deadline, date: '2027-01-01', instant: '2027-01-01T17:00:00Z' },
      '2026-12-31T03:00:00Z',
    ).text,
    /Còn 1 ngày/,
  );
});
test('null, legacy unknown and invalid date/instant/evaluatedAt never emit countdown or NaN', () => {
  assert.equal(hubDeadlineLabel(null, '2026-11-10T03:00:00Z'), null);
  assert.equal(
    hubDeadlineLabel(
      {
        precision: 'unknown',
        instant: deadline.instant,
        date: null,
        state: 'unknown',
        sourceTimeZone: null,
      },
      '2026-11-10T03:00:00Z',
    ),
    null,
  );
  for (const value of [
    'invalid',
    '2026-02-30T00:00:00Z',
    '2026-11-10T24:00:00Z',
  ]) {
    assert.equal(hubDeadlineLabel(deadline, value), null);
    assert.equal(
      hubDeadlineLabel({ ...deadline, instant: value }, '2026-11-10T03:00:00Z'),
      null,
    );
  }
  assert.equal(
    hubDeadlineLabel(
      { ...deadline, date: '2026-02-30' },
      '2026-11-10T03:00:00Z',
    ),
    null,
  );
  assert.equal(
    hubDeadlineLabel(
      { ...deadline, precision: 'datetime', sourceTimeZone: 'bad/zone' },
      '2026-11-10T03:00:00Z',
    ).variant,
    'plain',
  );
});
