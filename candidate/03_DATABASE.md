# PostgreSQL challenge — primary gate (30 points)

This section is intentionally deep. Use **actual PostgreSQL** and show results. An ORM model diagram or an in-memory test is not sufficient database proof. Work only against the isolated `assessment` database provided by Compose.

## A. Reconcile before you mutate

Using the data dictionary and schema, derive account/campaign financial truth with SQL. Show why a naive join from orders to payment events can multiply money. Distinguish event identity from business payment identity. Handle repeated observations, status precedence, refunds, currency, time boundaries and account identity exactly as the published fixture contract defines them.

Deliver `submission/reconciliation.sql` and output. Include conservation checks: raw rows, unique business entities, valid/invalid or excluded records, and totals. Where a value cannot be inferred, report unknown rather than silently substituting zero. You may add CTEs, window functions or views, but justify the method and keep the original source rows auditable. The raw repeated-delivery feed is in the fixture JSON/CSV; the reset database contains canonical event identities, not every raw delivery. For raw-feed conservation, combine explicit file-source counts with SQL, or stage a source-preserving raw copy in your isolated schema. Do not expect canonical payment_events to contain repeated transport rows.

## B. Durable invariants and concurrent requests

Repair the core flow so the database protects the business effect under concurrent event delivery. The existing app may have superficially plausible application checks; demonstrate why your design survives races.

Required evidence:

- Replay the same event sequentially and concurrently.
- Send distinct event IDs referring to the same business payment.
- Verify the resulting order/event/fulfilment/outbox state directly, not only the HTTP status.
- Exercise a failed transaction and show what did **not** get committed.
- Exercise the same order ID through the wrong account context.
- Explain duplicate-safe constraints, foreign-key relationships and any state transition assumptions.

A correct answer explains where uniqueness belongs and why, not merely “use a transaction.” If you add a unique constraint, address existing duplicates before deployment. If you acquire a lock, explain what row/key it protects, ordering, timeout/deadlock considerations and the effect of multiple Node processes. Do not catch all integrity errors and call them success; distinguish a genuine replay from an invalid request.

## C. Query-plan lab

The supplied `database/performance.sql` creates a separate deterministic performance fixture; it does not need real company data. Run:

```bash
npm run db:performance
```

Inspect the script and schema first. Use `EXPLAIN (ANALYZE, BUFFERS)` on the target query before and after a narrowly justified index/query change. Put your experiment in `submission/performance.sql` and the plans in `submission/DATABASE.md` or a linked evidence file.

Explain:

1. Estimated versus actual rows, filter selectivity, scans, sorting and buffer work.
2. Why the chosen column order suits this predicate/order/limit pattern.
3. Which other workloads would pay for the index through writes/storage.
4. Whether a sequential scan can be the correct choice on a small/low-selectivity table.
5. How your conclusion depends on the supplied data distribution and cache state.

Do not claim a universal speedup from one wall-clock reading. There is no arbitrary millisecond pass threshold; plan reasoning and reproducible evidence matter. A proposal without a measured plan gets only partial credit.

## D. Migration and recovery note

Write a short deploy plan, not a production deployment:

- Preflight queries for duplicates/orphans/invalid values.
- How to add/backfill/validate the chosen constraint or index.
- Locking and availability risks, compatibility with old/new app versions.
- What rollback can and cannot reverse after new valid data has been written.
- How you would detect partial progress and resume safely.

No schema reset should be described as a production migration. `npm run db:reset` is a destructive **lab-only** convenience. Save your work/evidence before resetting. Never point it at another database.

## Scoring anchors (published)

| Database evidence | Maximum |
|---|---:|
| Source-backed reconciliation and conservation | 8 |
| Transactions, uniqueness, concurrency and rollback | 12 |
| Account/data integrity and schema reasoning | 5 |
| Actual query plans, index trade-offs and safe migration note | 5 |
| **Total** | **30** |

A suggested lead-readiness floor is 18/30 plus no unresolved mandatory duplicate-effect or cross-account invariant. Passing this section alone does not establish overall role fit. Do not trade correctness for a polished explanation.

## Scaffold operating boundary

The supplied worker is calibrated for up to four concurrent invocations. Pool-saturating worker load can cause bounded connection-acquisition timeouts; retry with available capacity recovers. High-load worker admission/pool redesign is optional, not a hidden core requirement. Preserve the provider's separate commit boundary when reasoning about recovery.

## Standards you should demonstrate naturally

Parameterised SQL; integer money; explicit timezones; source-preserving reconciliation; appropriate constraints; connection cleanup; transaction ownership on one connection; bounded queries; deterministic tests with independent variants; honest benchmark interpretation; least-privilege production design. Explain what remains only a simplified lab convention, especially fake account headers and lab-only credentials.
