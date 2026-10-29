# Guidance public read API

TV3 owns this module. The implementation follows the approved
[Guidance contract](../../../../docs/guidance-api-contract.md), using existing
opportunities/category relations without schema changes or writes.

- `GET /api/guidance`: only optional `majorId`; selects an Active Major,
  Approved guidance articles, and groups by academic year 1–4. Stage order is
  ascending year; item order is ascending ID. No-year articles are omitted.
- `GET /api/guidance/:id`: Approved guidance detail, including existing Closed
  Major/Skill links and an empty year array when no year is linked. Text fields
  are plain text, not trusted HTML. Only contract fields are serialized.
- Both routes are public. A valid Student access token and live session allow
  the list to default to the profile's Active Major when no query is supplied.
  Missing/Closed profile Major, Guest and Admin use the first Active Major
  (`name ASC, category_id ASC`). Explicit Active Major selection wins.
- Shared auth middleware is wrapped locally: only 401 `UNAUTHORIZED` falls back
  to Guest. Database errors, Auth configuration errors and unexpected failures
  propagate; they never become a successful empty response.
- Invalid query/ID/filter: 400 `INVALID_QUERY` / `INVALID_ID` / `INVALID_FILTER`;
  unavailable/private/wrong-type detail: 404 `NOT_FOUND`; service errors use
  shared 503 `SERVICE_UNAVAILABLE` and 500 `INTERNAL_ERROR` handling.
- GET bodies are rejected with 400 `INVALID_REQUEST` (malformed JSON remains
  subject to the shared JSON middleware). No search, pagination or write API.

## Windows PowerShell validation

Run from the repository root on `feat/guidance-public-read`, using the pinned
Node/npm versions. Preserve local `.env` files. Do not use a group database.

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
node --test backend/test/guidance.test.mjs backend/test/categories.test.mjs backend/test/auth-middleware.test.mjs backend/test/http.test.mjs
npm.cmd run format:check
git diff --check
```

Guidance tests use real signed test JWTs and shared middleware with Prisma/session
read doubles. They assert query predicates/order, grouping, serializers, default
Major selection, validation and error handling. They do not establish real MySQL
collation, Google login, Windows runtime readiness or performance NFRs. Existing
Categories tests have an opt-in MySQL case; without its dedicated test database
configuration it is skipped. No Guidance MySQL integration case is included yet.

## Local HTTP checks

With a private development database migrated using existing repository migrations,
start the backend from the root:

```powershell
npm.cmd run dev:backend
```

In a second terminal:

```powershell
Invoke-RestMethod 'http://127.0.0.1:3001/api/guidance'
```

Use IDs actually returned by your private database for explicit `majorId` and
`/api/guidance/:id`. No Active Major returns exactly
`{"selectedMajor":null,"stages":[]}`; a selected Major with no articles retains
`selectedMajor` with empty `stages`. Do not seed group data to produce a demo.
Student defaults require the group's existing Auth configuration and a real valid
UniHub Student token/session on that same database. Keep credentials/tokens out of
logs. Frontend routes and UI are outside this backend change.
