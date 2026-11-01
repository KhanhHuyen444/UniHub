# Phase 4.1 — hardened isolated MySQL 8.4 email integration harness

Status: **prepared, not executed against MySQL**. Build, syntax checks, guard unit
tests and fake-only mail tests are separate evidence. No production rollout is
approved by this document or a passing integration run.

This follows the repository's native Windows disposable-MySQL runner convention.
It does not use Docker, Windows MySQL services, a development database, `.env`,
`DATABASE_URL`, or an externally supplied test database. No new dependency or npm
script is required.

## Prerequisites before an authorized integration run

- Review/approve running the existing migration draft **only on a newly created
  disposable instance**. This preparation task has not applied it anywhere.
- Windows PowerShell, Node **24.19.0 or later within major 24**, npm 11.9+ within
  major 11, and repository dependencies installed from the root lockfile.
- Native MySQL **8.4.x** binaries: `mysqld.exe`, `mysql.exe`.
  `mysqladmin.exe` is no longer used or required. The harness checks the actual
  server version and identity; installing a client
  or seeing a binary path is not evidence that MySQL 8.4 is installed.
- Permission to start a private native `mysqld.exe`, bind an unused loopback port
  other than 3306, and write a fresh directory under the Windows temporary folder.
  No service administration or access to a personal/group database is needed.
- A backend build generating Prisma Client from the unchanged local Phase 1 schema,
  with the Prisma Windows migration engine already installed/cached.
- npm must have its CLI at `node_modules/npm/bin/npm-cli.js` beside `node.exe`;
  unsupported/custom installation layouts fail closed. The runner requires the
  installed `node_modules/@prisma/engines/schema-engine-windows.exe` and passes
  that exact engine to Prisma, rather than downloading a missing engine.
- An operator available to inspect the test report and the stopped-instance manifest.
  Do not provide real Resend credentials or real user data.

## Setup and execution from the repository root

These are future operator instructions, **not commands executed during harness
preparation**. Do not run them until isolated integration testing is authorized.

```powershell
Set-Location C:\Users\LENOVO\UniHub
node --version
npm.cmd --version
# If dependencies have not been installed: npm.cmd ci
npm.cmd run build --workspace @unihub/backend

$env:TV4_MYSQL_BIN = 'C:\Program Files\MySQL\MySQL Server 8.4\bin'
Get-Item -LiteralPath (Join-Path $env:TV4_MYSQL_BIN 'mysqld.exe')
Get-Item -LiteralPath (Join-Path $env:TV4_MYSQL_BIN 'mysql.exe')
$env:NODE_ENV = 'test'
$env:UNIHUB_EMAIL_MYSQL_TEST = 'disposable-mysql84'
node backend/test/run-event-reminder-email-mysql.mjs --run-isolated
$integrationExit = $LASTEXITCODE
Write-Output "Integration exit code: $integrationExit"
```

Use a fresh PowerShell session with no development credentials for this run.
The runner refuses environment variable names containing `DATABASE_URL`,
`TEST_*URL`/`TEST_*IDENTITY`, `MYSQL*`, `PRISMA_*`, `RESEND_*`, `NODE_OPTIONS`,
or `NODE_PATH`, even when empty. It never reads `.env` files. Do not copy or
print secret values while preparing the session. If any of the four
`TEST_EVENT_REMINDER_EMAIL_*` variables below already exists, the runner refuses;
do not copy a development URL into them. The runner generates them exclusively
for its child test process:

- `TEST_EVENT_REMINDER_EMAIL_DATABASE_URL`: restricted runtime credentials.
- `TEST_EVENT_REMINDER_EMAIL_DENIED_URL`: a second account without outbox access,
  used to prove scheduler rollback on a genuine permission failure.
- `TEST_EVENT_REMINDER_EMAIL_ADMIN_URL`: ephemeral root account for synthetic
  fixtures, metadata assertions and test-only timestamp manipulation.
