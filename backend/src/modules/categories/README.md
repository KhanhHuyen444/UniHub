# Categories

TV3 owns `backend/src/modules/categories` for shared categories, guidance and
future category administration. The public Major read endpoint is implemented
on `main` after PR #13.

## Major options endpoint

`GET /api/categories?type=Major` is public and requires no login. It returns
only Active Major rows, ordered by the MySQL `name` collation and then by
`category_id`. The response contains only `id`, `name` and `type`. An empty
result is HTTP 200 with `{ "items": [] }`; unsupported, missing or repeated
query parameters return 400/`INVALID_QUERY`. Database unavailability returns
503/`SERVICE_UNAVAILABLE` through the shared error mapping.

Implementation:

- `categories.routes.ts` validates the exact supported query and mounts the
  public read route.
- `categories.service.ts` selects and orders fields in MySQL through the
  shared Prisma Client. It does not create a client or connection pool per
  request.
- `backend/test/categories.test.mjs` covers request validation, response
  shape, safe errors and an opt-in MySQL integration case.

The TV1 Hub consumer sends `type=Major` and parses `{ items: [...] }` with
`id`, `name` and `type`. The Public Hub consumer and endpoint were exercised
together with Express and a temporary MySQL 8.4 database; see the
[integration report](../../../../docs/opportunities-integration-test.md).

## Windows PowerShell

Run these commands from the repository root. Configure `backend/.env` with a
runtime account and a development database that already has the repository
migrations applied. Do not use a migration or root account for the app, and do
not share the local `.env` file.

```powershell
npm.cmd ci
npm.cmd run dev:backend
```

Then, in another PowerShell window, request the endpoint:

```powershell
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:3001/api/categories?type=Major"
```

An empty category table correctly returns an empty `items` array. A database
connection/configuration issue returns a safe 503 response. Stop the server
with `Ctrl+C`.

Run repository checks from the root with `npm.cmd run typecheck`,
`npm.cmd run build`, `npm.cmd test` and `npm.cmd run format:check`. The optional
MySQL integration test uses `TEST_CATEGORIES_DATABASE_URL` only when it points
to a loopback-only database named `unihub_categories_test*` with no categories
already present. The test refuses a populated categories table and never
clears pre-existing rows. Use a disposable database with the current
migrations; never point it at a group database.

## Skill options endpoint

`GET /api/categories?type=Skill` requires a valid UniHub access JWT and a live
session through the shared `requireAuth`, followed by `requireRole('Student')`.
Guest or invalid/expired tokens receive 401 `UNAUTHORIZED`; Admin receives 403
`FORBIDDEN`. Major remains public, including when an Authorization header exists.
Query validation runs before authentication: exactly one `type=Major` or
`type=Skill` is accepted; unsupported, repeated or missing query fields return
400 `INVALID_QUERY` before any database access. Skill requests with a body return
400 `INVALID_REQUEST` before authentication or any Prisma access. Search and
pagination are not part of the options contract.

Both types reuse the same Prisma query/serializer: Active only, ordered by
`name ASC, category_id ASC`, selecting only `id`, `name`, `type` for the response.
An empty Skill list returns 200 with `{ "items": [] }`. Database failures return
503 `SERVICE_UNAVAILABLE`; unexpected failures return 500 `INTERNAL_ERROR`.
Closed links on existing profiles are outside this endpoint's scope.

### Try Skill locally (PowerShell, repository root)

Use Node 24.19.0 and npm 11.9.0. Run `npm.cmd ci`. Configure the existing backend
local environment according to the auth module README (JWT signing configuration,
Google client ID and allowed origins) and a private development MySQL database
with the current migrations and runtime grants. Preserve existing `.env` files;
never share credentials or use the group database for tests.

```powershell
npm.cmd run dev:backend
```

In a second terminal, obtain a valid Student access token through the existing
Google login flow, with a live session in that same development database. Keep it
in the local `$studentAccessToken` variable; do not paste it into logs or commits.

```powershell
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:3001/api/categories?type=Skill" -Headers @{ Authorization = "Bearer $studentAccessToken" }
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:3001/api/categories?type=Major"
```

Without the header, Skill must return 401. Repeat with a valid Admin token for 403. PowerShell reports non-2xx responses as errors. An empty development category
table produces `items: []`, not an authentication error.

### Tests and limits

