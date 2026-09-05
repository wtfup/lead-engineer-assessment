# Simulated PR #27 — preview batches

This diff is a **review artifact, not executable application code**. All actors, IDs and deadlines are fictional. Do not apply it to the lab API or run it against a database.

The product manager wants an internal preview of pending invoices before a demo. The author says: “Happy path worked once. I used Promise.all so this will scale. Can we merge in 20 minutes?” The endpoint may receive duplicate requests and concurrent requests. Some clients retry after a timeout. Invoice IDs are unique only within a tenant.

Known context, so you need not guess hidden files:
- `pool` is a normal node-postgres `Pool`; each `pool.query` can use a different connection.
- Authentication middleware supplies `req.user.allowedTenants`. Nothing else authorizes body tenant or invoice IDs.
- Both `preview_jobs` and `preview_batches` have surrogate primary keys only; no relevant business-key UNIQUE constraints. `preview_batches` currently stores only `request_id`.
- Invoices are stored with `(tenant, id, amountPaise, status)`; amountPaise is integer money, status is `pending` or `paid`.
- `previewAdapter.create` is a fictional non-transactional, remote preview allocator. It may accept a request and then time out before returning. It does not send customer messages, but can allocate duplicate previews. No idempotency contract is currently documented.
- No rate limiting, body schema validation or batch size limit exists elsewhere. The code in the diff is all newly added. No tests accompany it.
- The current release can leave this endpoint disabled. The demo can use a saved synthetic preview. No real outage requires bypassing the review.

Resources available tomorrow: Engineer A is comfortable with SQL/API work; Engineer B is comfortable with React/TypeScript and tests. Each has half a day. You remain accountable for review and integration. These are skills, not seniority labels; justify another division if useful.

Review exact added line numbers; the unified diff starts at added line 1. Respectful disagreement and an evidence request are welcome. Avoid personality judgments, unsupported accusations, or speculative findings that contradict the context.
