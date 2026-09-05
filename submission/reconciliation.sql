-- Reconciliation evidence for submission/DECISIONS.md and submission/DATABASE.md.
-- Run against the guarded lab schema after `node server/reset.mjs`:
--   docker exec -e PGPASSWORD=assessment <db-container> psql -U assessment -d assessment -f submission/reconciliation.sql
-- (or `psql "$DATABASE_URL" -f submission/reconciliation.sql` if a local psql client is on PATH).
-- Every query is scoped by tenant explicitly; none joins raw event/refund rows in a way that
-- multiplies orders or spend. Money is integer paise throughout; no float arithmetic.
SET search_path TO assessment_lab;

-- 0a. PROOF THAT A NAIVE JOIN MULTIPLIES MONEY. Joining orders directly to payment_events
-- (one order can have multiple observations: retries, a late failure, etc.) and summing
-- amount_paise per row double/triple-counts revenue for any order with more than one observation.
-- Compare this to query 1 below, which sums amount_paise once per PAID ORDER, not once per event row.
SELECT o.tenant, o.id AS order_id, o.amount_paise AS true_order_amount_paise,
       count(pe.id) AS observation_count,
       count(pe.id) * o.amount_paise AS naive_join_sum_paise, -- WRONG: multiplies by observation count
       o.amount_paise AS correct_amount_paise                  -- RIGHT: counted once regardless of observations
FROM orders o JOIN payment_events pe ON pe.tenant = o.tenant AND pe.order_id = o.id
WHERE o.id = 'n-001'
GROUP BY o.tenant, o.id, o.amount_paise;
-- n-001 has 3 canonical payment_events (e-n1, e-n1-retry, e-n1-late) for one INR 1,000.00 order.
-- A naive `SUM(pe.amount_paise)` (or `COUNT(pe.id) * order.amount_paise`) reports INR 3,000.00 —
-- 3x the true amount. Event identity (one row per delivered/retried observation) is not business
-- payment identity (one row per (tenant,payment_id)), and neither is the revenue unit — the
-- ORDER is the revenue unit (business rule 1 in server/API_CONTRACT.md).

-- 0b. RAW-FEED CONSERVATION: stage the raw gateway delivery feed (fixtures/gateway-deliveries.csv /
-- seed.json:paymentEvents, 8 rows, preserving the exact transport-level duplicate) source-preserving
-- in an isolated staging table, and compare its count to the canonical payment_events table's count.
DROP TABLE IF EXISTS raw_gateway_deliveries_staging;
CREATE TEMP TABLE raw_gateway_deliveries_staging (
  event_id text, payment_id text, order_id text, tenant text,
  status text, amount_paise integer, currency text, occurred_at timestamptz
);
-- Values below are copied verbatim from fixtures/gateway-deliveries.csv (8 rows including the
-- exact e-n1 duplicate) so the raw feed is auditable independently of what reset.mjs deduplicated.
INSERT INTO raw_gateway_deliveries_staging VALUES
  ('e-n1','p-n1','n-001','north','succeeded',100000,'INR','2026-08-01T18:26:00Z'),
  ('e-n1','p-n1','n-001','north','succeeded',100000,'INR','2026-08-01T18:26:00Z'), -- exact transport duplicate
  ('e-n1-retry','p-n1','n-001','north','succeeded',100000,'INR','2026-08-01T18:27:00Z'),
  ('e-n1-late','p-n1','n-001','north','failed',100000,'INR','2026-08-03T01:00:00Z'),
  ('e-n2','p-n2','n-002','north','succeeded',150000,'INR','2026-08-01T18:36:00Z'),
  ('e-n4','p-n4','n-004','north','failed',60000,'INR','2026-08-01T20:31:00Z'),
  ('e-s1','p-s1','s-001','south','succeeded',200000,'INR','2026-08-01T21:01:00Z'),
  ('e-s3','p-s3','s-003','south','succeeded',50000,'INR','2026-08-02T02:01:00Z');
SELECT
  (SELECT count(*) FROM raw_gateway_deliveries_staging) AS raw_feed_rows,
  (SELECT count(DISTINCT (tenant,event_id)) FROM raw_gateway_deliveries_staging) AS unique_transport_identities_in_raw_feed,
  (SELECT count(*) FROM payment_events) AS canonical_payment_events_rows,
  (SELECT count(DISTINCT (tenant,payment_id)) FROM raw_gateway_deliveries_staging) AS unique_business_payments_in_raw_feed,
  (SELECT count(*) FROM payments) AS canonical_payments_rows;
