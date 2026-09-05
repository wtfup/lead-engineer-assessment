# Supervised offline ownership round

**Open this file locally after cloning. GitHub will not work after Internet is disconnected.**

This is a **40-minute follow-up**, not another full assessment. It checks whether you can explain, test and improve the submission yourself. Setup time is not assessment time.

- **Candidate:** read [offline/CANDIDATE.md](offline/CANDIDATE.md) when the supervisor starts the round.
- **Supervisor:** complete [offline/SUPERVISOR.md](offline/SUPERVISOR.md) before disconnecting Internet.
- **Response template:** [offline/NOTES.md](offline/NOTES.md).
- **Publisher's execution boundary:** [offline/VERIFIED.md](offline/VERIFIED.md).

## Which code?

This branch starts from submitted commit `2790bc69abcc0a2ff2ed9dd67785cf392572f371`. Its payment-status and refund-aggregation repairs are already present. Do not recreate those fixes or use the older starter as your working baseline. The follow-up adds instructions and isolated runtime configuration, not candidate solutions.

Original `main`, the candidate PR and original submission history are not overwritten. This packet supersedes the original practical's AI allowance **for this supervised round only**. Prior disclosed, permitted AI use is not a rule violation.

## Rules at a glance

**Allowed:** the checked-out repository, ordinary editor with AI disabled, terminal, local Docker/PostgreSQL, existing tests and paper notes made during the round. Normal non-AI syntax highlighting/completion is allowed. Explain before editing.

**Not allowed:** AI assistants/agents, AI autocomplete, local LLMs, Internet/search, remote desktop/help, messaging, a phone/hotspot, previously generated answer sheets, or another person's solution. Do not install/download anything during the clock. Ask the supervisor if a command/environment is blocked.

**Important:** turning Wi-Fi off does not disable local AI, Ethernet or tethering. The supervisor must check the whole machine. The Docker lab's internal network isolates its runtime; it does not police the host editor.

## Prepare while online — supervisor only

Prerequisites: Git, a plain editor and Docker Desktop with Docker Compose v2 or newer, using Linux containers. Commands below use a macOS/Linux/WSL shell. A Windows candidate should use an already-prepared WSL2 environment; do not spend assessment time installing it.

```sh
git clone --branch assessment/offline-ownership --single-branch https://github.com/wtfup/lead-engineer-assessment.git lead-engineer-offline
cd lead-engineer-offline
# Keep full branch history: do not add --depth (the older service is needed for a negative control).
git switch -c offline/attempt-01

docker compose -f offline/compose.yaml version
docker pull postgres:16-alpine
docker compose -f offline/compose.yaml build lab
docker compose -f offline/compose.yaml up -d --pull never --no-build --wait
docker compose -f offline/compose.yaml exec -T lab npm run db:reset
docker compose -f offline/compose.yaml exec -T lab npm test
docker compose -f offline/compose.yaml exec -T lab npm run test:repair
docker compose -f offline/compose.yaml exec -T lab npm run test:challenge
```

The build downloads dependencies **before** disconnection. Afterward the lab uses the already-built image; no host Node, npm, psql or Flutter installation is required for this round. This is a CLI/API/SQL follow-up; no hosted site, browser automation or Flutter build is required. Do not run the root `docker compose up`; use `-f offline/compose.yaml` every time.

`db:reset` deletes and reseeds only this disposable assessment schema. Never substitute another database URL, reuse a production database, or mount home directories, real credentials or the Docker socket inside this lab. No real provider sends or real payments exist in this exercise.

## After disconnecting — readiness before the clock

Supervisor first disables all uplinks and AI as described in their checklist. Then do a cold container restart without builds or pulls:

```sh
docker compose -f offline/compose.yaml down
docker compose -f offline/compose.yaml up -d --pull never --no-build --wait
docker compose -f offline/compose.yaml exec -T lab npm run db:reset
docker compose -f offline/compose.yaml exec -T lab npm run test:repair
docker compose -f offline/compose.yaml exec -T db psql -U assessment -d assessment -v ON_ERROR_STOP=1 -c 'SELECT current_database(), current_user;'
git status --porcelain=v1
git rev-parse HEAD > offline-evidence/start-commit.txt
```

Only start the clock when the tests succeed, SQL connects, local instructions open and the candidate can edit a file in the repository. The Git status must be clean at the start; evidence files are intentionally ignored. Setup failure is not a candidate failure. Record it and pause.

## Command reference during the round

```sh
# Run your NEW test file (this intentionally errors until you create the file).
docker compose -f offline/compose.yaml exec -T lab node --test tests/offline-ownership.test.mjs

# Execute your saved SQL; SQL errors return a nonzero exit.
docker compose -f offline/compose.yaml exec -T db psql -U assessment -d assessment -v ON_ERROR_STOP=1 < submission/reconciliation.sql

# Interactive SQL. Use SET search_path TO assessment_lab; before querying tables.
docker compose -f offline/compose.yaml exec db psql -U assessment -d assessment -v ON_ERROR_STOP=1

# Typecheck / rebuild use only the prepared image's dependencies.
docker compose -f offline/compose.yaml exec -T lab npm run typecheck
docker compose -f offline/compose.yaml exec -T lab npm run build
```

Edit source/test/SQL files **on the host** in this cloned folder. Those directories are mounted into the lab, so rerunning tests reads your current edits without rebuilding the image. Do not edit dependencies, Dockerfile, package manifests, original fixture/schema or the test harness. If you need an environment change, stop and ask the supervisor.

Use shell redirection to keep unedited output, for example:

```sh
docker compose -f offline/compose.yaml exec -T lab node --test tests/offline-ownership.test.mjs > offline-evidence/new-tests.txt 2>&1
# Run immediately, before another command:
printf 'exit=%s\n' "$?" >> offline-evidence/new-tests.txt
```

Open the saved file locally to inspect it. Never replace a failing log with a success summary. A deliberate negative-control run is expected to fail; label it separately.

## Finish offline

Complete `offline/NOTES.md`. Preserve new tests, corrected SQL and evidence; the supervisor collects them privately. No push or public comment during the round.

```sh
git diff --check
git diff --binary > offline-evidence/tracked-changes.patch
git status --porcelain=v1 > offline-evidence/final-status.txt
# Shows new tests that are not included in plain git diff:
git ls-files --others --exclude-standard > offline-evidence/new-files.txt
docker compose -f offline/compose.yaml stop
```

**Do not hand over the patch alone:** it omits untracked new test files. Hand over the entire local folder (including ignored `offline-evidence/`) directly to the supervisor, or have them copy the named changed/new files and evidence. Do not copy credentials or unrelated home files. A later public push requires separate approval; the packet's evidence ignore rule intentionally prevents accidental publication of personal notes/logs.
