# Engineering handover

## Exact start revision and submitted revision

- Start revision: `7dcd70a9c61906ee95504f0f5d8ce36db0109e26` (branch `submission/attempt-01`,
  branched from `candidate/attempt-01` at the same commit per `candidate/00_START_HERE.md`'s
  naming convention; starter tag `v1.0.0` unchanged).
- Submitted revision: see `git rev-parse HEAD` at package time — this file was written before the
  final commit; do not edit test logic or expected values after freezing per `07_SUBMISSION.md`.

## Environment versions (per `candidate/00_START_HERE.md`)

- Node: `v22.23.2` (`node --version`); npm: `10.9.8` (`npm --version`)
- OS: macOS 26.6.2 (build 25G83), Darwin kernel 25.6.0, arm64 (`sw_vers`, `uname -a`)
- PostgreSQL: `postgres:16-alpine` (pinned in `compose.yaml`; matches the `PostgreSQL 16` the
  contract requires)
- Flutter: `3.47.2` / Dart `3.13.2` (installed via `brew install --cask flutter` partway through
  this work, since no SDK was present initially — newer than the pack's validated 3.38.5/3.10.4;
  the pubspec's `>=3.10.0 <4.0.0` range permits it and `flutter analyze`/`flutter test` were both
  clean on this version — see `submission/LEARNING.md` for the caveat on dependency resolution
  drift this newer toolchain caused)

## Running and verifying

```bash
docker compose up -d db                 # PostgreSQL 16 lab, loopback-only, port 55439
export DATABASE_URL=postgresql://assessment:assessment@127.0.0.1:55439/assessment
node server/reset.mjs                   # {"schema":"assessment_lab","orders":8,"synthetic":true}
npm test                                # baseline scaffolding/safety suite: 9 pass, 0 fail
npm run build                           # Next.js production build: compiles clean, 2 static routes
npm run test:challenge                  # target acceptance suite: 13 pass, 0 fail (was RED on starter)
node --test tests/service-repair.test.mjs   # 3 targeted regressions: 3 pass, 0 fail
npm run typecheck                       # tsc --noEmit: clean
npm run test:e2e                        # Playwright, incl. the new stale-tenant race test: 3 pass
```

All of the above were actually executed against a real PostgreSQL 16 container for this
submission, not assumed. `submission/reconciliation-output.txt`, `submission/rollback-evidence.txt`,
`submission/perf-before.json` and `submission/perf-after.json` are raw captured output, not
hand-typed.

## Architecture and trust boundaries

```mermaid
flowchart LR
  subgraph Client["Browser (Next.js client component)"]
    UI[Recovery desk UI]
  end
  subgraph API["Node HTTP API (server/index.mjs)"]
    Route[Router + x-lab-tenant check]
    Service[service.mjs: paymentEvent, order, summary]
  end
  subgraph DB["PostgreSQL (durable state)"]
    Orders[(orders)]
    Payments[(payments)]
    Events[(payment_events)]
    Outbox[(outbox)]
    Audit[(audit)]
    Receipts[(provider_receipts)]
    Fulfil[(fulfilments)]
  end
  subgraph Worker["server/worker.mjs (polling loop)"]
    Job[processJobs]
  end
  Sim["server/provider.mjs — simulated provider\n(no network, local business-key lookup)"]

  UI -- "fetch /api/*\nx-lab-tenant header" --> Route
  Route -- "tenant-scoped calls" --> Service
  Service -- "1 transaction:\nevent+payment+order+outbox+audit" --> Orders & Payments & Events & Outbox & Audit
  Job -- "SELECT ... FOR UPDATE SKIP LOCKED" --> Outbox
  Job -- "accept business_key" --> Sim
  Sim -- "lookup-or-insert receipt" --> Receipts
  Job -- "1 transaction:\nfulfilment+outbox done+audit" --> Fulfil & Outbox & Audit
```

**Trust boundaries marked above:**
- *Durable state*: everything inside the PostgreSQL box. This is the only place "truth" lives;
  the API and worker are stateless between requests.
- *Transaction scope*: `service.paymentEvent` (one client, one `BEGIN…COMMIT`) and
  `worker.processJobs`'s per-job loop (one client, one `BEGIN…COMMIT` per job) are the two
  transaction boundaries. Nothing crosses between them — the worker's fulfilment transaction is
  separate from the transaction that created the outbox row, by design, because provider
  acceptance is a genuine uncertainty boundary (see `worker.mjs`'s comment on this).
- *Simulated provider boundary*: `provider.mjs` has no network call; it is a deterministic,
  durable, local lookup keyed on `business_key`, but it is architecturally treated as if it were an
  external system with its own commit — the worker cannot assume its own transaction and the
  provider's acceptance commit together.
- *Retry ownership*: the worker owns job retries (`FOR UPDATE SKIP LOCKED`, re-run via
  `processJobs` after a crash); the API does not retry anything itself — a failed
  `POST /api/payments/events` is the caller's (the gateway/provider's) responsibility to redeliver,
  which is exactly what `payment_events`' `(tenant,event_id)` uniqueness exists to make safe.
