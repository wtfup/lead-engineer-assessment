# Review / handover response

This is a review of the simulated `exercises/teamwork/pull-request.diff` ("PR #27 — preview
batches"), using `exercises/teamwork/RESPONSE_TEMPLATE.md`. It is a written simulation only — no
message below was actually sent, and the diff was not applied to the lab API per the exercise's
own instruction. My actual engineering handover for this assessment's real code is
`submission/HANDOVER.md`; this file links to it rather than duplicating it, per `07_SUBMISSION.md`.

## Merge decision and top risks

**Decision: request changes. Not mergeable in its current form, and not safely mergeable in 20
minutes.** The happy-path-once claim is true and irrelevant — the diff has a SQL injection
vulnerability, no tenant authorization on the invoice/job lookups, an error handler that reports
success on failure, and no idempotency contract with a remote allocator that can itself duplicate
work. Any one of these is blocking on its own; together they mean the endpoint can leak another
tenant's invoice data, corrupt `totalPaise`, or double-allocate previews, and would report `200
{ok:true}` while doing so.

Line numbers below are **added-line numbers within the diff** (added line 1 = `router.post(...)`,
per the exercise's own numbering convention), not file line numbers.

| Priority | Blocking / nonblocking | File + added line(s) | Observed risk and consequence | Specific change or question | Proof needed |
|---|---|---|---|---|---|
| 1 | Blocking | reminder-preview.ts: added lines 6,12,17,23,29 | Every query interpolates `requestId`/`id`/`tenant` directly into SQL text (e.g. added line 6, `WHERE request_id = '${requestId}'`). Any of these fields containing a `'` breaks out of the string literal — classic SQL injection, and the request body is otherwise unvalidated. | Convert every query to parameterized form (`$1`, `$2`, ...) with the value passed in the query's parameter array. | A request with `requestId: "x' OR '1'='1"` (or similar) must not alter the query's meaning; add a regression test asserting this. |
| 2 | Blocking | reminder-preview.ts: added lines 11-12, 16-17 | `req.body.tenant` is read directly (added line 2) and used to scope invoice/job lookups, but added line 12's invoice `SELECT` and added line 17's job `SELECT` filter only by `id`, never by tenant — and nothing here checks `tenant` against `req.user.allowedTenants` (per context, "nothing else authorizes body tenant or invoice IDs"). Since invoice IDs are unique only within a tenant, a caller can supply another tenant's invoice ID and read/allocate a preview against it. | Add `AND tenant = $2` (bound to the authenticated `req.user.allowedTenants`-checked tenant, not the body value) to both queries, and reject the request if `req.body.tenant` is not in `req.user.allowedTenants`. | A request naming an invoice ID that belongs to a different tenant than the authenticated user's must be rejected or return no rows, not another tenant's invoice. |
| 3 | Blocking | reminder-preview.ts: added lines 4-31 | `pool.query('BEGIN')` (added line 4) and the subsequent queries do not share a single checked-out client — with a `Pool`, each `pool.query` call may run on a different connection (per context), so `BEGIN`/`COMMIT`/`ROLLBACK` (added line 31) here have no guaranteed relationship to the reads/writes between them. This is the same defect class fixed in `server/service.mjs` for the real assessment API. | Check out one client via `pool.connect()`, issue `BEGIN`/`COMMIT`/`ROLLBACK` and all statements on that same client, release it in a `finally`. | Under two concurrent requests with different connections, demonstrate that a transaction's writes are all-or-nothing on the same client, not interleaved across connections. |
| 4 | Blocking | reminder-preview.ts: added lines 33-36 | The `catch` block (added line 33) rolls back, logs a vague message (added line 35), and returns **HTTP 200** `{ok:true,processed:0}` (added line 36) — a caller cannot distinguish "nothing to do" from "your request failed." Combined with the transaction-boundary bug above, a partial failure can look identical to full success. | Return a non-2xx status (409/500 depending on cause) on error, with enough detail for the caller to retry safely, and stop swallowing the error into a success-shaped response. | A forced query failure (e.g. an invalid invoice ID) must produce a non-2xx response, not `{ok:true}`. |
| 5 | Blocking | reminder-preview.ts: added lines 10-32 | `Promise.all(invoiceIds.map(...))` (added line 10) fires one allocator call (added line 20) and up to three queries per invoice ID **concurrently with no batch-size limit** (context confirms none exists elsewhere). A large `invoiceIds` array is effectively an unbounded fan-out against both Postgres and the remote `previewAdapter`. `previewAdapter.create` is also non-transactional and can accept-then-timeout, and the code has no idempotency key for it, so a retried request (context: "some clients retry after a timeout") can create duplicate remote previews even though `preview_jobs` looks like it's deduplicating locally (added lines 21-23) — the local insert and the remote call are not atomic with each other. | Bound batch size (validate/reject an oversized `invoiceIds`), process sequentially or with a small concurrency limit, and pass a stable idempotency key (e.g. `tenant:invoiceId:requestId`) to `previewAdapter.create` if the adapter can be extended to accept one — otherwise document the duplicate-allocation risk explicitly rather than silently accepting it. | Show that a retried request with the same `requestId` does not produce a second remote allocation, and that a large `invoiceIds` array is rejected or throttled rather than fanned out unbounded. |
| 6 | Nonblocking | reminder-preview.ts: added lines 1-38 (whole file) | No test file accompanies new business logic handling money (`totalPaise`) and an external side effect. | Not a merge blocker for a *draft*, but no production merge should happen without at least the SQL-injection and duplicate-retry cases covered. | N/A — captured under blocking items above once fixed. |

## Message to the author

Nice work getting the happy path working that fast — the batch/replay shape is reasonable. I
can't approve this yet: the SQL is built with string interpolation, a real injection risk, and I
don't see tenant checks on the invoice/job lookups, so a caller could reach another tenant's
invoice. The `catch` block also reports success on failure, which hides real errors from callers.
None of this is far from fixed — happy to pair on the parameterized-query pass if that's faster
than writing it up. Let's not merge in the next 20 minutes; the demo can run off the saved
synthetic preview instead.

## Escalation to product/engineering owner

Facts: PR #27 has a SQL injection vector, no tenant authorization on its invoice/job lookups, a
transaction boundary that doesn't reliably hold across a `Pool`, and an error path that returns
200 on failure. Unknowns: whether `previewAdapter.create` can be made idempotent, and expected
production batch size. Safe demo option: the endpoint can stay disabled; the demo runs off the
saved synthetic preview — no outage forces early shipping. Owner: PR author plus me as reviewer.
Next check-in: tomorrow, once Engineer A's query/tenant fixes and Engineer B's tests land.
Decision needed from you: confirm the demo uses the saved preview, not this endpoint, so there's
no pressure to merge before review.

## Two-engineer plan

| Owner | Bounded change | Dependency / interface | Tests and acceptance | Integration / rollback |
|---|---|---|---|---|
| Engineer A (SQL/API) | Parameterize every query (items 1, part of 2); add tenant-scoping predicate bound to `req.user.allowedTenants`, not the request body (item 2); move `BEGIN`/writes/`COMMIT`/`ROLLBACK` onto one `pool.connect()`ed client (item 3) | Needs the existing `preview_jobs`/`preview_batches`/`invoices` schema unchanged; no new migration required for this pass | Acceptance: a request with an injection-shaped `requestId` does not alter query semantics; a cross-tenant invoice ID returns no rows/403 rather than another tenant's data; a forced mid-transaction failure leaves no partial `preview_jobs`/`preview_batches` rows | Feature stays behind the existing disable flag until both engineers' acceptance tests pass; rollback is simply not enabling the flag |
| Engineer B (React/TS, tests) | Add the missing test file: SQL-injection-shaped input, cross-tenant invoice ID, forced-failure-returns-non-2xx, and a batch-size/oversized-`invoiceIds` rejection test; also add a client-side guard so the demo UI can't submit an unbounded `invoiceIds` list | Depends on Engineer A's parameterized queries landing first so tests exercise real behavior, not the injection bug itself | Acceptance: all four test cases pass against Engineer A's changes; CI green | No production risk — test-only and a client-side input cap, safe to land independently |
| Lead (me) | Review both changes together, verify the retried-request/duplicate-allocation risk (item 5) is at minimum documented if not fully solved (idempotency key into `previewAdapter.create` may need a adapter-side change outside this PR's scope), and decide whether the remaining allocator-duplication risk is acceptable for a narrow internal-preview-only release | Needs Engineer A + B's changes merged into the branch first | Acceptance: item 5 is either fixed or explicitly flagged as a known, bounded risk with a rollback plan (disable flag) before any wider release | Full endpoint stays behind the existing disable flag until this sign-off; can be toggled off instantly with no data migration to reverse |

## Actual assessment handover

This section is the real (non-simulated) engineering handover pointer, not part of the PR #27
review above:

- What I changed: see `submission/HANDOVER.md` in full — `server/service.mjs` (transaction
  boundary, tenant isolation, status precedence) and `app/page.tsx` (stale-response race,
  double-submit guard).
- Verified commands and actual results: `submission/HANDOVER.md` §"Running and verifying" — all
  commands were run against a real PostgreSQL 16 lab container, not assumed.
- Known failures / incomplete work: `submission/HANDOVER.md` §"Remaining risks and next developer
  tasks".
- Risk / rollout and rollback: the schema/index changes proposed in `submission/performance.sql`
  and `submission/DATABASE.md` are additive-only and independently rollback-able; the
  `service.mjs` behavior change is not a schema migration and ships with the application deploy.
- AI/tools used and claims I independently checked: see `submission/AI_USAGE.md`.
- Next engineer's first action: read `submission/HANDOVER.md` §"Remaining risks", starting with
  the overpayment/second-payment-on-a-paid-order semantics gap, which is the largest deliberately
  unresolved business-logic question left in the codebase.
