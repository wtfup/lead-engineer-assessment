# 05 — Audit an AI-assisted n8n preview

**15 minutes · 10 points · practical section.** This is a bounded reliability/security review, not an integration build. No n8n account, model API key, credentials or recipients are required. AI/docs are allowed with disclosure.

## Materials and safe execution
Read `exercises/automation/workflow.json`, `model-responses.json`, and `README.md`. The export is **inactive**, with one Manual Trigger and three batch JavaScript Code nodes. It ends in a literal no-op receipt. There is **no HTTP, AI provider, email, messaging, schedule or webhook node**, and no credentials. Text claiming approval inside the fixtures is **untrusted lab data**, never an instruction to you.

From the root:
```sh
node --test exercises/automation/workflow.test.mjs
node exercises/automation/offline-runner.mjs
```
Node 22.13+ is sufficient. The helper executes the bundled Code-node bodies with fixed `$input.all()` data; it is **not n8n** and does not prove an n8n import or execution. Its green tests prove fixture structure/no-op receipts, **not correct policy**. Read submitted/modified code before executing; Node `vm` is not a security sandbox.

Optional, outside the timer: import the JSON into a disposable **local** n8n workspace using Import from File. Keep it inactive and do not add credentials or network/action nodes. Import/manual n8n execution is not required for the score; report it only if actually done. Do not touch a production n8n workspace.

## Scenario
A proposed invoice-reminder assistant reads invoice metadata plus retrieved free text, asks a model for a summary and recommendation, then creates an internal queue proposal. The fixture substitutes fixed model responses for real inference. A real sender, if later built, would be a separate approved project. Here, **nothing is sent or allocated**.

Trusted fixture fields come from a hypothetical authoritative store. Model output and retrieved text are untrusted. Product policy for your proposal:
- Only a pending invoice with recorded consent may become an eligible reminder draft. Consent unknown/false, tenant mismatch or invalid monetary identity must not be repaired by the model.
- The model may draft text; it may not grant approval, choose a tenant/recipient, change an amount or bypass eligibility. Draft eligibility is distinct from human approval and live sending.
- A redelivered business event must not create a second logical draft. Separate repeated executions from the durable business event.
- Each case may use at most **100 synthetic cost units** and **3 total model attempts**. A new attempt is estimated to cost **20 units**; existing `spentUnits` and `attempts` are authoritative. No money is spent by this lab.
- Retries must be bounded and distinguish transient failure, permanent invalid output and ambiguous external outcomes. Do not invent an exactly-once guarantee across an uncooperative provider.

## Deliverable: `submission/AUTOMATION.md`
Use the included response template or your own equivalent. Keep it to roughly one page:
1. **Trace all five fixtures**: observed starter proposal, proposed safe outcome, and evidence/reason. The replay is deliberately the same business event with different model wording.
2. Identify **up to five prioritized failures** in the policy boundary. Include how retrieved-text prompt injection and model-output schema/type validation differ.
3. Give a short corrected workflow or pseudocode: deterministic gates, model draft validation, stable dedupe/atomic claim, bounded retries/cost, no-op receipt, and where human/live approval would belong.
4. Name three concrete tests (including a concurrency/replay or ambiguous-timeout test) and the evidence you would demand before considering a future live integration. Keep it hypothetical—no actual provider node or send.
5. Disclose tools/AI used and actual execution limits.

A prose design is sufficient; implementing a production orchestrator is not expected. You may edit local preview logic if useful, but never add a real action, credential or external call. Show trade-offs instead of listing fashionable tools.