- `TEST_EVENT_REMINDER_EMAIL_MYSQL_IDENTITY`: database nonce, port, server UUID,
  data-directory hash and migration checksums, with no passwords.

Do not invoke the integration test directly with hand-crafted variables. Without
opt-in it is skipped; with incomplete/unsafe opt-in it fails before opening a
client. Normal fake-only testing requires none of these variables.

## Safety boundaries and lifecycle

1. Explicit `--run-isolated`, `NODE_ENV=test` and the exact opt-in string are all
   required before provisioning. Merely discovering/importing the runner does not
   provision a server.
2. The runner creates a fresh temporary **artifact directory** containing a sibling
   `harness-manifest.json` and an initially empty `data` subdirectory. Only `data`
   is passed to `mysqld --initialize-insecure --no-defaults` (with `--no-defaults`
   first). No manifest or other harness file is written inside `data` before initialization.
   Insecure initialization applies only to that new instance, bound to 127.0.0.1;
   a random root password is installed immediately after identity verification.
3. After initialization a loopback listener reserves a random port until immediately
   before spawning mysqld. Native mysqld cannot inherit that Node listener, so a
   release/start race remains. A read-only probe can reach an unrelated service;
   there is **no absolute guarantee against connecting** to another local endpoint.
   A mismatched identity aborts immediately without releasing privileged SQL.
   Before **each** bootstrap write, the server must match its generated port, fresh
   `auto.cnf` UUID, data directory and MySQL 8.4 version. A wrong server receives no
   bootstrap SQL. Probe and bootstrap write share one mysql session with automatic
   reconnect disabled. The owned child must also still be alive. Immediately before
   and after migration deployment the runner probes identity again. Prisma opens
   separate authenticated connections: those connections and the test clients' pools
   are not cryptographically pinned to the earlier probe. Random instance-only
   passwords limit accidental endpoint substitution; a hostile local administrator,
   forged identity or compromised binaries are outside this boundary.
   CLI connections also use `--no-login-paths` so personal `.mylogin.cnf` credentials
   are not read.
4. It creates `unihub_email_test_<16 hex characters>` and applies the existing
   repository migrations, unchanged, using an ephemeral migration URL. Neither the
   migration files nor the Prisma schema is edited. Migration checksums and
   initially empty business tables are verified by the tests. Before provisioning,
   the runner requires exactly these four migration directories and snapshots their
   checksums; it checks contents again after deployment:
   `20261025000000_initial_schema`,
   `20261026150000_add_opportunity_deadline_metadata`,
   `20261028170000_add_auth_identity_sessions`,
   `20261031000000_add_event_reminder_emails`.
   These create the base tables, alter opportunities/users, and create auth sessions
   and the draft outbox. Event-to-notification and notification-to-outbox deletions
   cascade. There is no seed, backfill, global configuration change or cross-schema
   SQL in the reviewed migrations. Checksums are consistency checks, not approval
   of arbitrary edits; do not edit migrations during a run. Failed DDL may remain
   partially applied in this disposable instance; retain it for inspection.
5. Runtime accounts have only the tested table grants. Job DELETE/DDL and activity
   log UPDATE/DELETE must fail. Fixture cleanup uses the verified disposable admin
   account; `activity_logs` remains empty and is never purged or updated.
6. Every test connection first verifies database, server identity, version and
   account using a read-only probe. No clients are exposed to fixture code until
   all connections pass. A reused nonempty schema is rejected before fixture DML.
7. Child processes inherit only required Windows environment settings, not
   development URLs, credentials, provider keys or `NODE_OPTIONS` preloads. The
   test module disables global fetch and constructs the worker only with a fake
   `MailTransport`. It never constructs the configured production worker.
8. Child output is captured and generated credentials are redacted before display;
   credentials are never printed in arguments or written to the cleanup manifest.
