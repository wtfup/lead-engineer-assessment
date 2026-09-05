# Submission — exact handover steps

## Required files

Create these from `candidate/templates/` and replace instructional content with your work. For `REVIEW.md`, use the more detailed `exercises/teamwork/RESPONSE_TEMPLATE.md`; link your actual `HANDOVER.md` instead of duplicating its content:

- `submission/DECISIONS.md`: business truth, evidence, priorities, assumptions, marketing decision.
- `submission/DATABASE.md`: reconciliation results, concurrency/rollback proof, query plans and migration note.
- `submission/reconciliation.sql`: runnable source-backed financial query.
- `submission/performance.sql`: your reproducible query-plan/index experiment.
- `submission/REVIEW.md`: prioritised teammate review and a respectful response to disagreement.
- `submission/HANDOVER.md`: exact setup/test commands, architecture/trust boundaries, changes, unresolved risks and next tasks.
- `submission/AI_USAGE.md`: tools, what they generated, how checked, and what you independently understood. Write “None used” if applicable.
- `submission/LEARNING.md`: unfamiliar-module change, official sources, execution proof or exact unverified boundary.
- `submission/AUTOMATION.md`: secondary AI/workflow analysis and bounded repair/proposal.
- `submission/session.json`: local practical start/finish record.

Add focused code/tests, migrations if used, and relevant sanitized evidence. Do not include node_modules, generated builds, database volumes, environment files, secrets, your résumé, cognitive answers, or personal recordings in the public Git history.

## End-of-time procedure

Complete code edits, written responses and your intended verification within the 200-minute practical. Stop the dev server with Ctrl-C before the production build; restart it or let Playwright start it afterwards.

```bash
npm run submit:check
npm test
npm run build
npm run typecheck
npm run test:challenge
npm run test:e2e
```

At the deadline, freeze all source and written answers, then run `npm run session -- finish`. Record which tests had finished by that point. After the deadline only administrative packaging, committing the frozen work, a private explanation, and re-running **unchanged** code for verification are allowed. Label post-deadline output explicitly. No fixes, new test logic, answer edits or new features may be slipped in afterwards; a later revision must be clearly declared as a separate follow-up.

A failing command is evidence to explain, not output to hide. The presence checker only checks files, not correctness. Preserve stdout/stderr, exit code, timestamp and revision. Docker equivalents and SQL commands are in [setup/troubleshooting](10_SETUP_TROUBLESHOOTING.md).

For the mobile and offline automation modules, use their exact README/exercise commands. Do not report root Node tests as Flutter proof. Show database state as well as API responses for replay/concurrency tests.

Before packaging, review `git diff`, `git status --short`, and `git diff --check`. Make small understandable commits on your branch. Do not change the `v1.0.0` starter tag, rewrite provided fixture truth, remove original tests, or delete evidence of a contract disagreement.

## Option A — private handover (recommended)

No GitHub write access or public disclosure is needed. Commit only the safe code and written submission files:

```bash
git add app server database tests scripts candidate submission mobile exercises package.json package-lock.json
git diff --cached --stat
git diff --cached --check
git commit -m "Complete assessment attempt with evidence and handover"
git archive --format=zip --output=../assessment-submission.zip HEAD
git rev-parse HEAD
```

Review the staged files before committing: add only paths you intentionally changed, and remove any sensitive/private file from the index. The command above is a starting example, not permission to publish all local files blindly. The archive contains tracked source only. If no changes were made in some paths, Git ignores those paths normally; missing optional directories may need to be omitted from the command.

Give `assessment-submission.zip`, the commit SHA, and your **separate private** reasoning export directly to the coordinator using the agreed local/private route. A screen/voice walkthrough, if agreed, is also handed over privately, not committed. You may instead use a private repository and grant the reviewer access through a separately confirmed identity.

## Option B — your own public fork (optional)

Only choose this if you consent to making your code and written work public. The upstream repo’s `candidate/attempt-01` branch is a starter, not a permission grant. Fork through GitHub first, then use your own namespace. Replace `YOUR_GITHUB_USERNAME` in the following command with your actual GitHub username; it is an instruction token, not a real account:

```bash
git remote rename origin upstream
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/lead-engineer-assessment.git
git push -u origin submission/attempt-01
```

Share the fork URL, branch and commit with the coordinator. A public pull request is not required. Never publish cognitive answers, identity/contact information, private keys, access tokens, employer code, a private evaluator file or a personal recording. If a credential accidentally enters Git history, stop and report it; deleting the latest file does not remove the history.

## Short final walkthrough (private)

A concise recorded explanation can replace an initial founder meeting. With any AI assistant closed, walk through:

1. Business finding and the source query behind it.
2. One important defect, your code change and regression proof.
3. One concurrent/replay/rollback case and resulting database rows.
4. Your UI’s current-account/error behaviour.
5. What you learned in the unfamiliar module and what you could not verify.
6. One respectful blocking code-review comment and one nonblocking suggestion.
7. What remains unsafe or unfinished; what another engineer should do next.

No polished video production is needed. Do not record unrelated tabs, private messages, personal files or credentials. If recording is unavailable or not agreed, provide an equivalent written walkthrough with the evidence and allow a later short defence. This is not a reason to fabricate execution.

## How evaluation works

The reviewer checks the submitted source revision, reruns the lab in a disposable environment, tests new IDs/values/timing under the same published requirements, and reviews the written judgment separately. Candidate-controlled reports are not trusted as independent proof. No automatic PR merge, workflow secret, production data or live API access is involved.

The recommendation is whether to proceed to a founder meeting, request specific additional evidence, or stop. A score is not an employment guarantee. The reviewer will distinguish acknowledged incompleteness, a technical gap, and deliberate misrepresentation.
