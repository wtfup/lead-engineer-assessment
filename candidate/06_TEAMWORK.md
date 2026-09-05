# 06 — Review, coordinate and hand over

**30 minutes · 10 points · practical section.** This is a simulated work sample of communication and engineering judgment, not a personality test or proof of real-world team fit. No real colleague is being reviewed. No messages should be sent.

Read `exercises/teamwork/CONTEXT.md` and `pull-request.diff`. The deliberately flawed TypeScript PR is not part of the runnable lab. Review it as code you are accountable for releasing.

## Deliverables
Use `exercises/teamwork/RESPONSE_TEMPLATE.md` to create `submission/REVIEW.md`:

1. **Prioritized PR review (~10 min):** make a merge decision; give up to six findings, anchored to added-line numbers. Label blocking/nonblocking and risk priority. For each, explain the consequence and a concrete fix or question plus proof. Do not spend the review on style while a correctness/security blocker remains.
2. **Author response + escalation (~7 min):** write a respectful reply to the author and a separate brief escalation to the product/engineering owner. Distinguish observed facts from unknowns, propose a safe demo option, name an owner and next checkpoint. Challenge a risky deadline without attacking the engineer. Do not overpromise a completion time.
3. **Two-engineer breakdown (~7 min):** give Engineer A and Engineer B bounded parallel tasks for the available half-day, with dependencies, interface/acceptance criteria, integration owner and rollback. Justify sequencing; do not duplicate ownership or pretend parallelism removes dependencies.
4. **Your actual assessment handover (~6 min):** complete `submission/HANDOVER.md` and link it from this review rather than duplicating it. List your changed surfaces, real test commands/results, incomplete work, deployment/rollback risks, AI/tool use and the next engineer's first action. Honest partial completion is acceptable; invented proof is not.

We assess whether another engineer could act safely on your review and handover. We do not award points for a particular management style, verbosity, accent, fluency polish or agreeing with the evaluator. Clear justified alternatives are welcome. Name uncertainty instead of manufacturing certainty.

Optional reference: [Google engineering-practices guidance on review comments](https://google.github.io/eng-practices/review/reviewer/comments.html). Reading it is not a required task or an additional timed section.
