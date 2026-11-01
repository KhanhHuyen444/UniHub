# Personalized Recommendations — TV3 / PR #27

Backend `GET /api/recommendations` is implemented on this branch under the
approved [contract](../../../../docs/recommendations-api-contract.md). This
frontend update does not change Backend behavior, schema/database definitions,
Auth/Profile, shared router, Guidance or Categories.

## Auth/Profile integration — PR #36

`/recommendations` is mounted by the shared router inside `RequireRole Student` and
StudentLayout. Guest goes to login with a safe returnTo; Admin goes to /403.
`PROFILE_INCOMPLETE` offers `/profile`. Per UC-05, successful save and deferring go to home `/`; deferring does not call PUT; empty recommendations remain distinct from an
incomplete profile or a service error.

RecommendationsPage retains token/role props for availability and visibility gates.
The hook subscribes to the same trusted Auth state used by AuthProvider and keys
request ownership by authenticated user ID and role, not by token text. The token prop is not forwarded to the API: the
shared Auth module supplies the current Bearer token and owns refresh/retry.
Callbacks remain optional for isolated consumers and test harnesses.

## API, validation and hook

- `getRecommendations(signal?)` uses `protectedApiRequest` for the exact GET
  endpoint with no query/body. On 401 it uses shared refresh/retry, reads the new
  token and clears Auth on terminal 401. Refresh service errors become unavailable
  state; the existing guard offers restoration retry. No new auth mechanism.
- Error status/code, network errors and AbortError are preserved.
- `parseRecommendations(unknown)` validates items/meta/evaluatedAt, unique positive
  MySQL INT IDs, exact public opportunity types, fields, finite matchScore in
  [0.5,1] with output precision at most four decimals and known open deadlines.
  ISO date/instant calendar values are checked. NULL deadline is eligible;
  unknown/expired payloads are invalid, not silently filtered or rendered as empty.
- Deadline validation uses the server's evaluatedAt snapshot: date-only instant
  must be strictly later; datetime equality is allowed. It does not use the
  browser's current clock to recalculate eligibility.
- Only public contract fields are projected; title/publisher/location remain text.
  No reviewer/admin/profile fields are displayed. Backend order is preserved:
  equal rounded scores can hide different raw scores, so the frontend must not
  sort or recalculate scoring. Backend owns 40% Major/30% year/30% Skill, raw
  threshold/ranking and Closed-ID matching.
- `useRecommendations(token, role)` exposes unauthenticated/forbidden/loading/
  success/empty/error and retry. Initial Student mount fetches once. Same-user
  token rotation preserves pending work/results without another automatic request.
  Explicit retry always fetches through shared Auth using the current token.
  Logout, unavailable/restoring Auth, account switching or lost Student role
  invalidate the scope, abort pending requests and clear previous results.
  Scope revisions also reject late responses and prevent old results resurfacing
  after logout/login of the same user, even when updates are batched. Unmount
  aborts requests. No cross-user cache or custom JWT decoding is added.
  Guest/Admin props do not fetch, while server Auth/RBAC remains authoritative.

## UI states

The page uses a result-count header, a single-column list of cards and a sidebar
with Profile actions and the approved 40/30/30 scoring explanation. Small screens
stack these sections. Sidebar actions reuse the existing Profile callback.
Cards use existing Card/Badge/Button styles, showing public title/type/publisher,
work format/location where present, Verified, deadline date or no-deadline text,
match percentage and links to existing `/opportunities/:id` detail routes.
Percentages display the API's rounded score (up to two percentage decimals),
without changing server order. No production fixtures/mock data are included.
UI has not been verified against Figma or claimed to be the final Student shell.

Date-only deadlines preserve the API source calendar date. Datetime deadlines
format both calendar date and clock time in sourceTimeZone and label the zone.
If Intl does not support the source zone, both date and time fall back to UTC,
with an explicit UTC label; a source date is never combined with a UTC clock.
NULL deadlines retain the no-deadline label. Eligibility still uses server
evaluatedAt, not a new browser calculation.

- Terminal 401: shared Auth clears the session and the product guard sends Guest to login; isolated content keeps its re-login callback.
- 403: Student-only access explanation; no recommendation data.
- 409 `PROFILE_INCOMPLETE`: distinct from empty/error; instruct Major, year 1–4
  and at least one Skill, optional Profile callback, retry after completion.
- Empty 200: UC-06 no-fit message, optional update-profile action and retry.
- Loading, service/network/invalid-response error, retry and successful list are
  separate states. Unknown 409 is not treated as PROFILE_INCOMPLETE.

## Verification

From the repository root after client generation/backend build:

