# Offline automation review fixture

This is a tiny n8n export plus a **local Node fixture runner**, not a deployed workflow. Deliberate policy defects live in `Unsafe policy proposal - review me`. The final `NO-OP preview receipt` has no provider, credentials, recipients, URLs, or sending capability. An inactive workflow alone is not a general safety boundary: this fixture is also structurally missing action nodes.

- `workflow.json`: import-format JSON; Manual Trigger v1 + Code v2, `runOnceForAllItems`, JavaScript.
- `model-responses.json`: the readable five fixed cases also embedded in the first Code node so no filesystem access is needed inside n8n.
- `offline-runner.mjs`: follows the exact four-node lab chain and executes actual bundled Code-node bodies. No package install is needed.
- `workflow.test.mjs`: validates inactive node/edge/credential shape, receipt conservation, fixture parity, and rejects forbidden activation/node/credential/edge mutations. These are **lab safety smoke tests**, not an answer key or an assertion that proposal policy is correct.

Run from repository root:
```sh
node --test exercises/automation/workflow.test.mjs
node exercises/automation/offline-runner.mjs
```

The command prints five JSON receipts, all `sent:false`, `sideEffects:0`, `labOnly:true`. `wouldQueue` reports the flawed proposal, not actual queue insertion or sending. No state survives the run. Candidate work should explain the durable/concurrent behavior a real implementation would need rather than claiming this runner supplies it.

**Execution honesty:** the local helper is not an n8n engine/emulator; successful helper output does not prove n8n import, node sandbox compatibility, scheduling, retries, activation or delivery. Evaluate modified code in a disposable sandbox without host secrets; Node `vm` is only a fixture convenience, not a security boundary. No production n8n access is necessary or authorized.

Official references (site may block automated clients):
- [Code node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.code/) · [official Markdown source](https://raw.githubusercontent.com/n8n-io/n8n-docs/main/docs/integrations/builtin/core-nodes/n8n-nodes-base.code/README.md)
- [Manual Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.manualworkflowtrigger/) · [official Markdown source](https://raw.githubusercontent.com/n8n-io/n8n-docs/main/docs/integrations/builtin/core-nodes/n8n-nodes-base.manualworkflowtrigger.md)
- [Export/import source](https://raw.githubusercontent.com/n8n-io/n8n-docs/main/docs/build/manage-workflows/export-and-import.md)
