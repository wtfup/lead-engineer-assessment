// Runs only this reviewed fixture subset, NOT the n8n runtime.
// node:vm is NOT a security boundary for arbitrary candidate/third-party code.
// Review modifications first; evaluate submissions in a disposable sandbox.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

export function validateWorkflow(workflow) {
  if (workflow.active !== false || workflow.nodes?.length !== 4)
    throw new Error('Expected inactive four-node lab');
  if (workflow.id !== undefined) throw new Error('No existing workflow ID allowed');
  const names = new Set(workflow.nodes.map(n => n.name));
  if (names.size !== 4) throw new Error('Duplicate node names');
  if (Object.keys(workflow.connections ?? {}).length !== 3)
    throw new Error('Expected exactly three connections');
  workflow.nodes.forEach((node, index) => {
    const expectedType = index === 0 ? 'n8n-nodes-base.manualTrigger' : 'n8n-nodes-base.code';
    if (node.type !== expectedType || node.credentials !== undefined || node.disabled === true)
      throw new Error('Only uncredentialed manual/code nodes allowed');
    if (node.typeVersion !== (index === 0 ? 1 : 2)) throw new Error('Unexpected node version');
    if (index && (node.parameters.mode !== 'runOnceForAllItems' ||
        node.parameters.language !== 'javaScript' || typeof node.parameters.jsCode !== 'string'))
      throw new Error('Expected batch JavaScript Code node');
    if (index < 3) {
      const expected = [[{node: workflow.nodes[index+1].name, type:'main', index:0}]];
      if (JSON.stringify(workflow.connections[node.name]?.main) !== JSON.stringify(expected))
        throw new Error('Unexpected lab wiring');
    } else if (workflow.connections[node.name] !== undefined) throw new Error('Sink must terminate');
  });
}

export function runWorkflow(workflow) {
  validateWorkflow(workflow);
  let items = [{json:{}}];
  for (const node of workflow.nodes.slice(1)) {
    const input = JSON.parse(JSON.stringify(items));
    const output = vm.runInNewContext('(function(){' + node.parameters.jsCode + '\n})()',
      {$input: {all: () => input}}, {timeout: 500});
    items = JSON.parse(JSON.stringify(output));
    if (!Array.isArray(items) || items.some(item => !item || typeof item.json !== 'object'))
      throw new Error('Invalid lab item envelope');
  }
  if (items.some(({json: row}) => row.labOnly !== true || row.sent !== false || row.sideEffects !== 0))
    throw new Error('No-op receipt contract failed');
  return items;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const workflow = JSON.parse(readFileSync(new URL('./workflow.json', import.meta.url)));
  console.log(JSON.stringify({engine:'offline fixture subset; NOT n8n runtime',
    active:false, receipts:runWorkflow(workflow)}, null, 2));
}