9. Finally, graceful `SHUTDOWN` SQL is released only after a fresh identity probe on
   the **same** mysql session; there is no `mysqladmin shutdown` reconnect. If that
   fails or the owned child remains alive, only the original `ChildProcess` object
   is terminated after a bounded wait. On Windows that fallback is forced, not
   graceful. No service command, PID lookup or process-name termination is used.
   SIGINT/SIGTERM handlers, where delivered by Node/Windows, cancel active helpers
   and unwind into this cleanup. Repeated signals may force fallback termination.
   UUID/port/datadir are recorded before startup and PID immediately after spawn.
   Exit must be observed; a successful `kill()` return alone never means stopped.
   Files are retained for
   inspection. The password-free manifest reports `stopped`; a false value means
   shutdown was not established and cleanup must wait for operator verification.
   Console closure, power loss, hard termination and descendant Prisma engine
   processes cannot be fully handled by JavaScript signal handlers. A stale manifest
   is not proof of process liveness; inspect the exact process executable, creation
   time and command line before any manual intervention. Never stop a process just
   because its PID matches an old manifest.

These guards prevent accidental targeting, not deliberate circumvention by someone
who forges all guard inputs. Do not reuse the harness with restored real data.

## Coverage and interpretation

The suite uses independent Prisma clients and real MySQL sessions for:

- Fresh migration creation/history/checksums, native types, indexes, all CHECK
  families, PK/unique/FK enforcement and cascading Notification/Event deletion.
- Atomic scheduler rollback on actual denied outbox access, a real CHECK failure,
  and invalid recipient; concurrent scheduler deduplication.
- A held primary-key row lock while another connection skips it, plus overlapping
  real claim transactions. The latter must fail if a LIMIT/filesort plan locks all
  eligible jobs and prevents independent claims. Such a failure is evidence to
  review, not a reason to weaken the assertion or modify production code here.
- Lease expiry/recovery, stale tokens, acceptance-vs-recovery commit ordering and
  safe post-commit diagnostics. Test-only lease timestamps avoid a 60-second sleep.
- Calendar title/notes, deadline, reminder-setting, completion and deletion races
  during a held preflight and while fake provider acceptance is pending. Lock-wait
  assertions use this private server's `performance_schema`.
- Six claims, each backoff, early-retry refusal, frozen body/key reuse, eligibility
  cancellation and the 23-hour cutoff. Retry timestamps are advanced only on
  synthetic job rows; the server clock and production policy are never changed.
- UTC sessions/DATETIME mapping, integer mapping, parameterized hostile strings
  and the runtime privilege boundary.

Barriers/time bounds make lock failures actionable but still depend on the local
machine being responsive. Preserve failing output for review. The tests cover a
fresh migration deploy, not a legacy populated-database upgrade, server failover,
replication, load/NFR certification or actual provider behavior/delivery.

The approved race limitation remains: after preflight commits, Calendar changes
cannot retract an issued request. Completion after fake acceptance can leave an
Accepted job; deletion leaves no job and stale settlement returns false. Accepted
never means inbox delivery. Production SQL/state-machine fixes require separate
approval if these tests expose a problem.

## Static and fake-only checks (no MySQL)

```powershell
npm.cmd run build --workspace @unihub/backend
node --check backend/test/run-event-reminder-email-mysql.mjs
node --check backend/test/event-reminder-email-mysql.test.mjs
node --check backend/test/helpers/event-reminder-email-mysql-guard.mjs
node --check backend/test/helpers/event-reminder-email-mysql-lifecycle.mjs
node --test backend/test/event-reminder-email-mysql-guard.test.mjs backend/test/event-reminder-email-mysql-lifecycle.test.mjs backend/test/mail-transport.test.mjs backend/test/reminder-email-worker.test.mjs backend/test/reminder-email.test.mjs backend/test/reminders.test.mjs backend/test/shutdown.test.mjs
node node_modules/prettier/bin/prettier.cjs --check backend/test/run-event-reminder-email-mysql.mjs backend/test/helpers/event-reminder-email-mysql-lifecycle.mjs backend/test/event-reminder-email-mysql-lifecycle.test.mjs docs/event-reminder-email-mysql-testing.md
git diff --check
```

