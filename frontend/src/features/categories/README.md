# Student Skill Options — TV3

Backend GET /api/categories?type=Skill is Student-only and returns Active Skills.
Profile uses SkillOptionsField with controlled selectedIds. No Backend, Profile,
shared Auth, router, schema or database changes are required for this fix.

## Shared Auth and request lifecycle

- getSkillOptions(accessToken, signal?) keeps its existing signature for Profile.
  The token argument is only an availability hint; it is never sent as a header.
  The authenticated Student in the shared Auth store is required. Guest/Admin
  are rejected locally without fetching; Backend Auth/RBAC remains authoritative.
- protectedApiRequest supplies the current Auth token. After 401, shared Auth
  refreshes the session, verifies /me and retries once. Invalid refresh or a
  terminal retry 401 clears Auth; refresh outages set Auth unavailable. No token
  storage, JWT decoding, refresh manager or additional Auth mechanism is added.
- The query remains exactly type=Skill, without a body. AbortSignal is forwarded
  through initial request/retry; pre-abort and late success after abort are rejected.
  Shared refresh belongs to Auth and may complete even if this consumer aborts.
  The cancelled consumer never publishes its late result.
- useSkillOptions subscribes to the same trusted store as AuthProvider. Request
  ownership uses user ID, role and a scope revision, rather than token text.
  Same-user token rotation preserves pending work/results without another load.
  Explicit retry uses the current Auth token. Logout, account/role changes,
  restoration/unavailability and unmount invalidate/abort prior work. Batched
  logout/login of the same user cannot revive results from the previous scope.
- Guest shows sign-in feedback, Admin denied access, restoration loading and
  Auth service outage an error distinct from an invalid session. The real Profile
  route guard owns session recovery/sign-in UI. No global Auth behavior is changed.

## Controlled Profile selection and contract

The existing field props remain accessToken, role, selectedIds, onChange and
optional disabled. Loading, Auth errors and temporary request failures never call
onChange or clear selectedIds. Active choices preserve unlisted existing IDs;
Profile still owns Closed-link labels/removal, account-specific form reset and
saving. There is no cross-user options cache.

The parser requires unique positive MySQL INT IDs, nonempty names up to 100 code
points and exact Skill type. It preserves backend order and projects id/name/type.
Status-bearing rows are invalid; the Backend owns Active filtering. Empty success
is distinct from errors. No search/chip UI changes are included in this fix.

## Verification

From the repository root on Node 24:

```powershell
node --import tsx --test frontend/test/skill-options-api.test.mjs frontend/test/auth.test.mjs
node --import tsx --test frontend/test/skill-options-field.test.mjs
node --import tsx --test frontend/test/skill-options-integration.test.mjs
npm.cmd run typecheck
npm.cmd run build
npm.cmd run format:check
```

API tests use fetch doubles and actual shared Auth modules. They cover refresh
success, denial, service outage, bounded retries, abort during refresh/retry,
concurrent token rotation, role gates and existing response validation.
Browser tests mount the actual field and shared Auth store with intercepted HTTP:
refresh retry count, terminal Auth states, selected Active/Closed IDs through
failure/retry, same-user rotation, account switching, logout during refresh,
batched same-user logout/login, abort/late results and unmount.
Playwright/Chromium comes from the test environment; no app dependency is added.
Missing browser runner reports SKIP.

The opt-in integration requires TEST_SKILL_OPTIONS_DATABASE_URL on a disposable
loopback unihub_skill_options_test\* database with current migrations and empty
users/categories. Category HTTP/Auth/MySQL uses real fixtures in a rollback-only
transaction; only refresh denial for the invalid-token UI scenario is intercepted
because that harness has no login cookie. Never use a group database. Missing
configuration reports SKIP. This task does not provision or access a database.
Google login, real refresh cookies, full Profile routing, production grants/data,
performance and deployment remain outside these mock/browser checks.

## Local verification on base 49fc07a

Windows, Node 24.19.0 / npm 11.17.0: Skill API 13 PASS, browser 10 PASS,
shared Auth 12 PASS, Auth navigation 9 PASS, Profile unit/API 7 PASS,
Profile browser flow 9 PASS, Profile page browser 1 PASS and Profile navigation
3 PASS: 64 PASS / 0 FAIL. The MySQL opt-in is 1 SKIP; no database was accessed.
Root typecheck/build and format check PASS using normal Prisma client generation.
Vite reports a bundle-size warning; browser harnesses warn about empty Tailwind
content. Neither warning fails these checks or explains the old URL failures.

### Profile home assertion comparison

A clean baseline was extracted from git archive 49fc07a into a disposable directory
without local source or environment files. Baseline and this branch used the same
Node/Chromium, installed dependencies, test flags and HTTP mock harness. No other
checkout/worktree was modified. The three original tests each failed at
page.waitForURL(base + '/\_dev/health') on both baseline and branch:

| Existing test                                                                                      | Original main | Skills fix, original assertions | Main, corrected assertions | Skills fix, corrected assertions |
| -------------------------------------------------------------------------------------------------- | ------------- | ------------------------------- | -------------------------- | -------------------------------- |
| Google Login: incomplete Student overrides returnTo; defer goes home without PUT or a Profile loop | FAIL          | FAIL                            | PASS                       | PASS                             |
| Google Login: complete Student goes home by default                                                | FAIL          | FAIL                            | PASS                       | PASS                             |
| successful Profile PUT goes home and shows confirmation despite returnTo                           | FAIL          | FAIL                            | PASS                       | PASS                             |

All three are pre-existing stale test assertions, not a Skill regression or
machine-specific harness failure. Main mounts HomePage at /; Profile deferral,
successful save and default complete-Student login navigate there, matching the
current Profile README/UC-05 behavior. The development health URL is separate.

Only three URL assertions in frontend/test/profile-flow.test.mjs change to /.
The tests still require incomplete-profile routing, no PUT on deferral, no Profile
loop on public navigation, default home navigation, exactly one successful PUT
and the saved confirmation. No Profile/Auth/router production logic is changed.
The Profile owner (TV2) should review this three-line test-only adjustment alongside
the Skill fix; no external review request or PR has been sent by this task.

Real Google login, cookies and MySQL end-to-end acceptance are not claimed.