- *Account identity*: `tenant` is threaded through every query as an explicit column, never
  inferred from a shared ID space (`orders.id` is only unique per-tenant, per the schema's
  `UNIQUE(tenant,id)`).

## What is enforced where (Part 4 Q&A)

- **PostgreSQL**: uniqueness of `(tenant,event_id)` and `(tenant,payment_id)`, all foreign keys
  tying `orders`/`payments`/`refunds`/`outbox`/`audit`/`fulfilments` to a `(tenant,id)` pair,
  `CHECK` constraints on status enums and positive integer amounts, and the actual atomicity of
  each transaction (rollback-on-error). This is the only layer that can make "exactly one" claims
  durable under concurrent writers.
- **Application code** (`server/service.mjs`, `server/worker.mjs`): tenant-scoping every query,
  status-precedence business logic (`succeeded > failed > pending`), deciding *when* a business
  event should cause a side effect (one outbox job per genuine paid-transition, not per observed
  event), input validation (`common.mjs`'s `validateEvent`), and translating DB errors into
  sanitized HTTP responses without leaking SQL/stack traces.
- **Frontend** (`app/page.tsx`): request-freshness (ignoring superseded responses), loading/error/
  stale-state display, and preventing accidental double-submission of the worker trigger. It
  enforces *nothing* that matters for correctness — server-side idempotency is what actually
  protects money; the UI's disable-on-submit is a UX courtesy, not a safety mechanism.
- **Provider simulator** (`server/provider.mjs`): idempotent acceptance keyed by `business_key`
  (lookup-before-insert, `ON CONFLICT DO NOTHING` then re-select) — it is what allows the worker to
  safely retry after a crash without a duplicate accepted-side-effect.

## What changes with two API processes and two workers

Two API processes: **tested, not just reasoned about** — started two genuinely separate
`node server/index.mjs` OS processes (different PIDs, ports 4318/4319, no shared memory, both
pointed at the same Postgres), fired 5 concurrent identical-event-ID POSTs at each simultaneously
(10 total across both processes). Result: exactly 1 `duplicate:false`, 9 `duplicate:true`, and
direct DB inspection confirmed exactly 1 `payment_events` row and 1 `outbox` row — see
`submission/concurrency-evidence.txt` §"TRUE MULTI-PROCESS concurrency". This holds because every
write goes through Postgres's own transaction/lock machinery (`SELECT … FOR UPDATE` on the order
row, unique constraints on event/payment identity) — there is no in-process state (no in-memory
dedup set) that a second process could diverge from. I did not test more than two processes or
sustained/high-throughput multi-process load; the scaffold's own documented limit ("calibrated for
up to four concurrent invocations," `03_DATABASE.md`) was not stress-tested beyond this one
10-request burst.

Two workers: reasoned, not independently executed as two separate OS processes (only tested via
two concurrent `processJobs` calls within one process in the acceptance suite) — `processJobs`
claims jobs with `FOR UPDATE SKIP LOCKED`, so two workers polling the same `outbox` table would
split the queue without double-claiming a row; the `provider_receipts` unique `business_key` and
`fulfilments` unique `job_id` make a double-claim
harmless even in the unlikely case both workers raced to see the same "pending" row before either
locked it.

## Which failure requires reconciliation rather than a blind retry

A worker crash **after** `provider.mjs` has durably recorded a `provider_receipts` row but
**before** the worker's own transaction commits the `fulfilments` insert and marks the outbox job
`done`. A blind retry that just re-ran "insert a fulfilment" from scratch could create a second
fulfilment for one accepted receipt; the correct behavior (implemented, and covered by the
"provider acceptance followed by worker restart reconciles without duplicate fulfilment" test) is
for the retried job to look up the existing receipt via `acceptLocal`'s lookup-before-insert and
reconcile against it, producing exactly one fulfilment. This is the "receipt exists, local
completion does not" state the mission's `afterProviderAccepted` test hook is built to simulate.

## Deploying a schema change without hiding corruption, losing data, or breaking an older instance