## Cleanup in PowerShell

The runner prints the exact manifest path. Normally it has already stopped its
private server. Inspect that manifest and server log first. If `stopped=false`,
verify/stop **only that private process** before proceeding; do not remove live
database files or stop an existing MySQL service.

After a confirmed stop, replace the placeholder below with the printed path:

```powershell
$manifestPath = 'PASTE THE EXACT PRINTED harness-manifest.json PATH'
$testManifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$target = [IO.Path]::GetFullPath($testManifest.artifacts).TrimEnd('\')
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
# Use the same layout guard covered by the fake-only lifecycle tests.
node --input-type=module -e "import { readFileSync } from 'node:fs'; import { assertCleanupLayout } from './backend/test/helpers/event-reminder-email-mysql-lifecycle.mjs'; assertCleanupLayout(process.argv[1], JSON.parse(readFileSync(process.argv[1], 'utf8')), process.argv[2]);" $manifestPath $tempRoot
if ($LASTEXITCODE -ne 0) { throw 'Cleanup layout guard refused.' }
if ($testManifest.owner -ne 'unihub-event-reminder-email-tests' -or
    $testManifest.stopped -ne $true -or
    [IO.Path]::GetDirectoryName($target) -ne $tempRoot -or
    [IO.Path]::GetFullPath([IO.Path]::GetDirectoryName($manifestPath)) -ne $target -or
    [IO.Path]::GetFileName($manifestPath) -ne 'harness-manifest.json' -or
    [IO.Path]::GetFullPath($testManifest.datadir) -ne (Join-Path $target 'data') -or
    [IO.Path]::GetFileName($target) -notmatch '^unihub-email-mysql-[A-Za-z0-9]+$') {
    throw 'Refusing cleanup: target is not the confirmed stopped disposable directory.'
}
# Refuse any extant PID conservatively, including a reused PID. Never stop it here.
if ($testManifest.pid -and (Get-Process -Id $testManifest.pid -ErrorAction SilentlyContinue)) {
    throw 'Refusing cleanup: manifest PID exists; operator verification required.'
}
# Check ancestors BEFORE enumerating descendants, so junctions cannot redirect traversal.
$ancestor = Get-Item -LiteralPath $target -Force
while ($null -ne $ancestor) {
    if (($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Refusing cleanup through a reparse point.'
    }
    $ancestor = $ancestor.Parent
}
$pending = [Collections.Generic.Stack[string]]::new()
$pending.Push($target)
while ($pending.Count -gt 0) {
    foreach ($item in Get-ChildItem -LiteralPath $pending.Pop() -Force -ErrorAction Stop) {
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'Refusing cleanup containing a reparse point.'
        }
        if ($item.PSIsContainer) { $pending.Push($item.FullName) }
    }
}
Write-Output $target
Remove-Item -LiteralPath $target -Recurse
Remove-Item Env:UNIHUB_EMAIL_MYSQL_TEST -ErrorAction SilentlyContinue
Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
Remove-Item Env:TV4_MYSQL_BIN -ErrorAction SilentlyContinue
```

Delete the artifact directory, never just `data` or the Windows temp root. The
checks intentionally refuse junction-based temp locations. Run cleanup only after
operator inspection in a trusted local filesystem; path checks cannot prevent a
hostile concurrent replacement between verification and deletion. No cleanup
command starts, connects to, or stops MySQL. The fake lifecycle suite checks layout
refusals and shutdown targeting with injected objects; it does not certify Windows
filesystem or native MySQL behavior.

No development database is dropped. A fresh run gets a new directory, schema,
namespace, credentials and nonce; never reuse a failed run's credentials as app
configuration. Integration tests must be executed and reviewed before any claim
that real MySQL email behavior passes.

## Phase 4.2 safety gate (Windows; pending independent audit)

