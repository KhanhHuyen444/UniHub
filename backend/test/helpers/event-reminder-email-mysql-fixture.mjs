// Test setup only. A newly enqueued job need not already be due: Prisma supplies
// fractional @default(now()) values which MySQL may round up into DATETIME(0).
// Observe database time instead of changing production SQL, clocks or timestamps.
export async function waitForReadyEmailFixture(
  client,
  notificationId,
  {
    timeoutMs = 3500,
    monotonicNow = () => performance.now(),
    pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  const started = monotonicNow();
  let row;
  do {
    [row] = await client.$queryRaw`
      SELECT notification_id, state, next_attempt_at, UTC_TIMESTAMP(3) AS db_now,
        next_attempt_at <= UTC_TIMESTAMP(3) AS ready
      FROM event_reminder_emails WHERE notification_id = ${notificationId}
    `;
    if (!row || row.state !== 'Pending')
      throw new Error(
        `EMAIL_MYSQL_FIXTURE_NOT_PENDING id=${notificationId} state=${row?.state ?? 'missing'}`,
      );
    if (Number(row.ready) === 1) return;
    if (monotonicNow() - started >= timeoutMs) break;
    await pause(25);
  } while (monotonicNow() - started <= timeoutMs);
  throw new Error(
    `EMAIL_MYSQL_FIXTURE_NOT_READY id=${notificationId} next_attempt_at=${row.next_attempt_at.toISOString()} db_now=${row.db_now.toISOString()}`,
  );
}
