# AI and assistance disclosure

Tool: Claude (Claude Code CLI), used throughout the practical PostgreSQL/Node/React work and the
written submission. No API keys or private transcripts are included below or elsewhere in this
submission.

## Affected files and what was generated vs. independently verified

- `server/service.mjs`: AI-generated the transactional rewrite (tenant-scoped `FOR UPDATE` lock,
  status-precedence logic, exact-replay/conflict/new-transport-identity handling, outbox-once-per-
  transition, and the `summary()` rewrite). Verification was not "it compiles" — I ran
  `npm run test:challenge` (the acceptance suite, 13/13, previously RED) and
  `node --test tests/service-repair.test.mjs` against a real PostgreSQL 16 container, and
  additionally confirmed each new regression test actually fails on the pre-fix code by
  `git stash`-ing the file and re-running (documented in `submission/HANDOVER.md`). I did not
  accept the transaction-boundary or precedence logic on the model's explanation alone — I traced
  the concurrent-duplicate and same-payment-different-event-ID test cases by hand against the
  seeded fixture data before trusting the implementation.
- `app/page.tsx`: AI-generated the request-generation guard, loading/error/stale state model, and
  double-submit guard. Verified with `npm run typecheck` (clean) and a new Playwright test
  (`tests/e2e/baseline.spec.ts`) that delays a stale tenant's response and asserts it never
  overwrites the newly selected tenant — confirmed failing on the original `page.tsx` (via
  `git stash`) before confirming it passes on the fix.
- `mobile/lib/main.dart`: AI-proposed the `_requestId` counter patch. Initially hand-traced against
  `mobile/challenges/latest_request_test.dart` (no Flutter SDK was available yet). Later installed
  Flutter (`brew install --cask flutter`) and executed the actual acceptance suite: confirmed all
  four tests genuinely fail on the unpatched starter (RED, `submission/mobile-red-evidence.txt`),
  then pass on the patch (GREEN, `submission/mobile-green-evidence.txt`), plus the full smoke suite
  (`submission/mobile-smoke-evidence.txt`) and `flutter analyze` (`submission/mobile-analyze-
  evidence.txt`) both clean. The hand-trace done before installation matched the executed result
  exactly, which is itself a useful check on the model's reasoning, not just the final patch.
- `submission/reconciliation.sql`, `submission/performance.sql`: AI-drafted the queries; every
  number quoted in `submission/DECISIONS.md` and `submission/DATABASE.md` was produced by actually
  executing these queries against the reset lab schema in a live PostgreSQL 16 container (via
  `docker exec ... psql`), not computed by the model from the fixture JSON in its head — I
  independently spot-checked the north/south gross-revenue and settled-refund arithmetic against
  `fixtures/seed.json` by hand (shown in the session) before trusting the SQL output. One AI-drafted
  query (the `GROUPING SETS` "unknown vs. zero" check) had a real bug on first execution — a bare
  `campaign_id IS NULL` check mislabelled the grand-total row itself as "UNKNOWN" — caught by
  running it and inspecting the actual output against known fixture facts (no order has a null
  campaign_id), then fixed to use Postgres's `grouping()` flag instead. Cross-tenant order access,
  sequential/distinct-event-ID replay, and true 10-way concurrent replay were also exercised live
  via `curl`/Node `fetch` against a running API process and real Postgres, with direct row
  inspection (not just HTTP status), preserved in `submission/concurrency-evidence.txt`. On review
  against `candidate/00_START_HERE.md`'s evidence standard, I found `submission/HANDOVER.md` had
  stated "two API processes: safe as-is" as reasoning rather than tested fact — I corrected this by
  actually starting two separate `node server/index.mjs` OS processes (different PIDs, different
  ports, sharing only Postgres) and firing concurrent identical-event-ID requests across both,
  rather than leaving an untested claim stated as settled.
- `submission/DECISIONS.md`, `submission/DATABASE.md`, `submission/HANDOVER.md`,
  `submission/REVIEW.md`, `submission/AUTOMATION.md`, `submission/LEARNING.md`: AI-drafted prose,
  built directly from the command output and query results captured during this session (the raw
  files are preserved: `reconciliation-output.txt`, `rollback-evidence.txt`, `perf-before.json`,
  `perf-after.json`, `perf-ids-before.txt`, `perf-ids-after.txt`). I reviewed each claim against
  its cited evidence file rather than accepting the prose at face value.

## Suggestions rejected or corrected

- An initial outbox-insert design keyed the `provider_receipts`/`outbox` business key off the raw
  event ID (matching the original starter's scheme); I required it be re-derived from the business
  payment ID instead, since keying off event ID would re-introduce a duplicate-fulfilment path for
  the "same payment, different event ID" case the contract explicitly tests.
- The first version of the "late failed/pending" regression test in `tests/service-repair.test.mjs`
  passed even against the unfixed starter code (confirmed by deliberately reverting and re-running
  it), which meant it wasn't actually exercising the precedence bug — I identified this via the
  stash-and-rerun check and had the test rewritten around a scenario (succeeded-then-later-failed)
  that does fail on the original code, rather than leaving a vacuous regression test in the
  submission.

## What I did not use AI for

The decision of which Part 1 fix to prioritize as "highest-value" (§3 of `submission/DECISIONS.md`)
and the budget recommendation in §4/§5 are my own judgment calls, applied to AI-surfaced evidence;
the separate reasoning-stage answers (per `candidate/01_REASONING.md`) used no AI, per that
section's own rule.
