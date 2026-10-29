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
400 `INVALID_QUERY` before any database access. No body, search or pagination is
part of the options contract.

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

`type=Skill`, profile rules for Closed categories and Admin CRUD are not
implemented. Their contract proposals are in
[categories-api-contract.md](../../../../docs/categories-api-contract.md).
They await leader review; TV2/TV3 provide module feedback. Do not infer Skill
permissions from the public Major contract.
