# Practical mission — repair the business truth

## Scenario

Northstar has two isolated business accounts, North and South. Each buys advertising, captures leads and sells orders. The business has separate campaign reports, order records and asynchronous payment event history. Some events repeat. Some are delivered late. Some records do not justify a financial conclusion.

The recovery desk currently runs, but its numbers and processing behaviour have not earned trust. Treat every stakeholder statement below as a claim to investigate, not authoritative truth.

### Stakeholder notes — fictional

**Marketing:** “The attributed conversion number is rising. We should increase spend today. Our dashboard proves the campaigns are profitable.”

**Operations:** “Some people appear paid in one place and pending in another. We need a safe way to see the actual state and recover work. Please do not create duplicate orders or notifications.”

**Backend developer:** “We can check whether an event exists before inserting it, and mark the order complete immediately. The provider retries anyway.”

**Frontend developer:** “I can show whatever the summary endpoint returns. If requests fail, the previous numbers are probably better than an empty screen.”

**Founder:** “Give me the truth, the highest-value safe fix, and the decision you need from me. Do not bring me ten disconnected dashboards.”

## Inputs and authority

Read `fixtures/DATA_DICTIONARY.md`, `fixtures/seed.json`, the synthetic CSVs, `database/schema.sql`, and `server/API_CONTRACT.md`. The API contract and data dictionary define the exact semantics. The marketing report is an attribution report, not a bank settlement statement. Payment event rows are observations, not automatically unique paid orders.

All financial values use integer paise and currency is explicit. Compare timestamps with timezone awareness. Keep account identity in every relevant join. State any rows you exclude and why. Do not guess profitability from revenue/ad spend alone: other costs and attribution certainty matter.

## Part 1 — establish the truth

Write `submission/DECISIONS.md`, no more than two pages excluding evidence:

1. What do the records actually establish? Give paid-order count, gross/net revenue as defined in the data dictionary, spend and revenue/spend ratio by account/campaign where justified.
2. Which claims are unsupported? Distinguish bad measurement, broken processing, missing data and genuine business performance.
3. What is the highest-risk/highest-value technical fix? What is second? What should not be built today?
4. What decision, if any, genuinely needs a business owner? Give a recommendation and alternatives, not an unbounded list of questions.
5. Name the source and query for each number. Do not hand-type unexplained totals into the UI.

Keep your query in `submission/reconciliation.sql`. Run it against the real lab database and preserve output.

## Part 2 — PostgreSQL + Node core repair

The supplied service is intentionally incomplete. Repair the published business behaviour without weakening the contract. Preserve the API shape unless you document and implement a compatible migration.

### Mandatory behaviour

- Valid successful payments create the intended business effect once, including concurrent repeats and different transport event IDs referring to the same payment.
- Invalid amounts, unsupported currencies, unknown orders and account mismatches do not create successful fulfilment/outbox effects.
- Financial state changes, their durable event record and queued work have a defensible transaction boundary. A failure must not leave a partially completed business operation masquerading as success.
- Account-scoped APIs cannot return or mutate another account’s order. Testing only the list endpoint is insufficient.
- A late failure must not silently erase an authoritative success. Use the explicitly published provider/state rules; do not invent a reversal/refund from a failed event.
- Worker retries/restarts must not duplicate a confirmed simulator side effect. Explain received/accepted/completed/unknown states and what you can actually prove.
- Money is handled as integer paise, not floating-point currency arithmetic. SQL is parameterised; untrusted text never becomes SQL structure.

Write tests before or alongside each repair and show at least one meaningful failing-to-passing regression. The visible acceptance suite is not the entire grading universe. Do not hardcode seed-specific IDs or amounts. In-memory deduplication alone is not durable and is not enough.

The supplied simulator makes no real network calls. Do not replace it with a live provider. Extend it only inside the isolated lab to make a failure reproducible.

## Part 3 — React/Next primary-skill task

Make the existing recovery desk a trustworthy view of the selected account.

1. Rapid account switching must not let an old asynchronous response overwrite the new account’s data.
2. Loading, errors, empty results and stale data must be visually distinguishable. A previous account’s values must not be represented as current.
3. Recovery actions should show pending/result states and avoid accidental double-submission. Server-side invariants remain mandatory; button disabling alone is not idempotency.
4. The display must use the API’s integer-paise contract consistently and avoid invalid/misleading ratios.
5. Preserve accessible labels, keyboard operation, usable mobile width and a clear recovery flow.
6. Add at least one browser or component-level regression that would fail on the original behaviour. Explain client/server responsibilities and any relevant caching choice.

You are not being graded on a visual redesign. Do not spend the timebox rebranding the application. The existing UI is deliberately small so you can focus on async correctness and operational clarity.

## Part 4 — architecture and standards

Add a compact diagram to the handover showing the actual event/data flow and trust boundaries. Text or Mermaid is acceptable. Mark durable state, transaction scope, simulated provider boundary, retry ownership and account identity.

Answer concisely:

- What is enforced by PostgreSQL, by application code, by the frontend, and by the provider simulator?
- What changes when two API processes and two workers run concurrently?
- Which failure requires reconciliation rather than a blind retry?
- How would you deploy a schema change without hiding corruption, losing data or breaking an older application instance? Include rollback limitations.
- What would you monitor first, and what should never appear in logs?

Do not submit a catalogue of technologies. Explain why each component exists. A simple monolith with sound invariants is preferable to unjustified microservices.

## Part 5 — business and marketing judgment

This is an analytical task, not permission to operate Meta. In the decisions document, explain whether you would change budget now, what measurement uncertainty remains, and the smallest experiment or reconciliation you would run next. Separate attribution metrics, actual receipts, unit economics and causal lift.

Use official Meta documentation if helpful, but do not create an ad account, import audience data, send conversion events or use a real token. A conceptual browser/server event deduplication plan should specify stable identity and consent boundaries without claiming that our synthetic API is the real Meta API.

## Scope discipline

Mandatory code: one narrow, reliable PostgreSQL/Node flow plus the bounded React async/error-state repair. Mandatory evidence: SQL reconciliation, database plan reasoning, regression tests, secondary exercise responses, learning attempt and teammate-ready handover. Optional stretches: load testing beyond supplied cases, complete observability implementation, production-grade authentication design implementation, or a larger mobile feature. Optional work cannot compensate for a broken core invariant.

If time runs out, stop, preserve the exact state, and identify the remaining risk. Do not fabricate a clean run or quietly delete failures. Your ability to make a safe, honest delivery decision is part of the assessment.