1. Ship additive changes only in the first deploy: new nullable columns, new tables, new indexes
   (`CREATE INDEX CONCURRENTLY` in real production to avoid locking writers — see
   `submission/DATABASE.md`'s migration note). Never drop or rename a column an older running
   instance still reads/writes.
2. Backfill in a separate, batched, idempotent job — not inside the migration transaction — so a
   50M-row backfill cannot hold a long-lived lock or block the deploy.
3. Only after all instances are confirmed running the new code (and any grace period for rollback
   has passed) ship a second migration that drops the old column/constraint.
4. **Rollback limitations**: an additive migration (step 1) can be rolled back by just redeploying
   the old application binary — the extra column/table is simply unused. Once step 3's destructive
   migration has run, rollback is no longer clean: the dropped column's data is gone, so rolling
   back the application without also restoring the column from a backup would silently corrupt
   whatever depended on it. This is why destructive migrations are deliberately the *last*, most
   hesitant step, gated on the new code having run correctly in production first.

## What to monitor first, and what must never appear in logs

**Monitor first**: the rate of `500` responses from `POST /api/payments/events` (an unexpected DB/
worker failure is the one thing that can silently stall revenue recognition), `outbox` queue depth
per tenant (a growing backlog means the worker isn't keeping up or is stuck), and the count of
`payment_events` rows per `(tenant,payment_id)` that disagree in status with the `payments`
table's current row (a sign the precedence logic or a future change to it has a gap).

**Must never appear in logs**: raw payment amounts tied to identifiable customer data (this
fixture has no PII, but in a real system: card/account numbers, customer names/emails/phone
numbers), full SQL error text or stack traces returned to a client (already enforced —
`index.mjs` maps any non-`HttpError` to a generic `"Internal lab error"`), and the `DATABASE_URL`
connection string or any credential value.

## What changed / what did not

**Code changed:**
- `server/service.mjs`: transactional rewrite of `paymentEvent` (tenant-scoped `FOR UPDATE` lock,
  status precedence, exact-replay vs. conflicting-payload vs. new-transport-identity handling,
  outbox gated on genuine paid-transition), tenant filter added to `order()`, `summary()` rewritten
  to count distinct paid orders and net revenue instead of raw succeeded event rows.
- `app/page.tsx`: request-generation guard against stale/out-of-order responses, explicit
  loading/error/stale/ready state model, double-submission guard on the worker trigger.
- Tests added: `tests/service-repair.test.mjs` (3 backend regressions, each confirmed failing on
  the pre-fix code) and one new Playwright test in `tests/e2e/baseline.spec.ts` (stale-tenant
  race, confirmed failing on the pre-fix `page.tsx`).
- Evidence added: `submission/reconciliation.sql` + captured output, `submission/performance.sql`
  + before/after `EXPLAIN` JSON and identical-result-ID proof, `submission/rollback-evidence.txt`.

**Not changed / explicitly out of scope for this pass:**
- `server/provider.mjs`, `server/worker.mjs`, `server/reads.mjs`, `server/db.mjs`,
  `server/reset.mjs`, `server/index.mjs`, `database/schema.sql` — reviewed and found already
  correct against the contract (tenant-scoped reads, idempotent provider lookup, proper worker
  transaction/locking); no changes made.
- No live Meta/ad-platform integration, no general ledger, no queue cluster — see
  `submission/DECISIONS.md` §3 for why these are explicitly not built in this timebox.
- `submission/REVIEW.md`, `submission/AI_USAGE.md`, `submission/LEARNING.md`,
  `submission/AUTOMATION.md`, and the mobile/`exercises/` modules are separate submission
  artifacts tracked outside this handover; see each file for its own status.

## Remaining risks and next developer tasks

- **Overpayment / second-payment-on-a-paid-order semantics** are explicitly out of scope per the
  API contract ("Resolving genuine overpayments is out of scope") and were not implemented beyond
  "must not create a second fulfilment or revenue unit" — a real system would need an explicit
  design for what happens to the money on a second successful payment against an already-paid
  order.
- **The frontend's accessibility/keyboard/mobile-width pass** was preserved from the original
  markup rather than independently re-audited beyond what the existing Playwright mobile-width
  test checks; a full accessibility audit (screen-reader labels on the metrics cards, focus
  management on the record-inspection panel) was not performed and should be a follow-up.
- **The composite index proposed in `submission/performance.sql`** is validated only against the
  synthetic 50,000-row query lab, not against real production write volume/patterns; do not port
  it directly onto a live `orders`-equivalent table without re-measuring write cost there.
- **Net revenue in `submission/DECISIONS.md`** does not net out payment-processing fees, refund-
  handling cost, or fulfilment cost — it is a receipts-vs-attribution comparison and a starting
  unit-economics number, not a full profitability model.
