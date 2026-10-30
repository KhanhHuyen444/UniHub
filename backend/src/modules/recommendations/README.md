# Personalized Recommendations — TV3

Implements the approved [contract](../../../../docs/recommendations-api-contract.md)
as `GET /api/recommendations`. Backend only; no UI, writes, audit, schema changes,
or HTTP calls to other UniHub APIs.

## Authorization and data

Uses shared `requireAuth` and `requireRole('Student')`: missing/invalid/expired JWT
or inactive session returns 401 `UNAUTHORIZED`; Admin returns 403 `FORBIDDEN`.
No query or GET body is supported (400 `INVALID_QUERY`). Malformed JSON and size/
encoding failures continue through the existing shared JSON error handler.

Only the authenticated user ID is read. Required profile fields are `major_id`,
`academic_year` 1–4 and at least one existing `user_skills` link. Missing data or
user returns 409 `PROFILE_INCOMPLETE`, distinct from a successful empty result.
No email, Google claims, token, role, career goal, profile DTO or reviewer data
is exposed. The Profile API/UI is owned by TV2; no Profile endpoint is added here.

Profile and candidates are read in one RepeatableRead transaction through the
shared Prisma Client, using one UTC `evaluatedAt` per response. Candidate queries
limit Approved rows to the three public opportunity types and eligible deadline
metadata. Exact status/type comparisons and shared deadline serialization provide
final eligibility checks independently of MySQL's case-insensitive collation.

## Eligibility, score and stable order

- Only `Thực tập`, `Việc làm`, `Học bổng` with status `Approved`.
- NULL deadline is eligible. Legacy unknown is excluded even with a future instant.
  Date-only is expired at `evaluatedAt >= cutoff`; datetime is expired only when
  `instant < evaluatedAt` (equality is eligible).
- `score = 0.4 * majorMatch + 0.3 * yearMatch + 0.3 * skillMatch`.
  Major/year are binary link matches. Empty year links give zero; empty required
  Skill links give one. Otherwise Skill match is matching required IDs divided
  by all required IDs. Category Active/Closed status and names never affect the
  Major or Skill ID matches; existing Closed links count in both numerator and
  denominator. This does not authorize selecting new Closed IDs in Profile.
- Filter raw score `< 0.5`; sort raw score DESC, known deadline instant ASC,
  NULL deadline last, then item ID ASC. No pagination or duplicate join rows.
- Reuses the existing Opportunities public list select/serializer (new exports
  only, no behavior change there), adding only `matchScore` rounded to four decimal
  places. Response is `{items,meta:{evaluatedAt}}`, including empty `items`.

Database/unexpected failures use shared 503/500 error mapping, never an empty
success. `backend/src/app.ts` mounts the new route and needs TV1/leader review.
No Categories Admin, Guidance or Frontend changes are part of this feature.

## Validation

From the repository root with Node 24.19.0 / npm 11.9.0:

```powershell
npm.cmd run typecheck
npm.cmd run build
node --test backend/test/recommendations.test.mjs backend/test/auth-middleware.test.mjs backend/test/opportunities.test.mjs backend/test/http.test.mjs
node --test backend/test/recommendations-mysql.test.mjs
```

HTTP tests use real signed JWTs/shared Auth and read-only Prisma doubles. They
cover ownership, auth/session/role failures, unsupported requests, incomplete vs
empty profiles, scoring components, raw precision around the threshold and tied
rounded scores, Closed IDs, exact types, deadlines, response shape and safe errors.

MySQL integration is opt-in via `TEST_RECOMMENDATIONS_DATABASE_URL`, restricted
to a private loopback `unihub_recommendations_test*` database with existing
migrations and empty users/categories/opportunities. It runs actual HTTP/Auth,
Prisma and joins inside a fixture-owned RepeatableRead transaction, verifying
scores, ordering, expiry, unchanged data and Closed-state invariance. Fixtures
roll back on completion/failure; no existing rows are deleted. It does not test
concurrent profile edits or independent request transaction isolation. Without
that variable the integration test reports SKIP, not PASS. Never use a group DB.

Cloud native `prisma:generate` may fail with HTTP 403 from `binaries.prisma.sh`.
The same-version official `@prisma/internals` and `@prisma/client-generator-ts`
in-process WASM generator can generate the actual client without the native
schema engine. After that explicit generation, `npm --ignore-scripts run typecheck`,
`npm --ignore-scripts run build` and `npm --ignore-scripts test --workspace
@unihub/backend` skip only the blocked lifecycle generate step, while executing
the requested checks. Do not disable TLS/checksum verification or alter lockfiles.

Not verified by these tests: Google login, Student Profile UI/API integration,
Windows configuration, production data/grants, performance NFRs or deployment.
