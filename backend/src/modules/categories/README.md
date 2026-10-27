# Categories

TV3 owns `backend/src/modules/categories` for shared categories, guidance and
future category administration. The public Major read endpoint is implemented
on `feat/categories-major-api`; it becomes available from `main` after review
and merge.

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

The TV1 Hub consumer already sends `type=Major` and parses `{ items: [...] }`
with `id`, `name` and `type`. It has been compared with this endpoint contract;
the frontend and backend have not yet been tested together end to end.

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

## Outside this endpoint

`type=Skill`, profile rules for Closed categories, Admin CRUD/auth, seeds and
real category data are not implemented here. Skill and profile decisions
remain subject to TV2/TV3 review. Do not infer Skill permissions from the
public Major contract.
