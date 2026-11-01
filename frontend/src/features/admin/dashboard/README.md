# Admin Dashboard — TV4

`/admin/dashboard` is mounted under the shared `RequireRole('Admin')` and
`AdminLayout` with `activeKey="dashboard"`. It displays exactly the three metrics
in [the approved contract](../../../../../docs/dashboard-api-contract.md).

Each card starts its authenticated GET independently on mount, so the three
requests run in parallel. Each owns loading, error, retry and successful zero
states. No failed response is converted into zero. Counts are nonnegative safe
integers; every status field and a valid UTC `evaluatedAt` are required. Each
card displays its own evaluation time in Vietnam time; there is no cross-card
snapshot guarantee.

The shared authenticated client supplies Bearer tokens and refresh. Cleanup and
account/role/auth-status changes abort pending requests and ignore late results.
User-keyed content discards old card state; same-account token refresh retains
data. Retry hides that card's previous result immediately and cancels its request.
No polling, filters, charts, extra metrics or token storage are introduced.

`frontend/test/admin-dashboard.test.mjs` uses fetch doubles, real API parsers,
the card request lifecycle, and server-rendered components/role guard. It covers
parallel calls, zero/error rendering, retry isolation, response validation,
refresh, cancellation and account/role changes. Interactive browser accessibility,
visual QA, real FR–BK–MySQL integration and NFR timings remain unverified.

Shared router changes require TV1 integration review. No backend, schema or
migration changes belong to this frontend implementation.
