# Candidate: show ownership, offline

**Time: 40 minutes after setup passes.** Suggested pacing below. Work individually, with no Internet or AI assistance. This is not a memory/syntax contest. Speak your reasoning; honest uncertainty is better than an invented result.

Your starting implementation is `2790bc69abcc0a2ff2ed9dd67785cf392572f371`, including the latest two repairs. Green pre-existing tests do not finish this round. We need fresh reasoning, edits and execution witnessed by the supervisor.

## 1. Explain before touching code — 5 minutes

Open `server/service.mjs` and your existing `tests/service-repair.test.mjs`.

Trace one payment event through validation, transaction/lock, payment row, order row, outbox and audit. Distinguish transport event identity, payment identity and order identity. Then predict, before running anything:

- What happens if a different payment attempt is **pending** after an order was paid?
- What changes, and what must not change, if one paid order has multiple settled refunds plus a pending refund?

Point at the controlling code and state what your current tests actually assert. A test title is not proof of every status it mentions. Explain the boundary between a fulfilment intent and actual fulfilled work.

## 2. Repair a business statement using SQL — 12 minutes

Use `fixtures/seed.json`, `server/API_CONTRACT.md`, `submission/reconciliation.sql` and `submission/DECISIONS.md`.

1. Run the submitted reconciliation on the freshly seeded lab. Independently derive North's **distinct succeeded-payment count**. List the included/excluded payment identities and explain their statuses; don't read out a headline count alone.
2. Check whether the query labelled “actual, distinct succeeded payments” computes that definition. Make the smallest correction in `submission/reconciliation.sql` and correct the affected claim in `submission/DECISIONS.md`. Do not silently change the business definition to make the old number look correct.
3. Save SQL that demonstrates your correction on a temporary, rolled-back input change: add a new failed-only payment observation and then a retry observation for an existing succeeded payment. Predict which numbers should change and which should remain stable, run it, and reconcile any difference. Use `BEGIN` / `ROLLBACK` or an isolated test schema; do not edit `fixtures/seed.json`.
4. Explain whether this changes your original marketing/spend recommendation and why. Separate payment count, paid-order count, gross revenue and net revenue. Keep money units explicit.

Save the command output and changed-input SQL in `offline-evidence/`. Put concise conclusions in `offline/NOTES.md`.

## 3. Add missing tests and prove they detect a defect — 18 minutes

Create **`tests/offline-ownership.test.mjs`**. Reuse the local lab/API pattern in the existing test file; don't install anything.

### A. Different pending payment attempt

Against an isolated fresh lab, first complete a payment, then submit a **different payment ID** with status **pending** for that same order. Assert the API result, persisted order/payment state, audit/evidence retention and absence of duplicate fulfilment. Process the local worker and inspect durable results—an HTTP 200 or outbox count alone is not enough. Explain the expected result before execution.

### B. Mixed refunds

For one paid order, exercise multiple **settled** refunds and a **pending** refund. Assert the paid-order count and net-revenue effect separately. Then settle the pending refund and assert the expected change. Check that the other tenant's summary is unchanged. Derive expected deltas from the inserted amounts, not from the returned response itself. Use isolated test fixtures and preserve the original tests.

### Test sensitivity: already-fixed code should not be re-fixed

These new tests may immediately pass the latest service. That is fine: now demonstrate that they detect the older defect without overwriting your current service or weakening assertions.

The full cloned history contains the preceding submitted service. Export it as a temporary **negative control**, then use the existing `SERVICE_MODULE` hook:

```sh
git show 754e1d6de3e0d6618ae204a686b50a86f34202d7:server/service.mjs > server/offline-negative-control.mjs

docker compose -f offline/compose.yaml exec -T -e SERVICE_MODULE=/app/server/offline-negative-control.mjs lab node --test tests/offline-ownership.test.mjs > offline-evidence/negative-control.txt 2>&1
printf 'exit=%s\n' "$?" >> offline-evidence/negative-control.txt

# Normal invocation does not inherit the one-command SERVICE_MODULE override.
docker compose -f offline/compose.yaml exec -T lab node --test tests/offline-ownership.test.mjs > offline-evidence/latest-green.txt 2>&1
printf 'exit=%s\n' "$?" >> offline-evidence/latest-green.txt
```

The old service lives beside its original relative imports so it can load properly. A missing import, unavailable database or syntax error is **not** a valid RED result. Identify the exact failed business assertion and explain why it fails on the old service and passes on the new one. Do not commit the temporary `server/offline-negative-control.mjs`; move it into `offline-evidence/` after the control run.

Rerun `npm test`, `npm run test:repair` and `npm run test:challenge` through the same `docker compose -f offline/compose.yaml exec -T lab ...` prefix. Keep the new-test command separate: the existing named suites do not automatically include your new file.

If you discover a genuinely new defect, state it, write the failing test and make only the necessary correction. Do not refactor the whole service. If the clock expires, preserve the failure and explain the next step—never hide it.

## 4. Handover and defend — 5 minutes

Complete `offline/NOTES.md` and show the supervisor:

- What you personally changed and why; one concrete assumption or uncertainty.
- Exact commands, real outputs and what remains untested or unsafe.
- What you would ship, what you would defer, and the next engineer's first task with an acceptance check.
- One simple changed-input question from the supervisor. Predict first, then demonstrate if time allows. You are not expected to invent undocumented business policy.

## Permitted edit boundary

New test file; the diagnostic correction and associated written claim; `offline/NOTES.md`; private `offline-evidence/`; a minimal service correction **only if a fresh failure proves it necessary**; and the temporary old-service negative control above. Existing tests, fixtures/schema, package manifests, environment guards and lab configuration must remain intact. Temporary DB changes stay within the disposable lab/test schema. Do not use real data or contact any external provider/person.

## How this round is evaluated

On observed code understanding, correct source-backed business reasoning, meaningful new tests with sensitivity proof, and honest prioritisation/handover. Completing one part does not imply completing the others. A supervisor records **demonstrated / partial / not demonstrated** for each; there is no automatic hiring score from a green command. Setup delays are paused, not scored against you.
