import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const workflow = JSON.parse(readFileSync(new URL('./workflow.json', import.meta.url)));

test('lab workflow has a complete inactive four-node preview chain', () => {
  assert.equal(workflow.active, false);
  assert.equal(workflow.nodes.length, 4);
  assert.deepEqual(workflow.nodes.map(n => n.type), [
    'n8n-nodes-base.manualTrigger', 'n8n-nodes-base.code',
    'n8n-nodes-base.code', 'n8n-nodes-base.code',
  ]);
  for (const node of workflow.nodes) assert.equal(node.credentials, undefined);
  for (let i = 0; i < workflow.nodes.length - 1; i++) {
    assert.deepEqual(workflow.connections[workflow.nodes[i].name].main,
      [[{ node: workflow.nodes[i+1].name, type: 'main', index: 0 }]]);
  }
  assert.deepEqual(workflow.connections[workflow.nodes.at(-1).name], undefined);
});

import { runWorkflow, validateWorkflow } from './offline-runner.mjs';
const fixtures = JSON.parse(readFileSync(new URL('./model-responses.json', import.meta.url)));

test('executes actual bundled Code nodes with five fixed no-op receipts', () => {
  const receipts = runWorkflow(workflow).map(item => item.json);
  assert.equal(receipts.length, 5);
  assert.deepEqual(receipts.map(row => row.caseId), fixtures.map(row => row.caseId));
  for (const row of receipts) {
    assert.equal(row.sent, false);
    assert.equal(row.sideEffects, 0);
    assert.equal(row.labOnly, true);
  }
  assert.equal(receipts[0].sourceEventId, receipts[3].sourceEventId);
});

test('embedded n8n fixtures match the readable model-response fixture', () => {
  const embedded = workflow.nodes[1].parameters.jsCode;
  const codeFixtures = JSON.parse(embedded.slice(embedded.indexOf('const cases = ') + 14,
    embedded.indexOf(';\nreturn cases')));
  assert.deepEqual(codeFixtures, fixtures);
});

for (const mutation of ['activation','http-node','credential','extra-edge']) {
  test('fails closed on forbidden lab shape: ' + mutation, () => {
    const changed = structuredClone(workflow);
    if (mutation === 'activation') changed.active = true;
    if (mutation === 'http-node') changed.nodes[2].type = 'n8n-nodes-base.httpRequest';
    if (mutation === 'credential') changed.nodes[3].credentials = {lab:'forbidden'};
    if (mutation === 'extra-edge') changed.connections[changed.nodes[3].name] = {main:[[]]};
    assert.throws(() => validateWorkflow(changed));
  });
}
