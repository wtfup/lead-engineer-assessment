# Supervisor: run the offline round

This file is a public process checklist, **not an answer key or hiring verdict**. You need not be a senior engineer to supervise; record observations rather than guessing whether an answer sounds technical.

## Before the candidate starts

- Use a dedicated assessment machine/account without company credentials or unrelated personal data. One candidate per machine and one local lab at a time. Do not run simultaneous attempts against the same Docker project/database; use separate machines.
- Clone the exact follow-up branch and complete every online preparation command in `OFFLINE_START_HERE.md`. Check that the branch contains starting revision `2790bc69abcc0a2ff2ed9dd67785cf392572f371`; record `git rev-parse HEAD` and `git status --porcelain=v1`. Do not use the older original starter or silently substitute a later PR revision.
- Prepare Docker Desktop **before** the timed session; make sure it does not need an offline login. Keep the prepared images locally. Do not prune images/volumes or rebuild after disconnecting.
- Use a plain editor. Close chat/agent terminals and AI-capable tools; disable AI autocomplete/assistants and stop local model services on the **assessment machine**. Ordinary syntax highlighting/non-AI completion is fine. Prefer an editor/profile that has no AI extensions at all; do not rely on “the AI button is not open.”
- Close unrelated browser tabs, remote-desktop sessions and messaging. Remove access to prior answer sheets/chat histories. The candidate may read only the local repository and write fresh notes during the round. Do not inspect unrelated private content on their personal device; use a dedicated assessment account instead.
- Disconnect **Wi-Fi, Ethernet, USB tethering and other uplinks**. Keep phones/hotspots away with the candidate's agreement. A disconnected Wi-Fi icon alone is insufficient. Do not disable Docker's internal virtual networking; the app still needs its local database.
- Verify no fresh public page loads, using an uncached/new URL, and inspect the machine's network interfaces. A network failure by itself does not prove all AI is disabled. Supervise the screen throughout; this packet is not a proctoring or anti-cheating program.
- Run the cold restart and post-disconnection checks in `OFFLINE_START_HERE.md`. The SQL query should identify the `assessment` database/user. Only after local files open, editing works, tests pass and SQL connects, note the start time and begin **40 minutes**.

## During the round

- Read out: “Explain first, then edit and run. Use only this local repo. No AI or Internet. If anything is unknown or incomplete, say so.”
- Candidate opens `offline/CANDIDATE.md`. Suggested checkpoints: trace, SQL repair, new tests/negative control, handover. Setup/environment faults pause the clock; record the fault and duration. Do not extend the task unexpectedly.
- Do not provide the count, query correction, implementation patch or expected assertion. You may clarify wording and fix machine setup while the timer is paused. Record any technical hint that was given; prompted answers are not independent evidence.
- Ask one input-change question naturally drawn from their own test (for example a status or refund-state change). Ask them to predict the result before running. Do not add undocumented requirements or a new stack.
- Preserve real terminal outputs and exit codes. Negative-control failure must be a business assertion, not an import/setup crash. Latest run must remove the command-scoped `SERVICE_MODULE` override. Check the candidate invokes the new test file explicitly, not only the old suites.
- Note whether they can identify the controlling lines and explain persisted DB state, rather than narrating comments or reading a test title.
- Never accuse AI usage from style, speed, vocabulary or the earlier disclosure. AI was allowed in the original practical; **this round's** independence is what you are observing.

## Closeout checklist

Record each as **demonstrated / partial / not demonstrated**, with the file/command or brief observed explanation:

| Area | What must be observed |
|---|---|
| Code ownership | Traces identities, transaction, order/payment state and fulfilment boundary; predicts changed input |
| Business truth | Derives the count from authoritative rows; repairs query + claim; proves changed-input behaviour; states money units |
| Hands-on tests | Writes meaningful new tests; old-service business assertion fails; latest service passes; runs preserved suites |
| Lead judgment | Separates tested facts from assumptions; gives a sensible defer/ship boundary and concrete next-engineer task |

A green command alone is not a hiring decision. If you cannot judge a technical claim, label it **needs technical review**, not “passed.” A frozen or incomplete attempt is evidence to review, not automatic rejection or proof of misconduct.

Collect the whole working folder or all named changed/new files **plus** ignored `offline-evidence/`. Plain `git diff` does not contain new untracked test files. Ensure the temporary old service was moved out of `server/` and is not presented as new candidate work. Ask the candidate to stop the lab with the documented command. Do not delete volumes or source work to tidy up.

No public push/comment is required. Do not publish private candidate notes, observations or logs. Give the local handover privately to the hiring owner for technical review. If ownership is demonstrated, a short founder conversation is the next step—not an automatic job offer.

## Troubleshooting without changing the task

- **Image missing after disconnect:** pause, reconnect only under supervision to prepare it, repeat disconnection and cold-start checks, then restart the paused clock. Never pretend preparation was offline.
- **Cannot connect to database:** inspect `docker compose -f offline/compose.yaml ps` and `docker compose -f offline/compose.yaml logs db`; do not point at another database.
- **SQL says relation missing:** `SET search_path TO assessment_lab;` for interactive SQL, or run the supplied file which sets it. If not seeded, rerun the documented disposable-lab reset before assessment data changes.
- **Edits seem ignored:** verify the candidate edited this cloned folder and that `docker compose -f offline/compose.yaml exec -T lab` is used. Server/tests/submission are mounted from that folder; package/dependency changes are not part of this round.
- **Docker Desktop will not work offline:** stop this attempt as an environment blocker. Do not turn a hands-on exercise into verbal-only proof or penalise the candidate for your setup.
