# Personalized Recommendations — TV3 / PR #27

Backend `GET /api/recommendations` is implemented on this branch under the
approved [contract](../../../../docs/recommendations-api-contract.md). This
frontend update does not change Backend behavior, schema/database definitions,
Auth/Profile, shared router, Guidance or Categories.

## Verified state and integration interface

The inspected frontend Auth/Profile modules contain README placeholders only,
without a session provider or Profile UI. `RecommendationsPage` therefore exports
reusable page content, not an independently authenticated product route:

```tsx
<RecommendationsPage
  accessToken={accessToken}
  role={role}
  onCompleteProfile={openProfile}
  onSignIn={openSignIn}
/>
```

These values/callbacks belong to the parent; no unverified Auth API shape or
Profile path is assumed. The page uses existing React Router links, so render it
inside the application's router. Huyền owns the actual Student route/shell and
navigation integration; no shared router was modified. Bình supplies the current
token/role, refresh/re-login/logout and Profile completion. Clear/update auth props
on identity changes. Callbacks are optional: without them the page still explains
which profile fields are needed, but cannot navigate to unimplemented modules.
A full login -> Profile -> Recommendations product flow remains pending.

## API, validation and hook

- `getRecommendations(accessToken, signal?)` calls the exact GET endpoint with
  no query or body, using existing shared `apiRequest` and Authorization Bearer
  headers. No separate fetch client, login, token storage, decoding or refresh.
- Blank tokens fail before fetching; nonempty invalid tokens reach shared
  Backend Auth. Error status/code, network errors and AbortError are preserved.
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
  success/empty/error and retry. It aborts on retry/token/role changes/unmount,
  hides prior data immediately on auth changes, and ignores late responses.
  Guest/Admin props do not fetch, while server Auth/RBAC remains authoritative.

## UI states

Cards use existing Card/Badge/Button styles, showing public title/type/publisher,
work format/location where present, Verified, deadline date or no-deadline text,
match percentage and links to existing `/opportunities/:id` detail routes.
Percentages display the API's rounded score (up to two percentage decimals),
without changing server order. No production fixtures/mock data are included.
UI has not been verified against Figma or claimed to be the final Student shell.

- 401: invalid/expired session, re-login callback and retry; no fake refresh.
- 403: Student-only access explanation; no recommendation data.
- 409 `PROFILE_INCOMPLETE`: distinct from empty/error; instruct Major, year 1–4
  and at least one Skill, optional Profile callback, retry after completion.
- Empty 200: UC-06 no-fit message, optional update-profile action and retry.
- Loading, service/network/invalid-response error, retry and successful list are
  separate states. Unknown 409 is not treated as PROFILE_INCOMPLETE.

## Verification

From the repository root after client generation/backend build:

```powershell
node --test frontend/test/recommendations-api.test.mjs frontend/test/recommendations-page.test.mjs
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

Native Prisma CLI in this Cloud has returned HTTP 403 fetching the schema-engine
checksum from binaries.prisma.sh. Official same-version `@prisma/internals` and
`@prisma/client-generator-ts` 7.10.1 can generate the actual client in-process with
WASM outside the checkout. After explicit generation, use
`npm --ignore-scripts run typecheck` and `npm --ignore-scripts run build` to skip
only the blocked native-generation lifecycle while executing the requested
checks. No TLS/checksum verification, schema, manifests or lockfiles are changed.

Not verified: real Google login, final Auth/Profile/session UI and guarded Student
routing, production data/grants, Windows, NFR/performance, deployment or Figma.