-- Expected/observed: 8 raw rows, 7 unique (tenant,event_id) transport identities in the raw feed
-- (the e-n1 duplicate collapses), 7 canonical payment_events rows (matches — conservation holds:
-- reset.mjs's ON CONFLICT (tenant,event_id) DO NOTHING is exactly transport-identity dedup, nothing
-- more, nothing less). 5 unique (tenant,payment_id) business payments in the raw feed (p-n1 appears
-- 3 times), 5 canonical payments rows (matches).

-- 0c. WHERE A VALUE CANNOT BE INFERRED, REPORT UNKNOWN RATHER THAN ZERO.
-- orders.campaign_id is nullable (see database/schema.sql) even though no seeded row is null today;
-- a per-campaign revenue rollup must not silently fold a future null-campaign order into 0 spend/
-- revenue for some other campaign, and must not drop it from the total silently either.
SELECT
  CASE WHEN grouping(o.campaign_id) = 1 THEN 'GRAND TOTAL (all paid orders)'
       WHEN o.campaign_id IS NULL THEN 'UNKNOWN — order has no campaign attribution'
       ELSE o.campaign_id END AS campaign_attribution,
  count(*) AS paid_orders, sum(o.amount_paise) AS gross_revenue_paise
FROM orders o WHERE o.status = 'paid'
GROUP BY GROUPING SETS ((o.campaign_id), ())
ORDER BY grouping(o.campaign_id), campaign_attribution;
-- grouping(o.campaign_id)=1 marks the () grand-total row (Postgres's own aggregation-level flag),
-- which is what distinguishes "this is the total" from "this order's campaign_id is actually
-- null" — a naive `campaign_id IS NULL` check alone cannot tell those apart, which would have
-- mislabelled the total row itself as 'UNKNOWN' (as an earlier draft of this query did). In this
-- snapshot no paid order actually has a null campaign_id, so no 'UNKNOWN' row appears; the query
-- is kept so a future null-campaign order surfaces as its own labelled row, included in the grand
-- total, rather than being silently dropped or folded into 0 for some other campaign.

-- 1. Authoritative paid-order count, gross/net revenue and spend/ROAS, per account.
-- One order = one revenue unit (orders.status='paid'), even if it was later fully refunded.
-- Net revenue = gross paid-order amount minus SETTLED refunds only (pending refunds do not reduce net).
-- Spend is summed independently from ad_metrics at its own grain, never derived from payment rows.
WITH paid AS (
  SELECT tenant, id AS order_id, campaign_id, amount_paise
  FROM orders WHERE status = 'paid'
),
settled_refunds AS (
  SELECT tenant, order_id, sum(amount_paise) AS refunded_paise
  FROM refunds WHERE status = 'settled' GROUP BY tenant, order_id
),
revenue AS (
  SELECT p.tenant,
         count(*)::int AS paid_orders,
         sum(p.amount_paise)::bigint AS gross_revenue_paise,
         sum(p.amount_paise - COALESCE(r.refunded_paise, 0))::bigint AS net_revenue_paise
  FROM paid p
  LEFT JOIN settled_refunds r ON r.tenant = p.tenant AND r.order_id = p.order_id
  GROUP BY p.tenant
),
spend AS (
  SELECT tenant, sum(spend_paise)::bigint AS ad_spend_paise
  FROM ad_metrics GROUP BY tenant
)
SELECT r.tenant, r.paid_orders, r.gross_revenue_paise, r.net_revenue_paise,
       s.ad_spend_paise,
       CASE WHEN s.ad_spend_paise > 0 THEN round(r.net_revenue_paise::numeric / s.ad_spend_paise, 4) END AS net_roas
FROM revenue r JOIN spend s USING (tenant)
ORDER BY r.tenant;

-- 2. Same breakdown by account/campaign, so a per-campaign spend decision has evidence
-- (not just an account-level average). Revenue is attributed to a campaign via the paid
-- order's own campaign_id, never via the ad platform's self-reported conversions.
WITH paid AS (
  SELECT tenant, id AS order_id, campaign_id, amount_paise
  FROM orders WHERE status = 'paid'
),
settled_refunds AS (
  SELECT tenant, order_id, sum(amount_paise) AS refunded_paise
  FROM refunds WHERE status = 'settled' GROUP BY tenant, order_id
),
revenue AS (
  SELECT p.tenant, p.campaign_id,
         count(*)::int AS paid_orders,
         sum(p.amount_paise - COALESCE(r.refunded_paise, 0))::bigint AS net_revenue_paise
  FROM paid p
  LEFT JOIN settled_refunds r ON r.tenant = p.tenant AND r.order_id = p.order_id
  GROUP BY p.tenant, p.campaign_id
),
spend AS (
  SELECT tenant, campaign_id, sum(spend_paise)::bigint AS ad_spend_paise
  FROM ad_metrics GROUP BY tenant, campaign_id
)
SELECT c.tenant, c.id AS campaign_id, c.name,
       COALESCE(rv.paid_orders, 0) AS paid_orders,
       COALESCE(rv.net_revenue_paise, 0) AS net_revenue_paise,
       COALESCE(s.ad_spend_paise, 0) AS ad_spend_paise,
       CASE WHEN COALESCE(s.ad_spend_paise, 0) > 0
            THEN round(COALESCE(rv.net_revenue_paise, 0)::numeric / s.ad_spend_paise, 4) END AS net_roas
FROM campaigns c
LEFT JOIN revenue rv ON rv.tenant = c.tenant AND rv.campaign_id = c.id
LEFT JOIN spend s ON s.tenant = c.tenant AND s.campaign_id = c.id
ORDER BY c.tenant, c.id;

-- 3. Attribution vs. receipts diagnostic: reported ad-platform conversions/revenue next to what the
-- ledger can actually prove (distinct succeeded payments and their sum), by tenant. This is the
-- number marketing is citing ("attributed conversion number is rising") set beside payment truth.
SELECT tenant,
       sum(reported_conversions)::int AS reported_conversions,
       sum(reported_revenue_paise)::bigint AS reported_revenue_paise
FROM ad_metrics GROUP BY tenant
UNION ALL
SELECT tenant || ' (actual, distinct succeeded payments)',
       count(DISTINCT payment_id)::int,
       (SELECT sum(amount_paise) FROM payments WHERE payments.tenant = pe.tenant AND status = 'succeeded')::bigint
FROM payment_events pe GROUP BY tenant
ORDER BY 1;

-- 4. Repeat/duplicate delivery evidence: eight raw gateway delivery rows collapse to seven distinct
-- payment_events because the exact event ID duplicate (e-n1) is deduplicated by the (tenant,event_id)
-- unique constraint; the retry (e-n1-retry) is a legitimate new transport identity for the same
-- business payment (p-n1) and must not be counted as a second paid order.
SELECT tenant, payment_id, order_id, count(*) AS observation_count,
       array_agg(event_id ORDER BY occurred_at) AS event_ids,
       array_agg(status ORDER BY occurred_at) AS statuses_in_arrival_order
FROM payment_events
GROUP BY tenant, payment_id, order_id
HAVING count(*) > 1
ORDER BY tenant, payment_id;

-- 5. Status precedence evidence: p-n1 (north/n-001) has a late FAILED observation
-- (e-n1-late, occurred_at 2026-08-03) arriving after the SUCCEEDED ones. The authoritative
-- order/payment status must remain paid/succeeded — precedence, not last-arrival-wins.
SELECT o.tenant, o.id AS order_id, o.status AS authoritative_order_status,
       p.status AS authoritative_payment_status,
       (SELECT status FROM payment_events pe WHERE pe.tenant = o.tenant AND pe.order_id = o.id
        ORDER BY occurred_at DESC LIMIT 1) AS status_if_last_arrival_wins_instead
FROM orders o JOIN payments p ON p.tenant = o.tenant AND p.order_id = o.id
WHERE o.id = 'n-001';

-- 6. Timezone boundary evidence: order creation timestamps stored in UTC that fall on a different
-- calendar day once read in the Asia/Kolkata business timezone the ad-platform reports (ad_metrics.day)
-- are already expressed in. A UTC-date GROUP BY would misalign these against ad_metrics.
SELECT id, tenant, created_at AS created_at_utc,
       created_at AT TIME ZONE 'Asia/Kolkata' AS created_at_ist,
       created_at::date AS utc_calendar_date,
       (created_at AT TIME ZONE 'Asia/Kolkata')::date AS ist_calendar_date
FROM orders
WHERE created_at::date <> (created_at AT TIME ZONE 'Asia/Kolkata')::date
ORDER BY tenant, created_at;

-- 7. Excluded rows and why (state explicitly, per the mission's evidence requirement):
--   * refunds.status='pending' (r-n-2, north/n-001, 10000 paise) is excluded from net revenue:
--     the data dictionary states only settled refunds subtract net.
--   * payment_events with status IN ('failed','pending') are excluded from paid-order counts and
--     revenue: only orders.status='paid' is the revenue unit, and only succeeded payments back it.
--   * The late failed observation on p-n1 (e-n1-late) is retained as an audit trail row but excluded
--     from the authoritative status per business rule 5 (succeeded > failed > pending precedence).
--   * ad_metrics.reportedConversions / reportedRevenuePaise are never summed into paid-order counts
--     or revenue anywhere above: they are attribution estimates, not payment truth (see query 3).
--   * Historical seed payments/orders that were already 'paid' before this snapshot are not
--     backfilled into outbox/fulfilment tables; this reconciliation reads orders/payments/refunds/
--     ad_metrics directly and is unaffected by that runtime-table exclusion.
