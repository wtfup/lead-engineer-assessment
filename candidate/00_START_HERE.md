# Candidate handbook — start here

## Your role in this exercise

You are acting as the hands-on engineering lead of **Northstar**, a fictional subscription-commerce business. The founder is unavailable during the exercise. Marketing wants to increase spend. Operations distrusts the numbers. A developer has suggested a quick patch. Your job is to establish what is true, choose a safe intervention, deliver working code and leave another engineer able to continue.

The assessment is designed for a senior full-stack engineer with Node/TypeScript, React/Next, PostgreSQL, technical leadership and AI/workflow experience. It tests primary skills deeply and secondary skills proportionately. You do not need to know Flutter already. You are not expected to build an entire business platform in four hours.

## Before starting the clock

Ask the coordinator to confirm the paid-trial terms and time allowance before work starts; no amount or employment offer is implied by this repository. Agree any reasonable accessibility or scheduling accommodation up front. The assessment uses only fictional material and is not assigned production work.

1. Clone `assessment/start`, create `submission/attempt-01`, record the starting commit.
2. Install dependencies and start only the supplied local lab. Get the recovery desk and database working.
3. With no dev server running, run `npm test`, `npm run build`, then `npm run typecheck`. Start `npm run dev` afterwards; do not build and run dev against the same generated directory concurrently. Record the output. If baseline setup fails, ask for environment help before starting. Do not spend your timed assessment fixing an organiser’s installation problem.
4. Confirm the intended failing business tests with `npm run test:challenge`. Their failure is not an installation blocker.
5. Read the table of contents, scope, standards and rules. Do not inspect timed reasoning questions or the timed change card early.
6. Confirm a private return route for exported reasoning answers and any recording with the coordinator. No external email address or recipient is assumed by this pack.

Record Node, npm, OS, PostgreSQL and Flutter versions in your handover. Docker installation, package downloads and browser SDK setup are outside the timed work. If a machine/network fault occurs, notify the coordinator and log the interruption; an extension is a coordinator decision, not something to conceal.

## Stage A — 40-minute independent reasoning

Open the hosted reasoning form, or use the printable paper if necessary. Use an attempt ID, not your email/phone. No AI, search, code execution, calculator or hidden assistance in this stage; rough paper is allowed. Questions are self-contained. For select-all, choose every supported answer and no unsupported answer. Unanswered questions are allowed. There is no negative marking for unanswered items.

The form autosaves locally when browser storage is available; download a copy before leaving. At timeout it locks input but still permits export. It does not send answers to a server. The timer is not tamperproof; this is an honour/proctor boundary. If storage fails, the form must still allow you to export. Hand the result to the coordinator privately. **Do not commit or publish reasoning answers.**

This is a reasoning work sample, not a clinically validated intelligence test. Objective responses may be scored against a private answer key. Any integrity-related response is a human-review signal, not proof of your character.

## Stage B — 200-minute practical

Run `npm run session -- start` after completing Stage A. Keep the original start record. Suggested working order:

| Practical time | Focus | Minimum useful output |
|---|---|---|
| 0–20 min | Read the business evidence and plan | Source-backed findings, unknowns, chosen scope |
| 20–105 min | PostgreSQL and API | Reconciliation query, bounded transactional repair, concurrency tests |
| 105–135 min | React/Next | Correct account state and useful failure behaviour, browser proof |
| 135–150 min | AI/workflow review | Unsafe-path analysis and deterministic guard recommendations |
| 150–170 min | Unfamiliar module | Small documented Flutter/Dart change and honest proof |
| 170–200 min | Team review and handover | Review, delegation plan, evidence index, final status |

At minute 110, run `npm run session -- card`. It may require reprioritisation. The schedule is guidance; you own trade-offs and may reallocate time. The deadline stays fixed unless the coordinator explicitly pauses or extends it.

## Core acceptance expectations

- Financial metrics are derived from documented business truth, not ad-platform attribution or the count of webhook rows.
- Repeated/concurrent events do not duplicate a business effect. Use PostgreSQL for durable invariants; process-local memory alone is insufficient.
- A failed, invalid or mismatched event cannot create a successful business outcome. Distinguish received, validated, recorded, completed and reconciled states.
- Account identity applies at backend data access, not merely a frontend dropdown. Lab headers simulate authenticated context; they are not real authentication.
- You can explain transaction boundaries, rollback behaviour and what happens after a worker restart.
- The web UI has trustworthy account state, clear loading/error/empty states, and does not silently show stale values as current.
- Your SQL/performance reasoning is backed by actual PostgreSQL output rather than a memorised “add an index” answer.
- Your work is runnable by a teammate without personal IDE state, credentials or undocumented manual changes.