After `npm.cmd run build`, run
`node --test backend/test/categories.test.mjs backend/test/auth-middleware.test.mjs`.
Categories HTTP tests use real signed JWTs and the shared auth middleware with
Prisma/session doubles. They verify query predicates, select/order, authorization,
safe errors and public Major regression. The opt-in MySQL case checks real category
filtering, type isolation, sorting and empty results for both types; its Skill auth
session is a test double. Without `TEST_CATEGORIES_DATABASE_URL`, that case is
skipped. Mock query assertions do not establish actual MySQL collation behavior.

## Outside this endpoint

Skill Options is implemented as the Student-only read endpoint described above.
Admin management is implemented separately below. Profile rules for retaining
existing Closed category links remain outside this module; approved contracts are in
[categories-api-contract.md](../../../../docs/categories-api-contract.md).
The options endpoint reuses the existing Auth middleware and live sessions.
It does not implement Google login, profile editing or a frontend profile
consumer; those integrations depend on the Auth/Profile modules. Admin must use
the separate category management API, not Skill Options.

## Admin Categories management

Implemented under `/api/admin/categories`, using the existing shared
`requireAuth` then `requireRole('Admin')`. Guest/invalid credentials return 401;
Student returns 403. Public Major and Student Skill Options routes are unchanged.

- `GET ?type=Major|Skill`: exact, required query; returns Active and Closed rows
  sorted by `name ASC, category_id ASC`, with only `id/name/type/status`.
- `POST /`: `{type,name,reason?}` creates an Active category (201).
- `PATCH /:id`: `{name,reason?}` renames either Active or Closed categories.
- `PATCH /:id/status`: `{status,reason?}` closes/reopens a category.
- No DELETE route, type change, reference replacement, search or pagination.
  Existing IDs and all profile/opportunity/skill references are preserved.

Names are trimmed, nonempty and at most 100 Unicode code points. Reasons are
optional/null or strings of at most 500 code points and are stored separately.
Unknown/duplicate JSON fields, unsupported/repeated query fields, GET bodies and
invalid IDs are rejected. The router uses its own JSON parser before the shared
app parser to detect duplicate keys; size/encoding/syntax errors still use the
shared error handler. Database UNIQUE `(type,name)` enforces the existing MySQL
collation, including case-insensitive, accent-sensitive name uniqueness; P2002
maps to 409 `DUPLICATE_CATEGORY`. No schema or migration is changed.

Each mutation uses an interactive RepeatableRead transaction with an ordered
`SELECT ... FOR UPDATE` over category rows before reading lifecycle state. All
Admin category mutations take these same locks, serializing status changes and
rechecking that at least one Active remains for the target type. This deliberately
serializes writes across both types for the small unpaginated category set.
InnoDB deadlocks retry the whole rolled-back transaction up to three attempts;
exhaustion returns safe 503. The last Active close returns 409
`LAST_ACTIVE_CATEGORY`. A missing target returns 404 `NOT_FOUND`.

Shared `writeActivityLog` records exactly one CREATE/RENAME/CLOSE/REOPEN_CATEGORY
entry with the authenticated actor and compact old/new fields in that same
transaction. Log insertion/validation failure rolls back the category mutation;
serialized values are never truncated. Shared writer validation failures return
400 `VALIDATION_ERROR`. Exact no-op rename/status returns `changed:false` and
writes no log. Other errors use the common safe 503/500 mapping.

After building, run from the repository root:

```powershell
node --test backend/test/admin-categories.test.mjs backend/test/categories.test.mjs backend/test/auth-middleware.test.mjs backend/test/activity-log-writer.test.mjs
node --test backend/test/admin-categories-mysql.test.mjs
```

HTTP tests use real signed JWTs/shared Auth and audit writer with transactional
Prisma doubles. They do not prove MySQL locking or collation. The MySQL test is
opt-in via `TEST_ADMIN_CATEGORIES_DATABASE_URL`: only a disposable loopback
`unihub_admin_categories_test*` database with existing migrations applied and
empty users/categories/activity_logs is accepted. It tests real uniqueness,
concurrent final-Active closes, preserved references and audit rollback. It never
clears pre-existing data or deletes audit entries; fixtures remain in this private
test database, which its owner must dispose of after the run. Never use a shared
or group database. Without that variable the MySQL test reports SKIP.
