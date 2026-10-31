# Admin Categories frontend — TV3

`AdminCategoriesPage` is reusable content for the existing Admin Categories API.
Admin responses include creation dates; no Auth/schema/migration changes are
part of this module update. This documents the current checkout, including
uncommitted integration changes, and does not claim they are merged.

## Verified dependencies and handoff

`AdminCategoriesRoute` connects the page to existing Auth, `RequireRole('Admin')`
and `AdminLayout` at `/admin/categories`. The user confirmed localhost CRUD,
validation, authorization, audit and creation dates for Major and Skill.
Automated page tests use a harness and do not verify the full product router or
real Google login. Shared Auth/router/layout are not modified by this review.

```tsx
<AdminCategoriesPage accessToken={accessToken} role={role} />
```

The page subscribes to existing Auth state. Auth owns refresh/re-login/logout;
this module adds no independent JWT decoding, login flow or persistent storage.

## API and behavior

- `getAdminCategories`: GET `/api/admin/categories?type=Major|Skill`; Active and
  Closed items in server order, no pagination/search/body.
- `createAdminCategory`: POST `/api/admin/categories` with type/name/reason;
  new status is always Active.
- `renameAdminCategory`: PATCH `/api/admin/categories/:id` with name/reason.
- `setAdminCategoryStatus`: PATCH `/api/admin/categories/:id/status` with
  status/reason. No DELETE, type change or reference replacement.

All calls reuse shared `protectedApiRequest` with the current Auth Bearer token
and refresh lifecycle. The token prop checks availability; it is not an independent
credential source. Runtime parsers
check envelopes, exact enums, unique positive INT IDs, names and mutation target/
result consistency. Requests validate trimmed names (1–100 Unicode code points),
optional/null reason (at most 500 code points), IDs and enum values. Invalid data
never becomes an empty success. HTTP code/status, network and abort semantics
are preserved; Backend remains authoritative for authorization and business rules.

Every Admin category has `createdAt`, serialized from `created_at` as canonical
ISO 8601 UTC, including mutation/no-op responses. The parser normalizes invalid
or missing date metadata to null; only the date cell falls back to `—`.
Valid dates display `dd/MM/yyyy` in `Asia/Ho_Chi_Minh`. Public Major/Student Skill
Options responses do not change.

Skill search filters the full loaded list before eight-row client pagination.
It trims the query, ignores case and preserves accents. It does not normalize
Unicode composition or implement fuzzy search. Search/tab changes reset page one;
successful reloads clamp the stored page when results shrink. Loading preserves
the page. The summary shows the visible range and total matching items.
Major displays its full list without search or pagination. No q/page API parameters
are added.

The page provides Major/Skill selection, statuses, create/rename forms, status
confirmation, optional reasons, loading/error/empty/retry/saving and no-op notice.
Guest/Student props expose no Admin controls and make no API calls. Actual 401/403
responses remove Admin controls and request re-authorization. Client role props
never replace Backend Auth/RBAC.

Mutation locks prevent duplicate submissions and disable forms/actions/filter
changes. Errors preserve input and explain duplicate name, validation, last Active,
missing target and service failures. Success reloads the list to retain database
ordering/current state. Save success and subsequent list-reload failure remain
distinct. Network failure after a mutation can be ambiguous: reload to inspect
state before manually resubmitting. Mutations are not automatically retried.

Reads abort on type/token/reload/unmount and ignore stale results. Token rotation
preserves modal drafts; switching user or logging out resets the workspace.
Abort does not guarantee cancellation of an already committed server mutation.

## Verification

From the repository root, after generating Prisma Client and building Backend:

```powershell
node --test frontend/test/admin-categories-api.test.mjs frontend/test/admin-categories-page.test.mjs
node --test backend/test/admin-categories.test.mjs backend/test/categories.test.mjs backend/test/auth-middleware.test.mjs backend/test/activity-log-writer.test.mjs
node --test backend/test/admin-categories-mysql.test.mjs
node --test frontend/test/admin-categories-integration.test.mjs
npm.cmd run typecheck
npm.cmd run build
```

API tests use fetch doubles. Browser tests mount the real page with intercepted
API responses and cover forms, enum/status, pending locks, validation, create/
rename/close/reopen/no-op, business errors, auth gates and stale cancellation.
Playwright/Chromium must be available in the test environment, not an app
dependency; absent runner reports SKIP. The helper is in `frontend/test-support`,
outside Node's automatic test discovery, and gives each Vite harness a private
temporary optimizer cache to avoid interfering with concurrent browser tests.

Backend tests verify existing Auth, mutation/audit payloads and rollback. The
Backend MySQL test separately checks real transaction concurrency, collation,
last-Active invariant and preservation of references.

FR–BK integration uses unmocked Chromium -> Vite proxy -> Express/shared Auth/
audit -> Prisma/MySQL. `TEST_ADMIN_CATEGORIES_FRONTEND_DATABASE_URL` must target
only a private loopback `unihub_admin_categories_frontend_test*` database with
existing migrations and empty categories/users/activity_logs. Real signed test
JWTs, sessions and fixtures share a test-owned transaction and roll back. It checks
CRUD, Guest/Student denial, duplicate/final Active errors, audit actions, preserved
profile reference and invalid-token UI. It does not establish independent request
transaction isolation; Backend MySQL tests check real transaction boundaries.
No pre-existing rows are deleted. Never use a group database. Missing database
configuration reports SKIP, not PASS.

Cloud native `prisma:generate` has returned HTTP 403 downloading the schema-engine
checksum from `binaries.prisma.sh`. The actual client can be generated using the
official same-version `@prisma/internals` and `@prisma/client-generator-ts` 7.10.1
in-process WASM generator outside the checkout. Then run
`npm --ignore-scripts run typecheck` and `npm --ignore-scripts run build` separately:
these execute the checks without the blocked native generation lifecycle. Do not
disable TLS/checksum verification or change dependency/schema/lockfiles.

Verified by automated checks on Windows with Node 24: TypeScript/Vite, API tests
and Chromium page tests, including date timezone/fallback and Skill pagination.
User localhost confirmation is separate from automated coverage.
Not verified by these tests: real Google login, full product routing/layout,
production data/grants, performance NFRs, deployment or Figma fidelity.
Profile, Guidance, Recommendations and other Admin modules are outside this update.
