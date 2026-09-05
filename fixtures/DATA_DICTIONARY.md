# Synthetic data dictionary and provenance

All records, amounts and campaign names are invented for this assessment. There are no real customers, contacts, phone numbers, emails, credentials or provider transactions. `seed.json` is canonical; CSVs are human-readable projections of its arrays and preserve repeat delivery rows. Do not infer truth from the starter's defective summary.

| Source | Grain / meaning | Caveat |
|---|---|---|
| `seed.json:tenants` | two lab tenants `north`, `south` | header-selected simulated auth |
| `seed.json:campaigns` | one synthetic campaign ID | ID and tenant both matter |
| `orders.csv` / `orders` | one order, positive integer `amountPaise`, INR, authoritative status snapshot | paid remains paid after a refund; createdAt is not gateway delivery time |
| `refunds.csv` / `refunds` | one refund ledger record | only `settled` subtracts net; pending does not; full refund still counts a paid order |
| `ad-metrics.csv` / `adMetrics` | one tenant/campaign/Asia-Kolkata calendar day | spendPaise authoritative for spend; reportedConversions and reportedRevenuePaise are attributed estimates, not payment truth |
| `gateway-deliveries.csv` / `paymentEvents` | one raw delivered event attempt | exact repeated event `e-n1`, new event ID for same business payment, late failure and offset/date boundaries |
| `seed.json:payments` | one current `(tenant,paymentId)` projection | succeeded dominates later failed/pending snapshots |

## Loading and reconciliation

`node server/reset.mjs` recreates only the guarded assessment schema and reads `seed.json` using parameterized inserts. Eight raw gateway delivery rows become seven canonical `payment_events` because the exact event ID duplicate is collapsed. Distinct event IDs for the same payment remain separate observations. Five payment projections and eight orders remain independent grains. Runtime outbox/audit/provider/fulfilment tables intentionally start empty: historical paid orders are already serviced and are not backfilled.

All money is **integer paise** (100 paise = INR 1); no float amount input. Count paid orders once, including fully refunded paid orders. Gross revenue is the sum of paid-order amounts; net revenue subtracts settled refunds linked to those orders. Pending refunds do not reduce net. Sum ad spend independently at its source grain. Net ROAS is net revenue divided by spend, or null when spend is zero. Derive each tenant’s totals from the fixtures and include reproducible SQL evidence.

Dates: `2026-08-02T00:05:00+05:30` is August 1 UTC but August 2 in the business calendar. `occurredAt` is provider observation time, `received_at` database ingestion time, and `createdAt` order creation time; do not interchange them. Ordering a status snapshot by timestamp cannot override the documented success precedence. Summary has no date filter; the timezone task concerns diagnosing daily exports.

Suggested diagnosis: compare reported conversions/revenue to distinct paid orders, account for retries and unsettled/settled refunds, state the time-zone convention and identify why campaign attribution is not accounting. Use SQL evidence rather than assuming the current API display is correct. `server/API_CONTRACT.md` governs all endpoint/business behavior. `database/performance.sql` is deliberately separate from this small financial fixture.