The harness now retains every owned ChildProcess, including the initializer and
version/migration/test helpers. Only an observed exit or a confirmed spawn failure
establishes that a process cannot access the datadir. A close event describes
output drainage, and a successful kill request does not establish termination.
The manifest records per-process exit, spawn failure, close and kill-failure state.
Any uncertain process keeps stopped=false and all artifacts must be preserved.
Signals use only owned child handles; there is no PID lookup, service stop,
process-group kill or taskkill. Exited handles are never signalled again.

Commands have a 120-second execution deadline (identity probes 3 seconds;
shutdown SQL 4 seconds). Shutdown has a 5-second graceful-operation deadline,
a 5-second exit wait and a 5-second forced-termination wait. Output closure has a
separate 1-second deadline. Reservation release has a 5-second deadline. Missing
close events fail the helper without treating an exited process as alive.
Uncertain processes and pipe handles are detached after recording their state;
this does not claim that they stopped. Inspect every manifest process before
manual cleanup; do not terminate a PID merely because it appears in a manifest.

Preflight checks all backend imports/exports used by the integration test and the
generated EventReminderEmail Prisma model before creating MySQL artifacts. It
imports definitions only, never calls a client/worker factory, and never imports
the server or scheduler. Missing dependencies or stale generated output fail early.

The four migration names and SHA-256 digests are pinned in
backend/test/helpers/event-reminder-email-mysql-migrations.mjs. An independent
review must confirm these pinned bytes against the reviewed SQL baseline; no SQL
was changed by this hardening. Source directories must contain exactly migration.sql.
The runner captures verified bytes into an exclusive private snapshot and copies
the schema without editing it. Snapshot files are marked read-only; migration
subdirectories are also marked non-writable where supported. Prisma receives a
private config pointing only at that snapshot. Source and snapshot are revalidated
before bootstrap/deploy and after deployment. A source edit cannot change the SQL
Prisma consumes. This assumes a trusted local filesystem: Windows read-only modes
are not an ACL boundary against a hostile same-user process. Do not edit retained
snapshot files or clear their read-only attributes until approved artifact cleanup.

Identity, fresh-schema checks, migration history/checksums, schema definitions and
exact runtime/denied-account grants must pass in the parent test before fixture
DML. These checks throw directly; a node:test subtest failure cannot silently allow
fixture creation. Existing behavioral integration cases remain in place.

Additional fake-only checks (no MySQL, database connection, migration or email):

```powershell
node --test backend/test/event-reminder-email-mysql-safety.test.mjs backend/test/event-reminder-email-mysql-lifecycle.test.mjs backend/test/event-reminder-email-mysql-guard.test.mjs
node --check backend/test/helpers/event-reminder-email-mysql-process.mjs
node --check backend/test/helpers/event-reminder-email-mysql-migrations.mjs
node --check backend/test/event-reminder-email-mysql-safety.test.mjs
```

These tests inject child processes and filesystem operations. They cover initializer
termination failure, absent close events, spawn versus kill errors, hung shutdown,
signals, unrelated processes, manifest uncertainty, port release ordering,
migration edits, stale preflight exports, and fixture gating. They do not certify
native Windows process termination, MySQL integration, or provider delivery.

## Retained failure diagnostics

On the next authorized run, the runner prints the sanitized failure stage and
message, the integration-output path, and the diagnostic path. A child exit code 1
is a test/command failure even when the cleanup manifest correctly says stopped=true.
The manifest's process entries now include stage names alongside exit codes.

Two files are created beside harness-manifest.json before MySQL initialization:

- harness-diagnostics.json: separate redacted stdout/stderr for each command,
  exit code, signal, process/stream state, primary failure stage/message and
  secondary cleanup failures. It also retains initialization or migration-command
  failures when the integration tests have not been reached.
- integration-test-output.log: redacted integration stdout/stderr, exit code and
  failure reason, retained on success, exit 1, timeout or missing close. Until that
  stage is reached, the file explicitly says the integration test has not started.

Use the exact printed manifest path to inspect these files after a run:

