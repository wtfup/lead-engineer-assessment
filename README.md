# Lead Engineer — Founder’s Technical +1

**A four-hour, evidence-first assessment. PostgreSQL, Node/TypeScript and React/Next are the primary gates.**

This is a job simulation, not a trivia contest, a certified IQ test, or free production work. You will reconcile conflicting business evidence, repair a deliberately imperfect local application, review another developer’s work, reason about AI automation, and learn a small unfamiliar module.

**Start here:** [Candidate handbook](candidate/00_START_HERE.md) · [Hosted assessment desk](https://wtfup.github.io/lead-engineer-assessment/) · [Downloadable documents](documents/) · [Reasoning test](https://wtfup.github.io/lead-engineer-assessment/cognitive.html)

> Everything in this repository is synthetic. The fictional company is **Northstar**. No real customer data, company databases, advertising accounts, payment providers, messages, LLM credentials, or production systems are required or permitted. The application deliberately contains assessment defects. **Do not deploy the API or database publicly.** GitHub Pages hosts instructions and the reasoning form, not the backend.

## What to do, in order

1. Read [00 — Start here](candidate/00_START_HERE.md). Confirm the scope, rules, scoring, prerequisites, and submission route.
2. Clone the starter and get the local environment working **before the clock starts**.
3. Complete [01 — Reasoning](candidate/01_REASONING.md), 40 minutes, **no AI**. Export your answers privately; do not commit them.
4. Start the 200-minute practical with `npm run session -- start`.
5. Read [02 — Business mission](candidate/02_MISSION.md) and [03 — PostgreSQL/database challenge](candidate/03_DATABASE.md). Prioritise a narrow, correct end-to-end repair over a broad rewrite.
6. Complete the bounded [AI/workflow](candidate/05_AUTOMATION.md), [unfamiliar learning](candidate/04_LEARNING.md), and [teamwork/code-review](candidate/06_TEAMWORK.md) tasks. Learning is assessed separately from claimed expertise.
7. At practical minute 110 run `npm run session -- card`. The change card is public; the timing rule is procedural, not a secret-lock claim.
8. Finish using [07 — Submission](candidate/07_SUBMISSION.md). Deliver code, evidence, decisions and handover. Report incomplete work honestly.

## Starter branches and your own work

- `main`: published assessment and documentation.
- `assessment/start`: pinned starting branch for the exercise.
- `candidate/attempt-01`: convenience starting branch, **not** a grant of repository write access.

```bash
git clone --branch assessment/start https://github.com/wtfup/lead-engineer-assessment.git
cd lead-engineer-assessment
git switch -c submission/attempt-01
```

Use your own fork/private repository or the ZIP handover described in the submission guide. Do not ask the founder to give you push access to this repository. Do not open a public PR containing reasoning answers, personal details, recordings, or proprietary code. Public code submissions are optional and only with your informed agreement.

## Fast setup — Node + local PostgreSQL

Prerequisites: Node **22.13+**, npm, Git, Docker Desktop with Docker Compose. The database is real PostgreSQL 16, not an in-memory imitation. A Flutter SDK is needed only for the small learning exercise; a documented fallback exists.

```bash
npm ci
docker compose up -d db
npm run doctor
npm run db:reset
npm test
npm run build
npm run typecheck
npm run dev
```

Open **http://127.0.0.1:4317**. API health is **http://127.0.0.1:4318/health**. All ports bind to loopback; do not enable public port forwarding. In a second terminal:

```bash
npm run test:challenge
```

**Expected starter state:** `npm test`, type-check and build pass. `test:challenge` has deliberately failing business acceptance tests. Those failures are the work—not broken installation. Read each failure and create your own regressions. Passing only the smoke suite does not pass the assessment.

For browser checks:

```bash
npx playwright install chromium
npm run test:e2e
```

## Docker-only application route

If you do not have Node installed, Docker can run the web application and database. The build downloads pinned npm dependencies.

```bash
docker compose up -d db
docker compose build app
docker compose run --rm app npm run db:reset
docker compose up -d app
```

Open http://127.0.0.1:4317. Commands can run inside the app container:

```bash
docker compose exec app npm test
docker compose exec app npm run test:challenge
docker compose exec app npm run typecheck
```

After editing source, rebuild and recreate only the app: `docker compose up -d --build app`. **App restart does not reset the database.** `db:reset` is explicitly destructive to this lab’s synthetic data; save evidence before using it. Stop the lab with `docker compose down`. Add `-v` only if you intentionally want to delete the lab volume. This project’s Compose name is `lead-engineer-assessment`.

Only `./submission` is bind-mounted into `/app/submission`, so your timing record and written evidence survive app recreation and remain on your laptop for Git/ZIP handover. No home-directory mount is used. Follow [complete Docker, Windows and SQL steps](candidate/10_SETUP_TROUBLESHOOTING.md).

The Docker app has a production build, not hot reload. Native Node is the faster editing route. Do not run both routes on port 4317 simultaneously.

## Assessment structure and weights

| Area | Points | Evidence, not vocabulary |
|---|---:|---|
| Independent reasoning | 15 | Correct inference, quantitative reasoning, recognition of insufficient evidence |
| PostgreSQL / database engineering | 30 | Ledger reconciliation, transactions, concurrency, isolation, schema constraints, query plan |
| Node/API reliability | 15 | Correct state transitions, validation, retries, safe recovery, reproducible tests |
| React/Next | 15 | State isolation, asynchronous correctness, usable loading/error/empty states, browser proof |
| AI/workflow engineering | 10 | Deterministic guards, untrusted-output handling, costs/retries, no unsafe side effects |
| Learning an unfamiliar module | 5 | Documentation → small change → evidence; prior Flutter expertise not required |
| Teamwork, standards and handover | 10 | Prioritised respectful review, clear contracts, risk escalation, teammate-ready instructions |
| **Total** | **100** | Independent reviewer verifies evidence before recommending a meeting |

Suggested practical budget: business diagnosis 20 min; database/backend 85; frontend 30; AI/workflow 15; unfamiliar module 20; teamwork/handover 30. Total practical 200 minutes. Setup and downloads are outside the clock.

This is a deliberately demanding timebox. Scope judgment matters. There is no expectation of a production-complete system or mastery of every framework. The core contract is explicit; optional stretches are not hidden requirements. A good candidate may decline unnecessary complexity and explain why.

## Source map

```text
candidate/      Detailed tasks, standards, timing, change card, submission rules
fixtures/       Synthetic ledger, campaign, lead and order evidence + data dictionary
database/       PostgreSQL schema + query-plan performance lab
server/         Local Node API, deliberately incomplete service, worker simulator
app/            React/Next recovery desk
mobile/         Small Flutter learning exercise
exercises/      Offline automation/workflow and simulated teammate review material
tests/          Platform smoke, business acceptance and browser tests
scripts/        Startup, lab-only reset helpers, timing and submission checks
docs/           Static public assessment portal and answer-free reasoning form
documents/      Printable candidate handbook
submission/     Your work products; templates are in candidate/templates/
```

The evaluator’s answer key, golden implementation and scoring notes are **not** in this public repository, its branches, release assets or history. Public tests cover known requirements, not every held-out input. Held-out checks must respect the same published contract.

## Assessment integrity and privacy

The browser timer and local Git history are not tamperproof. No hidden tracking or surveillance is included. The reasoning section uses an honour/proctor rule; disclose any interruption or accommodation. Practical work may use AI with disclosure in `submission/AI_USAGE.md`. You must understand and defend submitted work. Personal project code, employer IP, live credentials and real customer data are prohibited.

The evaluator distinguishes technical incompleteness from misrepresentation. A missing feature loses its relevant points; it is not automatically dishonesty. Deliberately fabricated results, concealed assistance against stated rules, or real-system actions against the safety rules require human review and may end the assessment.

**Setup help:** [Windows, SQL access, Docker persistence and clean verification](candidate/10_SETUP_TROUBLESHOOTING.md).

**Questions?** Read [the handbook FAQ](candidate/00_START_HERE.md#faq). Ask the coordinator for environment/access issues. Document business assumptions and meaningful questions; do not invent requirements to make your solution easier.
