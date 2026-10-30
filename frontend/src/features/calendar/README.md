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

- `frontend/test/calendar.test.mjs` checks five years of grid boundaries,
  Vietnam/UTC conversion, changed-only patches, past content edits, validation,
  DTO parsing, all six authenticated requests, refresh and error handling using
  mocked HTTP responses.
- `frontend/test/calendar-page.test.mjs` is an optional Playwright flow using the
  in-memory HTTP harness in `test-support/calendar-browser.mjs`. It covers CRUD,
  validation, save/list failure and retry, empty state and session switching.
  It explicitly skips without the optional environment runner; no dependency added.
- Windows environment: Node 24.13.0 / npm 11.6.2, below the declared repository
  minimums of 24.19.0 / 11.9.0. Versions and lockfile were not changed.
- Root typecheck, production build, tests, format check and diff whitespace check
  were run; final counts are in the task handoff. Tests needed execution outside
  the sandbox because tsx's user-info lookup failed inside it.
- No isolated Events database configuration was available. The unrelated reminders
  configuration was not reused. No real `.env` was read; no team database accessed.
  Real Calendar/MySQL integration remains unverified.
- Browser DOM access was unavailable and Playwright absent. Native Chrome preview
  attempts encountered user activity and minimized-window recovery failures.
  Rendered visual QA and interactive browser assertions remain unverified here.