```powershell
$manifestPath = 'PASTE THE EXACT PRINTED harness-manifest.json PATH'
$testManifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
Get-Content -LiteralPath $testManifest.diagnostics -Raw
Get-Content -LiteralPath $testManifest.integrationReport -Raw
```

The runner captures bounded output and redacts it before writing or displaying it,
including output from failed children. Redaction covers generated passwords and
encoded forms, database URLs, credential-bearing URLs, secret assignments, SQL
password clauses, bearer/JWT tokens and provider-key patterns. Raw environment
objects, command arguments/input SQL, Error stacks and causes are never serialized.
Failures before artifact creation are reported to the console with their preflight
stage. A diagnostic write error is reported separately and never hides the original
child failure or bypasses process cleanup. Diagnostic writes have a five-second
deadline so a stalled report cannot indefinitely delay cleanup. Native server output remains in
data/server.log; startup diagnostics include the server exit code when available.

Do not infer the failed stage from stopped=true: stopped describes process cleanup,
not integration success. Preserve the diagnostic files and existing artifacts on
failure. Continue to follow all stopped-state, identity and path checks before
cleanup; no diagnostic-reading command connects to a database or stops a process.

Additional fake-only diagnostic regression check:

```powershell
node --test backend/test/event-reminder-email-mysql-diagnostics.test.mjs
node --check backend/test/helpers/event-reminder-email-mysql-diagnostics.mjs
```

## Investigation of run E0kmQ6: claim readiness precondition

The retained diagnostics report 14 passing subtests and 10 failing subtests
(11 failures including the parent). Initialization, migration deployment and
cleanup succeeded. Every failing subtest is listed here:

| Subtest                                                                                   | Observed failure                            |
| ----------------------------------------------------------------------------------------- | ------------------------------------------- |
| independent sessions skip a specifically locked row and claim other work                  | null claim, then notificationId dereference |
| two store claim transactions can overlap and commit distinct claims                       | null second claim                           |
| UTC/native integer mapping, 60-second lease and SQL parameter binding                     | lease_token still null                      |
| lease expiry/recovery consumes attempts and fences a stale worker                         | chk_ere_lease while forcing expiry          |
| acceptance in progress wins over recovery after lease expiry without duplicate transition | chk_ere_lease while forcing expiry          |
| recovery in progress prevents stale acceptance from overwriting Retry                     | chk_ere_lease while forcing expiry          |
| Calendar title/notes during a locked preflight                                            | barrier timeout                             |
| Calendar remindBefore during a locked preflight                                           | barrier timeout                             |
| fake in-flight acceptance then DELETE before settlement                                   | barrier timeout                             |
| current ownership/role/recipient, deadline and 23-hour window cancel or stop requests     | null claim, then notificationId dereference |