```powershell
node --test frontend/test/recommendations-api.test.mjs frontend/test/recommendations-page.test.mjs frontend/test/recommendations-card.test.mjs
node --test backend/test/recommendations.test.mjs backend/test/auth-middleware.test.mjs backend/test/http.test.mjs
node --test backend/test/recommendations-mysql.test.mjs
node --test frontend/test/recommendations-integration.test.mjs
npm.cmd run typecheck
npm.cmd run build
```

API tests use fetch doubles. Component tests mount the actual page in a temporary
Vite/React Router harness with intercepted API responses: loading/card info,
percent scores, order, text safety/detail href, 409 callback, empty, retry,
401/403/role gates, session changes and abort/late responses. Playwright/Chromium
is supplied by the test environment, not a new app dependency; absent runner
reports SKIP. Helper lives outside automatic test discovery in test-support and
uses a private optimizer cache per harness to isolate concurrent Vite servers.

The opt-in FR–BK integration uses unmocked Chromium -> real Vite proxy -> Express/
shared Auth -> Prisma/MySQL, real signed test JWT/live sessions and actual linked
profile/opportunities. It checks Closed-ID scores/order in cards, deadlines and
Pending filtering, Guest/Admin denial, profile-incomplete callback, empty success
and invalid-token UI. Requires `TEST_RECOMMENDATIONS_FRONTEND_DATABASE_URL` on a
private loopback `unihub_recommendations_frontend_test*` DB with current migrations
and empty users/categories/opportunities. Test-created data is in a fixture-owned
RepeatableRead transaction and rolls back; no group DB or existing data is used.
It does not establish independent request transaction isolation or concurrent
Profile edits. Existing Backend MySQL tests verify additional scoring/SQL cases.
Missing configuration reports SKIP, not PASS.

Historical Cloud environment note: Prisma CLI returned HTTP 403 fetching the schema-engine
checksum from binaries.prisma.sh. Official same-version `@prisma/internals` and
`@prisma/client-generator-ts` 7.10.1 can generate the actual client in-process with
WASM outside the checkout. After explicit generation, use
`npm --ignore-scripts run typecheck` and `npm --ignore-scripts run build` to skip
only the blocked native-generation lifecycle while executing the requested
checks. No TLS/checksum verification, schema, manifests or lockfiles are changed.

Current review results and limitations: [PR #36 review](../../../../docs/pr36-review-fix.md).
Fetch/SSR coverage is distinct from browser routing, real Google login, MySQL
integration, production grants, NFR/performance, deployment and Figma verification.

## Current Recommendations worktree verification

On Windows / Node 24.19.0, the current Recommendations checks pass: frontend
22 PASS / 0 FAIL / 1 SKIP and backend Recommendations 11 PASS / 0 FAIL / 1 SKIP.
Typecheck, build, scoped Prettier and git diff --check pass. With an existing
Prisma Client, --ignore-scripts skips generation hooks, not TypeScript/Vite checks.
The two skipped cases are real MySQL integrations; they have NOT passed in this
review. No production or personal database is used by these tests.

Existing API refresh tests from main are preserved, including refresh success,
rejection, terminal second 401, refresh outage/recovery and Admin role after
refresh. Browser regressions cover same-user rotation, manual retry, account
switching/logout, role revocation, abort/late responses and batched same-user
logout/login. Automated SSR card tests cover source-zone and forced UTC fallback
across a calendar-day boundary, date-only and null deadlines. SSR is not a real
browser timezone compatibility test.

Localhost inspection found port 3001 health/ready reachable, while port 5173
serves the original checkout, not this worktree. Its served router lacks Profile;
HTTP 200 for /profile is only Vite SPA fallback, not proof that the route exists.
A proxy readiness request returned 502 while direct backend readiness returned
200; the repeat check returned 200 through the proxy too. Verify the dev proxy/runtime
before manual acceptance. Existing servers were
not stopped/restarted, and no env file was copied or edited.

A read-only check of localhost:3306/unihub_dev found 0 Students, 0 complete Student
profiles and 0 Approved public opportunities. The 34 catalog items alone cannot
produce recommendations. Real Student Google login -> Profile -> Recommendations
and a populated/empty real API response remain unverified.

For manual acceptance, arrange a free 5173 port with the operator, run the existing
frontend dev command from this worktree, and supply approved runtime/Google setup
without putting secrets in Git. Confirm /profile and /recommendations from the
actual served router. Do not add personal DB fixtures automatically. A separate
opt-in test environment should use the guarded loopback test schema names above,
current migrations and empty starting tables. Explicitly provision only that
disposable database, then create test-owned Student/session/profile/category and
Approved opportunity/link fixtures there; existing integration tests handle their
fixture transaction. Include incomplete Profile (409), complete/no-match (200
empty), eligible match, expired/Pending exclusion, permissions and lifecycle.
No migration, seed or fixture provisioning was performed during this review.
