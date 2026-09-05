# Business decisions

Evidence source: `submission/reconciliation.sql`, run against the reset lab schema
(`assessment_lab`) on PostgreSQL 16; raw output preserved in
`submission/reconciliation-output.txt`. All money is integer paise.

## 1. What the records actually establish

| Account | Paid orders | Gross revenue | Net revenue | Ad spend | Net ROAS |
|---|---|---|---|---|---|
| north | 2 | ₹2,500.00 | ₹2,200.00 | ₹550.00 | 4.00 |
| south | 2 | ₹2,000.00 (note: gross ₹2,500.00, one order fully refunded) | ₹2,000.00 | ₹400.00 | 5.00 |

By campaign (query 2):

| Account | Campaign | Paid orders | Net revenue | Spend | Net ROAS |
|---|---|---|---|---|---|
| north | n-search | 1 | ₹1,000.00 | ₹400.00 | 2.50 |
| north | n-social | 1 | ₹1,200.00 | ₹150.00 | 8.00 |
| south | s-search | 2 | ₹2,000.00 | ₹400.00 | 5.00 |

**Method, stated per the mission's evidence requirement:**
- Paid orders = `orders.status='paid'`, counted once, including `n-002` and `s-003` which were
  later **fully refunded** — a fully refunded order still counts as one paid order (data
  dictionary rule); it just reduces net revenue.
- Net revenue = gross paid-order amount minus **settled** refunds only. `r-n-2` (₹100.00,
  pending, on `n-001`) is excluded — pending refunds do not reduce net. `r-n-1` (₹300.00,
  settled, on `n-002`) and `r-s-1` (₹500.00, settled, on `s-003`) are included.
- Spend is summed independently from `ad_metrics` at its own grain (tenant/campaign/day), never
  derived from or joined against payment rows.
- Net ROAS = net revenue / spend, or `null` when spend is zero (not applicable to either account
  here).

## 2. Which claims are unsupported

**Marketing's claim — "the attributed conversion number is rising… our dashboard proves the
campaigns are profitable" — is not supported by receipts.** Query 3 in the reconciliation file
compares the ad platform's self-reported figures to what the payment ledger can actually prove:

| | Reported (attribution) | Actual (distinct succeeded payments) |
|---|---|---|
| north conversions / revenue | 9 / ₹10,300.00 | 3 / ₹2,500.00 |
| south conversions / revenue | 4 / ₹6,000.00 | 2 / ₹2,500.00 |

