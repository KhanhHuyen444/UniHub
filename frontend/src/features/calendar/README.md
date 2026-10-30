# Student Calendar — TV4

`/calendar` uses the existing Student guard, StudentLayout, bundled Inter font,
shared controls and `protectedApiRequest`, including refresh. All six Events
endpoints are consumed. Ownership remains authoritative on the backend; the
frontend never sends owner IDs or arbitrary status values.

The Monday–Sunday month grid contains 28–42 days, including adjacent-month dates.
Requests use the complete grid as a half-open range at Vietnam midnight converted
to UTC. Statistics and lists cover this range only, not the entire event history.
Statuses come from the backend and completion is one-way. Inputs explicitly use
Vietnam time regardless of browser timezone. Edits preserve seconds and omit
unchanged fields, including an unchanged past deadline. No-op edits send no PATCH.

Range changes cancel old list requests. Identity, role, auth-status changes and
unmount abort outstanding session operations; the guard and user-keyed content
discard old data/dialogs. Normal token refresh for the same Student retains forms.

## Design decisions

All five supplied PNGs in `docs/shared-ui-design/calendar-references/` were read.
The shared shell and assets are reused without modification. Column ratio, cell
height, spacing, create/delete dialog widths, decorative glyphs and the fallback
stacking breakpoint are estimates from screenshots, not Figma measurements.
Create/edit share separate date/time controls for timezone clarity. Native modal
dialogs provide focus containment, Escape and focus restoration. Pending actions
disable dismissal and repeated submissions.

Empty state describes the current range. Unsupported notification settings,
email promises, sync, import, category filters and academic-term data are omitted.
The existing disabled notification bell is untouched. Local validation renders
field errors; server failures remain form-level errors with the draft retained.
The shared API client does not preserve optional `fieldErrors`; it is unchanged.

Shared-file changes mount `/calendar` in `app/router.tsx` and add its existing
navigation link in `PublicLayout` for authenticated Students only; TV1 should
review both at integration. Guests and other roles retain public navigation.
Pending detail requests disable conflicting actions and are ignored after a
calendar context change. Day button accessible names include loaded event counts.
No backend, schema, dependency or contract edits.

## Verification and limits

Latest review: 31 October 2026, starting head `2cd7788`, already contains
`origin/main=df6a277`. No Calendar application regression was found or changed.

- All six Events endpoints use the existing protectedApiRequest/refresh; ownership
  is enforced by the backend. No owner ID or arbitrary status is submitted.
- Real Google Student login by the user, actual Express and a fresh guarded
  MySQL 8.4.13 instance with existing migrations: UI create -> F5 persistence ->
  edit -> complete -> delete executed and passed. No HTTP/auth mock, token copy,
  fabricated token or role change was used for this browser run.
- Screenshots at 1280x1000: Calendar created/completed, stored in local
  `.cache/tv4/33-calendar-*.png`. No pixel-match claim without design comparison.
- Full checks: typecheck/build/format/diff-check passed. Frontend 85 passed,
  32 skipped; backend 133 passed, 17 skipped; zero failures. Optional Playwright
  harness and DB suites without explicit test URLs remained skipped. Existing
  Calendar HTTP unit tests use mock responses, distinct from the live browser run.
- Runtime: Windows, Node 24.22.1 / npm 11.19.1. No dependency/lockfile changes.
- One dev-server run hit Vite dependency-cache 504 after SSR tests. Restarting the
  exact checkout after tests resolved it. An early automation selector chose the
  background Delete button rather than the modal; corrected the test selector,
  then the full real UI flow passed. Neither required an application change.
- #33 and #35 still conflict with each other in `frontend/src/app/router.tsx`,
  not with current main. Integration must retain both Student Calendar and
  Admin Dashboard routes and all existing auth/Guidance/Opportunities routes.
  Dashboard has not been copied into this PR to hide that conflict.
- This checkout has no scheduler or Notifications implementation. Cross-PR
  reminder/bell flow and Admin Google UI are not claimed as tested here.
- Only the dedicated temporary database was used; no personal/group database,
  schema/migration or SQL privilege changes.
