# Student Skill Options — TV3 handoff

Backend `GET /api/categories?type=Skill` is implemented on main from PR #20.
On base commit `3d9f6e50a66c8863f4be2b0fd67db3f5c902a03a`, frontend
`features/auth` and `features/profile` contain README placeholders only: there is
no verified session provider, access-token manager or Profile page to integrate.
This feature therefore exports a reusable field/hook without adding a router,
login flow, token storage, refresh mechanism or Profile implementation.

## Public interface

- `api.ts`: `getSkillOptions(accessToken, signal?)` uses existing `apiRequest`
  and its headers support for `Authorization: Bearer <accessToken>`, exact
  `type=Skill` query, no body. A blank token is rejected before fetch. Nonempty
  invalid/expired tokens go to the existing Backend Auth middleware; HTTP
  status/code, network and AbortError semantics are preserved.
- `contracts.ts`: `SkillOption`, `parseSkillOptions(unknown)`. Requires `{items}`
  with positive MySQL INT IDs, unique IDs, nonempty names up to 100 code points,
  exact `type:'Skill'`. Preserves backend order, projects only id/name/type.
  Any status-bearing row (including Closed/Admin list data) is rejected as
  `INVALID_RESPONSE`; it is never rendered as an option. The real API does not
  include status, so actual Active filtering belongs to the Backend query and
  is verified separately. Missing data never becomes an empty-success fallback.
- `useSkillOptions(accessToken, role)`: exposes `state` and `retry`. State is
  unauthenticated/forbidden/loading/success/error, with error code/httpStatus.
  Guest/Admin props do not fetch. Token/role changes hide old data immediately,
  abort prior loads and ignore late results. Retry and unmount have the same
  cancellation protection. No cross-user shared cache.
- `SkillOptionsField`: controlled checkbox group, accepting `accessToken`,
  `role: 'Student'|'Admin'|null`, `selectedIds`, `onChange(ids)` and `disabled?`.
  Uses existing UI feedback/Button styles, accessible fieldset/legend and native
  checkboxes. Supports loading, error/retry, empty and valid selection. Retry
  does not submit the surrounding Profile form. A 401 prompts re-login; 403
  explains denied access; only the parent/Auth owner can supply a new token.
  Role props are display hints, never a replacement for server authorization.

## Bình's Profile/Auth integration

Once the existing Auth work supplies the current token and role, import this
field into Student Profile and pass the controlled Skill IDs from that form:

```tsx
<SkillOptionsField
  accessToken={accessToken}
  role={role}
  selectedIds={skillIds}
  onChange={setSkillIds}
  disabled={isSaving}
/>
```

These names illustrate parent-owned values, not an assumed Auth API. Bình should:

1. Pass the current access token/role from Auth, clear/update them on logout or
   user changes, and own re-login/refresh. The field does not decode JWTs or read
   localStorage/cookies. Use the hook's error httpStatus if the session UI needs
   a notification. Reset form IDs when switching users.
2. Initialize IDs from the actual Profile response. Render existing Closed links
   with their labels separately, according to the Profile contract. Options
   show only Active choices. Toggling an Active checkbox preserves unlisted IDs;
   this field never silently removes existing Closed links on loading/error or
   because they are absent from options. Profile owns deliberate Closed removal.
3. Submit controlled IDs through the approved Profile API with its replace
   semantics, completeness validation and server validation if a category closes
   after options load. This field does not save Profile or decide Closed-link
   retention policy. Profile API/UI integration remains pending.

UI follows existing components and tokens; it has not been verified against a
Figma design. No product/demo route is registered in the shared router.

## Verification

From the repository root:

```powershell
node --test frontend/test/skill-options-api.test.mjs frontend/test/skill-options-field.test.mjs
npm.cmd run typecheck --workspace @unihub/frontend
npm.cmd run build --workspace @unihub/frontend
node --test backend/test/categories.test.mjs backend/test/auth-middleware.test.mjs backend/test/http.test.mjs
node --test frontend/test/skill-options-integration.test.mjs
```

API unit tests use fetch doubles. Browser component tests mount the real field in
an external temporary harness with intercepted API responses; they prove local
UI/contract behavior, not Backend/MySQL correctness. Playwright/Chromium must be
available in the environment; absent runner reports SKIP, not PASS. No new app
dependency is installed. The optional browser executable selector is
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

The separate FR–BK integration test uses the actual field and API client in a
Vite harness, proxying unmocked HTTP to Express/shared Auth and MySQL. It requires
`TEST_SKILL_OPTIONS_DATABASE_URL` targeting only a private loopback
`unihub_skill_options_test*` database with existing migrations and empty users/
categories. It creates test-only users, real signed JWT/live sessions, Active/
Closed Skills and a Major inside a fixture-owned transaction; verifies Guest 401,
Admin 403, Student contract/Active-only output, browser selection, invalid-token
401 and recovery when the parent supplies a valid token. Fixtures roll back;
pre-existing data is never deleted. Never use a group database. No URL or token
values should be committed/logged. Missing configuration reports SKIP.

This is a reusable-field integration, not full Student Profile or Google-login
end-to-end: those frontend modules are not present on the inspected main. Tests
do not verify production grants/data, concurrent category closure, Windows,
performance NFRs, deployment or Figma accuracy.

For Backend checks in this Cloud, native `prisma:generate` may receive HTTP 403
from `binaries.prisma.sh`. Same-version official `@prisma/internals` and
`@prisma/client-generator-ts` 7.10.1 can generate the actual client in-process via
WASM; subsequent `npm --ignore-scripts run typecheck/build` (run each script
separately) skips the blocked lifecycle generation, while executing the requested
checks. No schema, lockfile, TLS/checksum verification or Backend source is changed.
