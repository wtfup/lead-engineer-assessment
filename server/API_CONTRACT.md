# Synthetic assessment API contract

This contract is the target behavior, not a claim that the starter implements it correctly. The candidate-owned domain behavior is in `server/service.mjs`; the starter contains intentional defects whose effects must be diagnosed against this contract. Networking, reset, reads, validation and the supplied local worker are scaffolding. Core fixes plus SQL evidence are designed for the 85-minute backend block; production authentication, a real gateway, a general ledger, a queue cluster and an ORM rewrite are not required.

## Start and safety

Node >=22.13; PostgreSQL 16. Run the root dependency install and database setup in README, then `node server/reset.mjs` and `node server/index.mjs`. Default API `http://127.0.0.1:4318`; default DB `postgresql://assessment:assessment@127.0.0.1:55439/assessment`. These are intentionally public **lab-only** credentials. `DATABASE_URL` permits PostgreSQL URLs only, hosts `127.0.0.1`, `localhost` or Docker service `db`, database/user/password all `assessment`, no query or fragment overrides. The CLI binds only loopback. No third-party APIs, messages, money or company data.

`LAB_SCHEMA` defaults to `assessment_lab`. Reset destroys only that lab schema (or a generated `assessment_test_<24 hex digits>` schema), never the database. `createServer({pool})` returns a Node HTTP server; tests use ephemeral loopback ports and independent schemas. `SERVICE_MODULE` is an optional trusted **absolute local `.mjs`** factory override, never a request field or remote import. It exports `createService({pool})` with `summary`, `order`, `paymentEvent`; only use code you have reviewed. This is a code-execution hook, not a security sandbox.

All `/api/*` calls require `x-lab-tenant: north` or `south`. **This is simulated authentication, NOT real authentication or authorization suitable for deployment.** Every caller can choose either lab tenant. The exercise asks for isolation *after* the simulated tenant is selected. Do not expose the API publicly. No CORS wildcard is supplied; the frontend uses its local server proxy.

## Endpoints and JSON shapes

- `GET /health` (no header): `{status:"ok",database:"postgresql",synthetic:true}` after a real DB query.
- `GET /api/summary`: `{tenant,paidOrders,netRevenuePaise,adSpendPaise,roas}`; counts and money are JSON numbers, money integer paise; ROAS unrounded number or `null` if spend is zero.
- `GET /api/orders?limit=20&cursor=<opaque>`: `{items:[{id,tenant,campaignId,amountPaise,status}],nextCursor}`. `limit` integer 1..100. Stable ascending `id` keyset order, no offset; cursor is bound to the selected tenant. `nextCursor` is `null` at end. Snapshot-level pagination is not promised during concurrent inserts.
- `GET /api/orders/:id`: `{id,tenant,campaignId,amountPaise,status}` or **404** for missing/cross-tenant ID. IDs are 1..80 ASCII letters, digits, `_`, `-`.
- `GET /api/campaigns`: `{items:[{id,tenant,name,adSpendPaise}]}`, ascending ID, spend summed over supplied ad-metric rows.
- `GET /api/audit?order_id=n-003`: `{items:[{id,tenant,orderId,eventId,action,createdAt}]}`. Ascending audit ID (JSON string); `eventId` nullable for worker events; UTC timestamp. Missing/cross-tenant rows return empty `items`. Payment action `payment_<observed status>` describes the event, not necessarily a state transition; `fulfilled` records durable local fulfilment.
- `POST /api/payments/events`, `Content-Type: application/json`, exact body below. **200** for a newly recorded or safely repeated event: `{accepted:true,duplicate,orderId,orderStatus}`. `duplicate` means repeated *event ID*, not repeated business payment under a new event ID.
- `POST /api/jobs/process`: no body needed. Processes at most 100 pending jobs **for the selected tenant**, `{processed,remaining}`. Processing is deterministic and local. Call again if `remaining > 0`.

```json
{"eventId":"candidate-e1","paymentId":"candidate-p1","orderId":"n-003","status":"succeeded","amountPaise":90000,"currency":"INR","occurredAt":"2026-08-05T10:00:00+05:30"}
```