An offline fake driver captured the generated Prisma INSERT. Prisma explicitly
supplies next_attempt_at as an application Date with millisecond precision for
@default(now()); it does not omit that column and use CURRENT_TIMESTAMP(0).
MySQL rounds fractional values stored in DATETIME(0), so an insertion late in a
second can produce a timestamp in the next second. See the
[MySQL 8.4 fractional-seconds documentation](https://dev.mysql.com/doc/refman/8.4/en/fractional-seconds.html).
The integration fixture previously claimed immediately without proving the job
was due. A null claim is valid for a future job; subsequent expiry mutations can
then violate the lease constraint, and missing claims can prevent worker/barrier
entry. The recorded run contains no row readiness timestamps or execution plans,
so attribution of every individual failure remains to be verified on a new run.

The test-only fix polls next_attempt_at <= UTC_TIMESTAMP(3), requires the row to
remain Pending, and fails with its database timestamps after a bounded deadline.
It does not rewrite outbox timestamps, change server time, retry failed claims,
or relax concurrency assertions. Both overlap fixtures are checked before the
held transaction starts. The overlap test also prints EXPLAIN FORMAT=JSON for
the original claim query into the retained test report on the next authorized run.
This is EXPLAIN, never EXPLAIN ANALYZE; it does not execute the claim.

The existing ready index is (state, next_attempt_at, notification_id), while the
query orders across both Pending and Retry by next_attempt_at, notification_id.
An execution plan may therefore require sorting; LIMIT 1 alone does not establish
how many records a locking scan visits. See
[ORDER BY optimization](https://dev.mysql.com/doc/refman/8.4/en/order-by-optimization.html)
and [InnoDB locks](https://dev.mysql.com/doc/refman/8.4/en/innodb-locks-set.html).
The old assertion message is not proof of broad locking without due fixtures and
plan evidence. Production claim SQL, transaction isolation, atomic fenced updates,
SKIP LOCKED, schema and migrations remain unchanged. If either concurrency test
still fails with due jobs, retain the plan and investigate actual locking; do not
remove the assertion or interpret a fake-only pass as native concurrency success.

Fake-only readiness/Prisma compilation regression tests:

```powershell
node --test backend/test/event-reminder-email-mysql-fixture.test.mjs
node --check backend/test/helpers/event-reminder-email-mysql-fixture.mjs
```

Another authorized run against a new disposable MySQL 8.4 instance is necessary.
Do not reuse the stopped E0kmQ6 database or its credentials. No database was
started or queried during this investigation; the saved diagnostic files were
read and fake adapters supplied all regression query results.

## Investigation of run CrF0q0: locking filesort

This later run passed 23 of 24 subtests. The remaining failure was the held-open
claim transaction test: both jobs were confirmed database-ready, yet the second
store returned null before the first transaction committed. The separate test
holding one specific primary-key row passed. Provisioning and cleanup succeeded.

The retained plan selected ere_ready_idx with access_type=index,
using_filesort=true, rows_examined_per_scan=2 and rows_produced_per_join=2.
using_index=true denotes a covering scan, not ordered LIMIT execution, and the
row counts are estimates, not a lock inventory. The index begins with state;
the original ORDER BY omitted state while selecting both Pending and Retry.
Consequently MySQL sorted a locking scan before applying LIMIT. Together with the
actual held-transaction failure, this identifies optimizer-dependent over-locking,
rather than a readiness failure or an assertion based only on EXPLAIN estimates.

The store now performs ordered candidate discovery as a non-locking read and
locks/revalidates each candidate using its unique primary key with
FOR UPDATE SKIP LOCKED and FORCE INDEX (PRIMARY). If a candidate is locked,
deleted, rescheduled into the future or no longer Pending/Retry, keyset traversal
moves to the next candidate. There is no fixed candidate-count cutoff. The same
five-second ReadCommitted transaction bounds the scan and contains the original
eligibility check and fenced Processing update. Frozen payload/key, attempt
accounting, lease fencing and post-commit diagnostics remain unchanged.

This preserves global next_attempt_at/notification_id priority across Pending and
Retry. Merely forcing ere_ready_idx would still allow filesort; adding state to
ORDER BY would change priority. The chosen fix requires no index/schema/migration
change. Expired-lease recovery is outside this failure and remains unchanged.
Candidate discovery can still sort, but cannot take row locks; only the unique
primary-key lookup is a locking read. Heavy contention can require multiple
candidate reads and reach the existing transaction deadline; no load benchmark
is claimed. Concurrent inserts/reschedules behind the cursor are reconsidered by
the next worker poll, as candidates are advisory until revalidated under lock.

The original integration assertions are retained. The next authorized run records
separate candidate and primary-key EXPLAIN plans; a filesort in the non-locking
candidate plan is allowed. Success requires both real overlapping transactions to
commit distinct claims, not a particular EXPLAIN cost or estimate.

Four fake regressions verify the non-locking/primary-key SQL boundary, traversal
past 101 locked candidates, stale-candidate revalidation, and mixed Pending/Retry
priority with ID tie-breaking. Fake connections do not certify native MySQL locks.
One final authorized run against a new disposable instance is required. No MySQL
was started and no database connection was made during this fix.
