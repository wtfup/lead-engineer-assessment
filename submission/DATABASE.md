# PostgreSQL evidence

All commands below were run against the real lab database
(`postgresql://assessment:assessment@127.0.0.1:55439/assessment`, PostgreSQL 16, via
`docker compose up -d db`) after `node server/reset.mjs`. Raw output is preserved under
`submission/`: `reconciliation-output.txt`, `rollback-evidence.txt`, `concurrency-evidence.txt`,
`perf-before.json`, `perf-after.json`, `perf-ids-before.txt`, `perf-ids-after.txt`.

## A. Reconciliation and conservation

Full queries and business interpretation: `submission/reconciliation.sql`,
`submission/DECISIONS.md` §1. Key evidence:

**Naive join multiplies money** (`reconciliation.sql` query 0a): order `n-001` has 3 canonical
`payment_events` rows (`e-n1`, `e-n1-retry`, a later failed `e-n1-late`) for one ₹1,000.00 order.
`SUM(payment_events.amount_paise)` or `COUNT(*) * order.amount_paise` over a naive
`orders JOIN payment_events` reports **₹3,000.00 — 3x the true amount**. Event identity
(`tenant,event_id`, one row per delivered/retried observation) is not business payment identity
(`tenant,payment_id`), and neither is the revenue unit: the **order** is (business rule 1,
`server/API_CONTRACT.md`), which is why every revenue query in `reconciliation.sql` sums
`orders.amount_paise` grouped by order, never `payment_events.amount_paise` grouped by nothing.

**Raw-feed conservation** (query 0b): a source-preserving staging table loaded verbatim from
`fixtures/gateway-deliveries.csv` (8 rows, including the exact `e-n1` transport duplicate) is
compared directly against the canonical `payment_events` table:

| | Raw feed (staged copy) | Canonical DB |
|---|---|---|
| Rows / distinct `(tenant,event_id)` | 8 rows / 7 distinct | `payment_events`: 7 rows |
| Distinct `(tenant,payment_id)` | 5 | `payments`: 5 rows |

Both match — `reset.mjs`'s `ON CONFLICT (tenant,event_id) DO NOTHING` is exactly transport-identity
dedup, nothing more (it does not collapse `e-n1-retry`, a genuinely new transport identity for the
same business payment) and nothing less (it did collapse the exact `e-n1` duplicate).

**Unknown vs. zero** (query 0c): `orders.campaign_id` is nullable in `database/schema.sql` though
no seeded row is null today. A `GROUPING SETS ((campaign_id), ())` rollup uses Postgres's
`grouping()` flag (not a bare `campaign_id IS NULL` check, which would misidentify the grand-total
row itself) so a future null-campaign order would surface as its own labelled `UNKNOWN` row,
included in the grand total — never silently dropped or folded into `0` for some other campaign.

## B. Durable invariants and concurrent requests

**State transitions, named precisely** (received/validated/recorded/completed/reconciled are not
interchangeable, and a failed/invalid/mismatched event must never advance past "recorded" into a
successful outcome):
- **Received**: the HTTP body has arrived (`index.mjs`'s `readJson`); nothing durable yet.
- **Validated**: `common.mjs`'s `validateEvent` has checked shape/types/ranges, and
  `assertOrderAmount` has checked the amount/currency against the *locked* order row. A failure
  here (400/404/409) writes nothing — validation happens before the transaction's first write.
- **Recorded**: the event is durably in `payment_events` (one row per transport observation,
  keyed `(tenant,event_id)`). A `failed`-status event *is* recorded — it is retained as evidence
  (business rule 5) — but recording is not the same as succeeding.
- **Completed** (business effect applied): `payments`/`orders` are updated to reflect the event
  *only if* the event's status outranks the current one (§ precedence below) — a recorded `failed`
  event never reaches this state for an already-succeeded payment. This is also where "one newly
  paid order generates one durable fulfilment intent" is decided (the outbox insert), gated on the
  order not already having been paid.
- **Reconciled**: the worker (`worker.mjs`) turns an outbox intent into a `provider_receipts` +
  `fulfilments` row, in its *own* separate transaction — this is deliberately decoupled from
  "completed" because provider acceptance is a genuine external uncertainty boundary (see the
  Mermaid diagram below); a worker crash between "completed" and "reconciled" is the case
  `tests/challenge.acceptance.test.mjs`'s "provider acceptance followed by worker restart
  reconciles without duplicate fulfilment" test exercises.

A malformed/invalid event (bad shape, wrong amount, unknown/cross-tenant order) never reaches
"recorded" — it's rejected pre-transaction with no row written anywhere, verified above in
§A/§B's zero-row checks after a 400/404/409 response.

Three defect families were found and fixed in `server/service.mjs`, each with a targeted
regression in `tests/service-repair.test.mjs` confirmed failing on the pre-fix code and passing on
the fix (see `submission/HANDOVER.md` for the diff description):

1. **Tenant isolation** — `order(tenant,id)` queried `orders WHERE id=$1`, no tenant predicate.
2. **Transaction boundary** — five writes per payment event ran as five independent
   auto-committed statements, not one transaction.
3. **Status precedence** — the `payments` upsert did `DO UPDATE SET status=EXCLUDED.status`
   unconditionally (last-write-wins), and the outbox insert fired on every `succeeded` observation
   instead of only the transition into `paid`.

**Where uniqueness belongs, and why**: `(tenant,event_id)` is a UNIQUE constraint on
`payment_events` (supplied in `database/schema.sql`, not added by me) because *transport* replay
safety belongs to the database, not application memory — an in-process Set is invisible to a
second Node process or a restarted one. `(tenant,payment_id)` is the PRIMARY KEY on `payments`
because *business* payment identity must be globally unique per tenant regardless of how many
transport events reference it. `business_key` is the PRIMARY KEY on `provider_receipts` because
the provider's acceptance idempotency is a *third*, separate identity from both of the above (the
worker's job, not the API's event). All three constraints were already present in the supplied
schema; I verified the seed data contains no duplicate `(tenant,event_id)` or `(tenant,payment_id)`
pairs before relying on them (`reconciliation.sql`-style `GROUP BY ... HAVING count(*)>1` returned
zero rows for both) — the "address existing duplicates before deployment" concern was checked, not
skipped, even though no new constraint was needed here.

