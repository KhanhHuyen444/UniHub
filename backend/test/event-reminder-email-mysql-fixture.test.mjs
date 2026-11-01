import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { waitForReadyEmailFixture } from './helpers/event-reminder-email-mysql-fixture.mjs';

test('fixture waits through DATETIME(0) rounding using DB readiness, without fixture DML', async () => {
  const base = Date.parse('2026-11-01T00:00:00Z');
  let databaseTime = base + 700,
    elapsed = 0,
    probes = 0;
  // A .700 value rounded into a zero-precision column is not due until :01.
  const stored = base + 1000;
  const client = {
    $queryRaw: async (strings, id) => {
      probes++;
      assert.equal(id, 42);
      const sql = strings.join('?');
      assert.match(sql, /next_attempt_at <= UTC_TIMESTAMP\(3\) AS ready/);
      assert.match(sql, /WHERE notification_id = \?/);
      assert.doesNotMatch(sql, /FOR UPDATE|UPDATE |INSERT |DELETE /);
      return [
        {
          notification_id: id,
          state: 'Pending',
          next_attempt_at: new Date(stored),
          db_now: new Date(databaseTime),
          ready: BigInt(databaseTime >= stored),
        },
      ];
    },
    $executeRaw: () =>
      assert.fail('Readiness setup must not rewrite timestamps'),
  };
  await waitForReadyEmailFixture(client, 42, {
    monotonicNow: () => elapsed,
    pause: async (ms) => {
      elapsed += ms;
      databaseTime += ms;
    },
  });
  assert.equal(elapsed, 300);
  assert.equal(probes, 13);
});

test('an already due fixture proceeds immediately', async () => {
  await waitForReadyEmailFixture(
    {
      $queryRaw: async () => [{ state: 'Pending', ready: 1 }],
    },
    42,
    { pause: () => assert.fail('No wait needed') },
  );
});

test('missing or non-Pending jobs fail instead of disguising invalid setup as a claim-plan failure', async () => {
  for (const rows of [
    [],
    [{ state: 'Dead', ready: 1 }],
    [{ state: 'Processing', ready: 1 }],
  ])
    await assert.rejects(
      waitForReadyEmailFixture({ $queryRaw: async () => rows }, 42),
      /FIXTURE_NOT_PENDING/,
    );
});

test('a persistently future fixture fails with database timestamps at a bounded deadline', async () => {
  let elapsed = 0;
  await assert.rejects(
    waitForReadyEmailFixture(
      {
        $queryRaw: async () => [
          {
            state: 'Pending',
            ready: 0,
            next_attempt_at: new Date('2026-11-02Z'),
            db_now: new Date('2026-11-01Z'),
          },
        ],
      },
      42,
      {
        timeoutMs: 50,
        monotonicNow: () => elapsed,
        pause: async (ms) => {
          elapsed += ms;
        },
      },
    ),
    /FIXTURE_NOT_READY.*next_attempt_at=.*db_now=/,
  );
  assert.equal(elapsed, 50);
});

test('generated Prisma create supplies next_attempt_at rather than relying on the SQL column default (fake adapter only)', async () => {
  const captured = [];
  const capture = async (query) => {
    captured.push(query);
    if (/^INSERT/.test(query.sql)) throw new Error('FAKE_INSERT_CAPTURE_STOP');
    return { columnNames: [], columnTypes: [], rows: [] };
  };
  const connection = {
    provider: 'mysql',
    adapterName: 'fake-only-capture',
    queryRaw: capture,
    executeRaw: capture,
    dispose: async () => {},
    getConnectionInfo: () => ({ supportsRelationJoins: false }),
    startTransaction: async () => ({
      ...connection,
      options: { usePhantomQuery: false },
      commit: async () => {},
      rollback: async () => {},
    }),
  };
  // This factory never opens a socket; its INSERT is stopped before any execution.
  const client = new PrismaClient({
    adapter: {
      provider: 'mysql',
      adapterName: 'fake-only-capture',
      connect: async () => connection,
    },
  });
  try {
    await assert.rejects(
      client.eventReminderEmail.create({
        data: {
          notification_id: 42,
          payload_json: '{}',
          idempotency_key: 'fake-only',
        },
      }),
      /FAKE_INSERT_CAPTURE_STOP/,
    );
    const insert = captured.find((query) => /^INSERT/.test(query.sql));
    assert.ok(insert);
    const columns = insert.sql
      .match(/\(([^)]+)\) VALUES/)[1]
      .split(',')
      .map((name) => name.replaceAll('`', ''));
    const position = columns.indexOf('next_attempt_at');
    assert.ok(position >= 0, 'Prisma currently materializes @default(now())');
    assert.equal(insert.argTypes[position].scalarType, 'datetime');
    assert.ok(insert.args[position] instanceof Date);
    assert.match(
      insert.args[position].toISOString(),
      /^\d{4}-\d\d-\d\dT.*\.\d{3}Z$/,
    );
  } finally {
    await client.$disconnect();
  }
});