North's dashboard overstates conversions **3x** and revenue **~4.1x**; south overstates both
**2x**. This is a measurement-category error, not a business-performance one: `ad-metrics` is an
**attribution report** (the platform's own claim about what it caused), not a bank settlement
record. It does not know about refunds, duplicate/failed payment attempts, or which "conversion"
never actually completed a payment. Recommending a spend increase on the strength of that number
alone would be acting on the wrong instrument.

**Distinguishing the four failure modes the mission asks about:**
- **Bad measurement**: the marketing dashboard citing `reportedConversions`/`reportedRevenuePaise`
  as if they were receipts. This is the primary defect behind the founder's "prove it" ask.
- **Broken processing** (now fixed in `server/service.mjs`, see `submission/HANDOVER.md`): the
  starter's payment handler had no transaction boundary, no per-account isolation on single-order
  reads, and let a late-arriving event overwrite a payment's status by last-write-wins instead of
  precedence (`succeeded > failed > pending`). Query 5 shows the concrete case: order `n-001` has
  a late `failed` observation (`e-n1-late`, 2026-08-03) after two `succeeded` observations for the
  same payment (`p-n1`); the authoritative state is correctly `paid`/`succeeded`, but a
  timestamp-ordered ("last arrival wins") reducer would have shown `failed` — Operations' "some
  people appear paid in one place and pending [or failed] in another" complaint is this bug, not a
  data problem.
- **Missing data**: none of the paid-order or revenue figures above are blocked by missing
  fixture data; the gap is entirely in what the *attribution* report can know versus what the
  ledger can prove.
- **Genuine business performance**: net ROAS of 4.0 (north) and 5.0 (south) computed from actual
  receipts is still solidly positive. The campaigns are not unprofitable — the magnitude of
  profitability was just overstated by the wrong metric, and this reconciliation only covers ad
  spend against revenue; per the mission's instruction, it does not attempt to net out other costs
  (payment processing fees, refund handling, fulfilment cost, headcount) that a genuine
  profitability call would need.

## 3. Highest-value fix, second, and what not to build today

1. **Highest-risk/highest-value (done in Part 2):** the payment-event transaction boundary,
   status-precedence handling, and per-tenant order isolation in `server/service.mjs`. This is the
   only defect that can durably corrupt financial state (a failed order masquerading as paid or
   vice versa, or one account reading another's order) and the only one a retry/backfill cannot
   cleanly repair after the fact — see `submission/DATABASE.md` for the concurrency/rollback
   evidence.
2. **Second:** replace the marketing dashboard's headline metric with net-revenue-from-receipts
   and net ROAS (query 1/2 above) as the primary number shown to Marketing and the founder, with
   `reportedConversions`/`reportedRevenuePaise` demoted to a secondary "platform attribution"
   column labelled as an estimate. This is a display/reporting change, not a schema change, and it
   directly fixes the stakeholder trust problem without touching payment processing.
3. **What should not be built today:** a general ledger, a queue cluster, a real Meta Conversions
   API integration, or a causal-lift/incrementality testing platform. All three would consume the
   remaining timebox on infrastructure the two-account, single-campaign-family fixture does not
   yet justify, and none of them fix the actual defect (which was a missing transaction boundary
   and a mislabelled metric, not a lack of infrastructure).

## 4. Decision that needs a business owner

**Should spend increase today, based on the corrected (receipts-based) ROAS?**

- **Recommendation: no, not yet — hold spend and run the reconciliation as a recurring weekly
  report first.** Net ROAS of 4–5x from a 2-order, 1–2 campaign sample per account is too thin a
  sample to act on with confidence, and none of these numbers separate correlation (people who
  were shown an ad and also paid) from causal lift (people who paid *because* of the ad). Query 3's
  gap between attributed and actual conversions also means the campaign-level attribution itself
  is suspect, not just the account-level total — `n-search`'s 2.5x vs `n-social`'s 8.0x could
  easily reverse under accurate attribution.
- **Alternative A:** increase spend on `n-social` only (highest receipts-based ROAS), holding
  `n-search` flat, as a bounded ₹X/week experiment with a pre-committed stop date and the same
  receipts-based reconciliation as the read-out metric — smaller blast radius than an account-wide
  increase.
- **Alternative B:** do nothing to spend, and instead spend the same effort on the second-priority
  fix (replacing the attribution number with the receipts number in what stakeholders see) before
  making any budget call, since the current ask is being made on a number that has just been shown
  to be ~3–4x off.
- This is the founder's call, not an engineering one, because it trades a known measurement risk
  against real ad-platform spend; my recommendation is Alternative B, then A once the dashboard is
  trustworthy.

## 5. Marketing/measurement judgment (Part 5)

- **Attribution vs. receipts vs. unit economics vs. causal lift, kept separate:**
  - *Attribution* = `ad_metrics.reportedConversions`/`reportedRevenuePaise` — the platform's own
    claim, unverifiable from this fixture alone, and shown above to diverge sharply from receipts.
  - *Receipts* = `orders.status='paid'` + settled refunds, computed in query 1/2 — what the
    business can actually prove it collected.
  - *Unit economics* = net revenue and spend at the campaign grain (query 2) — a start, but
    incomplete: it excludes payment-processing fees, refund-handling cost, and fulfilment cost, so
    it is not yet a true contribution-margin figure.
  - *Causal lift* = whether the campaign caused the payment at all, which nothing in this fixture
    measures; the platform's "attributed conversion" is not lift, it is the platform's own
    heuristic credit assignment.
- **Would I change budget now?** No — see §4. The receipts-based ROAS is healthy but the sample is
  small and the attribution number it's meant to replace has just been shown to be unreliable by
  the same margin that would justify a "campaigns are profitable, increase spend" claim, which
  raises the bar for what evidence should unlock a budget change.
- **Measurement uncertainty that remains:** (1) no causal/incrementality signal exists in this
  fixture — a holdout or geo-split test would be needed; (2) the two accounts have only 2 paid
  orders each, too few to distinguish real seasonality/performance shifts from noise; (3) the
  refund lag (pending vs. settled) means "net revenue as of today" will keep shifting for orders
  with an open refund, so any dashboard snapshot needs a stated as-of time.
- **Smallest next experiment/reconciliation:** run the receipts-based reconciliation query
  (`submission/reconciliation.sql`, query 1) on a weekly cadence and compare its trend line to the
  attribution dashboard's trend line for 3–4 weeks before touching budget — if they move together,
  attribution is a usable leading indicator; if they diverge further, that itself is the finding to
  take to the founder.
- **Conceptual event-deduplication plan (per the mission, no real Meta account/token used):** if a
  browser pixel and a server-side Conversions API event were ever sent for the same purchase, they
  would need a stable, non-PII business identity — an internal order ID or a hashed idempotency
  key generated at checkout, sent as the platform's documented deduplication ID in both the browser
  and server payloads — plus a consent gate so the server-side event is only sent when the same
  consent state that would have allowed the pixel to fire was actually granted. This is a design
  note only; no ad account was created, no audience data imported, and no conversion event sent.