**Locking**: `service.paymentEvent` takes `SELECT ... FROM orders WHERE tenant=$1 AND id=$2 FOR
UPDATE` as its first statement, inside one transaction on one checked-out client. This locks the
single order row (via its `(tenant,id)` unique index) that the rest of the transaction reads and
writes — event insert, payment upsert, order update, conditional outbox insert, and audit insert
all happen while holding that lock, then release together on `COMMIT`/`ROLLBACK`. **Ordering**:
every payment-event write acquires exactly one order-row lock in this same order, so two
transactions can only ever contend for the *same* row, never form a cycle across two different
rows — no deadlock is possible from this code path alone. **Timeout**: `db.mjs` sets
`lock_timeout=5000` at the pool level, so a stuck waiter fails fast (returns a 500, rolls back)
rather than hanging the connection indefinitely. **Multiple Node processes**: since the lock lives
in Postgres, not in either process's memory, two API processes handling concurrent requests for
the same order serialize on the same row lock exactly as two concurrent requests within one
process would — verified live below with 10 concurrent HTTP requests against one running server
and real Postgres, not just the in-process test harness.

**Live evidence** (`submission/concurrency-evidence.txt`, direct DB row inspection, not just HTTP
status, per the mission's explicit requirement):
- *Cross-account order access*: `GET /api/orders/s-001` as tenant `south` (owner) returns the
  order; the identical request as tenant `north` returns `404 {"error":"Order not found"}` — no
  other tenant's data, no 500 leak.
- *Sequential replay*: the same event ID POSTed twice returns `duplicate:false` then
  `duplicate:true`; a **third**, distinct event ID for the same `paymentId` returns
  `duplicate:false` again. Direct row check: 2 `payment_events` rows (both transport observations
  kept), exactly 1 `payments` row, exactly 1 `outbox` row, order `paid` exactly once.
- *True concurrency*: 10 concurrent identical POSTs (same event ID, fired via `Promise.all` against
  one running API process and real Postgres) resolve to exactly 1 `duplicate:false` and 9
  `duplicate:true`. Direct row check: exactly 1 `payment_events` row, 1 `outbox` row, 1 `audit` row
  — the `FOR UPDATE` lock plus the `(tenant,event_id)` unique constraint jointly make this hold
  under genuine concurrency, not just the deterministic single-process test harness.
- *Rollback under failure* (`submission/rollback-evidence.txt`): a real Postgres trigger
  (`BEFORE INSERT ... RAISE EXCEPTION`) on `outbox`, hit via a live `POST`, rolled back the event
  insert and order update that had already run earlier in the same transaction — order stayed
  `pending`, all four dependent tables showed zero rows for that order. No integrity error is
  caught and reported as success anywhere in `service.paymentEvent`: the only place an error is
  swallowed into a 200 is the verified-exact-replay path, which is a genuine duplicate, not a
  masked failure — a payload mismatch under the same event ID is a distinct 409, not a caught
  exception.

## C. Query-plan lab

`database/performance.sql`'s 50,000-row `query_lab_orders` fixture, before/after a composite
index (`submission/performance.sql`, raw `EXPLAIN` JSON in `submission/perf-before.json` /
`perf-after.json`):

| | Before | After |
|---|---|---|
| Plan | `Seq Scan` → `Sort` (top-N heapsort) → `Limit` | `Index Scan` on `(tenant,status,created_at DESC,id DESC)` → `Limit`, no Sort |
| Estimated vs. actual rows | Planner estimated 4,987 matching rows; actual 5,000 (close — `ANALYZE` had just run) | Planner estimated 5,038 rows scanned by the index condition; actual rows returned 50 (the `Limit` stops early) |
| Shared buffer hits | 409 | 5 hit + 3 read = 8 |
| Execution time (this run) | 3.655 ms | 0.079 ms |
| Result rows | 50 | 50, byte-identical to the pre-index run (`perf-ids-before.txt` vs `perf-ids-after.txt`, diffed, no differences) |

1. **Estimated vs. actual, selectivity, scans, sort, buffers**: the predicate `tenant='north' AND
   status='paid'` is ~10% selective (5,000 of 50,000 rows: every 2nd row is `north`, every 5th is
   `paid`) — selective enough that indexing beats a sequential scan, but not so selective that the
   difference would vanish. Before: a full `Seq Scan` reads all 50,000 rows (409 buffer hits) and
   feeds ~5,000 matches into a `Sort` node before the `Limit` truncates to 50. After: the `Index
   Scan` walks the composite index directly in the already-sorted order the query needs and stops
   after 50 rows — no `Sort` node exists in the after-plan at all.
2. **Why this column order**: the two equality-filtered columns (`tenant`, `status`) come first
   (a B-tree index is only useful as a prefix match), then the exact `ORDER BY` columns/directions
   (`created_at DESC, id DESC`) — so the index is already in the order the query needs and Postgres
   never materializes-then-sorts the matching set.
3. **Who pays for it**: every `INSERT`/`UPDATE` touching `tenant`, `status`, `created_at`, or `id`
   on `query_lab_orders` pays one extra B-tree maintenance write. A write-heavy workload with few
   reads of this exact shape would not be worth it.
4. **Can a sequential scan be correct on a small/low-selectivity table?** Yes — the real `orders`
   table in this fixture has 8 rows; a full scan of 8 rows is already faster than an index lookup
   (index traversal has fixed overhead a tiny table doesn't amortize), which is why no equivalent
   index is proposed for it. Low selectivity (a filter that matches most of the table) also favors
   a sequential scan even on a large table, since the planner would read nearly all pages either
   way and an index adds random I/O on top.
5. **Data-distribution/cache-state dependence**: this result assumes the `north`+`paid` combination
   stays ~10% selective — if the real distribution skewed to, say, 90% `paid` orders, a sequential
   scan could become cheaper again since the index would need to visit nearly every row anyway. The
   409-vs-8 buffer-hit comparison was also measured warm (right after `ANALYZE`, same session, OS
   page cache populated); a cold-cache read would add real disk I/O to *both* plans, likely
   narrowing the wall-clock gap even though the shared-buffer-hit reduction (and thus I/O avoided)
   remains structurally the same. No universal speedup is claimed from the one measured run above —
   the plan-shape change (no `Seq Scan`, no `Sort`) is the durable claim; the millisecond figures
   are this run's observation, not a guaranteed number.

## D. Migration and recovery note

No new constraint was needed for Part B's fixes (see §B — the load-bearing constraints were
already in `database/schema.sql`); this note covers the query-plan-lab index from §C as the
representative schema change:

- **Preflight**: `SELECT tenant,status,count(*) FROM query_lab_orders GROUP BY 1,2` to confirm the
  data distribution the index is being built for still holds, and (for a real production table)
  `SELECT count(*) FROM orders WHERE tenant IS NULL OR status IS NULL` to catch any row an index on
  those columns would silently misfile as an orphan/invalid grouping — zero rows expected given the
  `NOT NULL` constraints already on `orders.tenant`/`orders.status`.
- **Add/backfill/validate**: `CREATE INDEX CONCURRENTLY` (not the plain `CREATE INDEX` used in the
  lab, which briefly locks) against a live table, so writers are never blocked; verify with
  `\d+ orders` that the index reports `VALID`, not `INVALID` (a concurrent build can be left invalid
  if it's interrupted, and must then be dropped and retried, not assumed complete).
- **Locking/availability/compatibility**: `CREATE INDEX CONCURRENTLY` takes a lock that blocks other
  DDL but not normal reads/writes; an older app instance that doesn't know about the new index is
  unaffected either way, since an index is purely additive to what queries *can* use, never a
  requirement of what they must use.
- **Rollback limitations**: dropping the index (`DROP INDEX`) is fully safe and reversible at any
  point — no data was changed, only a derived structure. This is unlike a destructive migration
  (dropping/renaming a column): once new code has written data assuming a changed shape, rolling
  back the application without also restoring the prior column would corrupt whatever depended on
  it — additive changes like this index are chosen specifically to avoid that asymmetry.
- **Detecting partial progress / resuming safely**: `CREATE INDEX CONCURRENTLY` that fails partway
  leaves an `INVALID` index visible in `pg_indexes`/`\d+ <table>` rather than silently succeeding —
  the resume procedure is to `DROP INDEX` the invalid one and re-run `CREATE INDEX CONCURRENTLY`
  from scratch; it is not safe to assume a partially built index is usable, and the query planner
  will not use an invalid index, so a stuck build fails closed rather than serving wrong results.

`npm run db:reset` was never pointed at anything but the isolated lab schema (`assessment_lab` /
`assessment_test_<hex>` per `server/db.mjs`'s `assertLabSchema`), and evidence files were captured
before each reset that preceded a new scenario.