Event/payment/order identifiers follow the same ASCII ID grammar. Exactly the seven shown fields are allowed. `status` is `pending|failed|succeeded`; amount positive integer <=1,000,000,000 paise and must exactly equal the order amount; currency INR only. `occurredAt` must be an ISO timestamp with explicit UTC or offset. Bodies are capped at 16 KiB. Error body always `{error:string}`: **400** malformed input/header/cursor, **404** missing or wrong-tenant order, **409** business amount or reused identity conflict, **413** oversized, **415** non-JSON webhook, **500** injected/unexpected database/worker failure. Unexpected errors must not return SQL or stack traces.

## Authoritative business rules

1. One order, not one event, is the revenue unit. `paidOrders` counts `orders.status='paid'` even if fully refunded. Gross revenue is those order amounts once; net subtracts **settled** refunds linked to those paid orders. Pending refunds do not reduce net. No live refund API is required; the seeded refund ledger is authoritative. Do not join raw event or refund rows in a way that multiplies orders/spend. Ad-platform conversions/revenue are diagnostic attribution estimates, never accounting truth.
2. Summary covers the complete supplied snapshot, all dates, **only one selected tenant**. No date filter is required. Reporting calendar for the CSV diagnosis is Asia/Kolkata; timestamps have explicit offsets and normalize to instants. Compare business dates in the correct zone, not string prefixes. Refunds do not revert paid status.
3. Event identity is `(tenant,eventId)`. Exact semantic replay is 200 with no new event/audit/outbox/fulfilment. Equivalent timestamp offsets denote the same instant. A changed payload under that identity is 409 with no writes.
4. Business payment identity is `(tenant,paymentId)` and is permanently bound to one order/amount. Another event ID for that payment may add one observation/audit, but must not duplicate fulfilment. Payment identity reuse for another order is 409 and atomic. Different tenants may use the same IDs independently.
5. Status precedence is `succeeded > failed > pending`, **not last arrival wins**; order precedence is `paid > failed > pending`. A late failed event can be retained as evidence but cannot revoke success. A pending/failed payment can later succeed. A different payment on an already paid order may be recorded, but must not create a second fulfilment or revenue unit. Resolving genuine overpayments is out of scope.
6. New event, payment projection, order state, outbox intent and payment audit are one PostgreSQL transaction. A database failure at any write rolls everything back. Concurrent repeats must have the same outcome as sequential repeats. Database-backed identity/constraints and transaction ownership matter; an in-memory Set is not sufficient.
7. One newly paid order generates one durable fulfilment intent. Seeded paid orders are historical and already serviced **outside the replay window**; no backfill jobs should be created for them. Seed runtime outbox/audit/receipts/fulfilments start empty.
8. Provider acceptance and worker completion are separate durable states. The supplied provider uses a persisted business key and supports lookup/idempotent acceptance; a worker failure after acceptance must reconcile that receipt on retry, not invent a new key or blindly create another effect. No provider HTTP call exists. `afterProviderAccepted` is a programmatic test-only callback, not an HTTP fault flag.

## Test interpretation and timed incident

`npm test` is the **GREEN starter baseline**. `node --test tests/challenge.acceptance.test.mjs` is the desired behavior suite and is **intentionally RED on the starter**. Do not delete/skip assertions or change expected values to match the bug. Diagnose and fix the three defect families; retain green smoke coverage. Tests include concurrent exact repeats, business replays, tenant denial, rollback via a real PostgreSQL trigger, conflict handling and invalid inputs.

Timed incident: after a success has been accepted, a failed event with a later timestamp arrives. Demonstrate durable success precedence, explain why a timestamp-only reducer is wrong, and show the worker-restart/reconciliation test. The provider scaffold is supplied so this does not become a new queue-system implementation.

`database/performance.sql` creates a separate 50,000-row query lab. Capture `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` before and after your index/query improvement; explain row estimates, filters, sort/index access and write cost. Preserve identical result IDs. **No absolute millisecond pass threshold.**
