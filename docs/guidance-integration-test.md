# Guidance browser integration test

## Scope

`frontend/test/guidance-integration.test.mjs` loads the existing Roadmap and
Guidance Detail components in Chromium, serves them through a temporary Vite
harness, and proxies `/api` to the real Express application and Prisma/MySQL.
It does not mock HTTP responses or replace production components. The temporary
test router does not change the shared application router or layout.

## Shared AuthProvider and Guest

The harness wraps both routes in the real `AuthProvider` from
`frontend/src/features/auth/AuthProvider.tsx`, inside `BrowserRouter`. It does not
provide a fake context or override Auth state. A fresh browser has no refresh
cookie; the provider calls the real `POST /api/auth/refresh` through the same
Vite proxy and Express server, receives 401 and uses its official Guest flow.

The existing Auth router dependency `getAllowedOrigins` allows only the temporary
Vite origin. Random test-only JWT configuration is scoped to the test process and
restored during cleanup; real JWT configuration validation remains enabled.
No Google verification, Auth/Profile implementation or shared router is changed.
A harness-only component reads the public `useAuth()` interface and each scenario
waits for `status === 'guest'`. Guidance and Categories responses are never mocked.

Every test page registers Playwright `pageerror` before navigation. A render error
immediately rejects the scenario with its original message/cause through
`Promise.race`, rather than waiting for an element timeout. The listener is
removed and the page closed in cleanup.

The six scenarios cover:

- Public Major options from `GET /api/categories?type=Major`, excluding Closed
  options; Major selection through `GET /api/guidance?majorId=…` and year grouping.
- Navigation to `GET /api/guidance/:id`, Closed linked Major/Skill labels,
  literal description rendering and preservation of the selected Major on return.
- An Active Major without articles and a detail without year assignments.
- A persisted non-Guidance opportunity returning `404 NOT_FOUND`.
- A Closed Major filter returning `400 INVALID_FILTER`, with explicit clearing
  of the selection, and the default response when no Active Major remains.
- Actual rejected MySQL authentication, the contractual `503 SERVICE_UNAVAILABLE`
  response, and independent Major/Roadmap error and retry UI.

The existing opt-in test in `backend/test/guidance.test.mjs` already checks the
full matrix of exact opportunity-type variants against MySQL. This browser test
uses one wrong-type record to cover the UI boundary rather than duplicating
that matrix.

## Running safely

Use the repository's pinned Node/npm versions, install its dependencies, and
build the Backend first. Provide Playwright through the test environment and
a compatible Chromium installation. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` may
select the executable; otherwise the test uses `/usr/bin/chromium` when present
or Playwright's installed Chromium. No new production dependency is required.

Create a disposable MySQL database by applying the existing migrations. Supply
`TEST_GUIDANCE_FRONTEND_DATABASE_URL` privately through the environment, then run:

```sh
node --test frontend/test/guidance-integration.test.mjs
```

The test rejects non-loopback hosts and database names outside
`unihub_guidance_frontend_test*`. It also refuses a database containing Categories
or Opportunities. These checks supplement, rather than replace, provisioning
a dedicated database: never point it at a team or production database.

Fixtures run in a rollback-only transaction. Cleanup verifies that Category and
Opportunity fixtures are gone before checking database failures. Those failure
checks run after rollback to avoid holding an idle fixture transaction during
connection timeouts. A separate Prisma client uses a random incorrect password
against the same isolated MySQL instance; it never changes database credentials.
Browser, HTTP servers, Prisma clients and the private Vite cache are closed or
removed in `finally` blocks. The environment owner must also destroy the
disposable database/container, including after failure.

Without the URL or Playwright, the opt-in test reports SKIP. The existing Backend
MySQL test uses a separate `TEST_GUIDANCE_DATABASE_URL` and database prefix.

## Cloud verification and limits

The Cloud run uses a fresh MySQL 8.4 container, random credentials, a loopback-only
port and restricted application grants. Existing SQL migrations are applied
directly to that disposable database; no schema or migration is edited.

Native Prisma CLI generation was blocked by HTTP 403 from `binaries.prisma.sh`.
For verification, the environment generated the Prisma TypeScript client using
the official Prisma WASM internals/client generator outside the checkout, then
ran typecheck/build with automatic pre-generation disabled. This verifies the
generated client and application, but does not establish that native Prisma CLI
generation works in Cloud.

The real-MySQL failure scenario initially exposed an API error classification
problem: rejected authentication surfaced as Prisma `P2039`, driver kind `mysql`,
with `originalCode: '45028'`. MariaDB's `ER_GET_CONNECTION_TIMEOUT` means the pool
could not acquire a connection. The adapter converts its numeric errno to this
structured originalCode; no message parsing is needed.

`backend/src/middleware/errors.ts` now maps only that identified P2039/MySQL pool
timeout to `503 SERVICE_UNAVAILABLE`. P2039 alone and unrelated SQL, constraint,
programming or unknown adapter errors retain their existing behavior. Existing
availability-code mappings and explicit ApiError responses are unchanged.
`backend/test/errors.test.mjs` covers the narrow match, negative cases, wrapped
errors, cycles, existing mappings and safe HTTP envelopes. The browser test's
503 assertion is unchanged; its diagnostic adds only the non-secret originalCode.

This is an isolated public Guidance harness, not the integrated application
layout, authenticated Student Profile flow or production deployment. Fixture
reads use the existing dependency injection with one transaction-scoped Prisma
client; the test does not prove independent production transaction isolation.
The real AuthProvider's unauthenticated Guest restoration is verified here;
authenticated Student/Admin sessions, Profile integration, Google login E2E and
the shared application router/layout remain separate checks.

## Verification results

PR #32 review update: latest `origin/main` at `2c55089` was merged into
`test/guidance-integration` without rebase. The original four-file PR changes,
including the narrow P2039 mapping and its regression tests, are preserved.

| Check                                                                                                | Result                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New browser → Express → MySQL 8.4 test, rerun after fix                                              | PASS: all six scenarios; Node reports seven passes including the enclosing test, zero failures/skips.                                                                              |
| Existing Backend Guidance suite, dedicated MySQL, rerun                                              | PASS: 15 tests, including its existing exact-type MySQL opt-in test.                                                                                                               |
| Full Backend regression, rerun                                                                       | 133 PASS, zero FAIL, 17 SKIP: isolated MySQL opt-ins were not configured in this run. Includes Guidance/Categories and all four new error regressions.                             |
| Frontend Auth, Guidance API/contracts/pages and Opportunities API regression, rerun after main merge | 42 PASS, zero FAIL/SKIP. These use mocked API/component fixtures; the separate six-scenario test above uses real Express/MySQL.                                                    |
| Both workspace typecheck/build, rerun                                                                | PASS using the previously WASM-generated Prisma client and disabled pre-generation lifecycle. Native Prisma CLI generation was previously blocked by HTTP 403 and was not retried. |

The first browser attempt also hit an idle transaction timeout while testing
connection failures. The final harness moves those checks after rollback. Before
the Backend fix it reproduced the HTTP 500 classification failure; after the fix
both Major and Guidance return the contractual HTTP 503 and recover on retry.