See the mission and database documents for exact contracts. The backend API contract and data dictionary define data semantics. Where a proposed change would break that contract, document the conflict and do not silently redefine truth.

## Allowed and prohibited

**Allowed during practical:** official documentation, ordinary search, package documentation, AI coding assistants with disclosure, small open-source examples with attribution, your normal editor and terminal. Explain what the tools generated and how you checked it. Reusing provided infrastructure is preferred to needless rewrites.

**Not allowed:** assistance from another human doing the work, undisclosed help in the no-AI stage, employer code or confidential data, real platform credentials, live campaigns/messages/payments, pretending mocks are live proof, modifying test reports instead of behaviour, deleting tests to claim success, uploading personal information or reasoning answers publicly.

If you change a supplied test because you believe it contradicts the published contract, keep the original, add a new test and explain the discrepancy. Held-out evaluation will not trust your test changes automatically. A justified contract objection is welcome; silent weakening is not.

## Published scoring and gates

Reasoning 15; PostgreSQL 30; Node/API 15; React/Next 15; AI/workflows 10; unfamiliar learning 5; teamwork/standards/handover 10. Total 100.

A suggested meeting-shortlist threshold is 75/100, **with** at least 18/30 PostgreSQL, 9/15 Node and 9/15 React, and independently verified core safety/correctness. These are assessment rules, not a job offer or an automatic employment decision. Strong overall points cannot erase an unresolved core cross-account leak or duplicate business effect. Work acknowledged as incomplete receives partial credit where independently supported. Do not hide a gap to chase a green score.

Qualitative work is reviewed by a human/technical evaluator using anchored rubrics, not auto-marked by matching prose to a string. The teamwork section tests a simulated interaction and handover; it cannot prove how you behave in a real team over time.

## Evidence standard

Every important claim should point to a command, query, test, file/line, captured response or documented source. Keep code and explanation aligned. Save stdout/stderr and exit codes where useful. A screenshot of a green terminal is weaker than a reproducible command with the exact source revision. “It works locally” needs reproduction instructions. “Production-ready” requires more than this exercise can demonstrate.

Examples of useful statements:

- “The replay test now passes against PostgreSQL; I have not load-tested across multiple API processes.”
- “The query plan uses the proposed index on the supplied distribution; production selectivity is unknown.”
- “I reviewed the Flutter change but could not execute it because the SDK was unavailable; here is the exact unverified boundary.”

## FAQ

**Do I need to meet the founder first?** No. This pack is designed to be self-guided. The coordinator handles start/end and environment issues. Meaningful business questions should be written in your decisions document; make explicit, reversible assumptions where appropriate.

**Do I have to finish everything?** Core correctness and judgment matter most. The timebox is intentionally demanding. Prioritise, show real depth, and label unfinished work. Optional stretches are not hidden mandatory work.

**Should I rewrite the app or switch databases?** Usually no. Explain an exceptional reason before doing so. A rewrite that avoids demonstrating PostgreSQL, Node and React does not meet the primary-skill assessment.

**Can I use AI?** Not in reasoning. Yes in practical with disclosure, understanding and verification. No account/key is provided or required for a real LLM; the AI exercise is offline.

**Can I ask questions?** Yes. High-value clarification is good. Requiring the founder to make every technical choice is not. Do not let an unanswered noncritical preference block a safe, bounded decision.

**Do the visible tests contain the whole answer?** No. They are examples of the published contract. Independently generated cases may vary IDs, values, timing, accounts, retries and concurrency without changing the requirements.

**Can I submit a ZIP instead of a public PR?** Yes. Use the private handover route in the submission guide. Do not publish personal or cognitive-response data.

**Can I change time settings or inspect future files?** Technically public files and local clocks are inspectable. Do not misrepresent what you did. This pack does not claim secure exam lockdown.

**What should I not build?** No real advertising integrations, authentication platform, billing product, multi-agent system, Kubernetes cluster, fancy animations or full mobile app. Explain the necessary production changes as a short roadmap instead.
