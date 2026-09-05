import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('performance runner rejects URL overrides before connecting',()=>{
 const r=spawnSync(process.execPath,['scripts/performance.mjs'],{encoding:'utf8',env:{...process.env,DATABASE_URL:'postgresql://assessment:assessment@127.0.0.1:55439/assessment?application_name=lab-only-probe'}});
 assert.notEqual(r.status,0,'URL options must be rejected, even harmless test options');
 assert.match(r.stderr,/Lab database only/);
});
test('performance runner rejects non-lab credentials before connecting',()=>{
 const r=spawnSync(process.execPath,['scripts/performance.mjs'],{encoding:'utf8',env:{...process.env,DATABASE_URL:'postgresql://assessment:wrong@127.0.0.1:55439/assessment'}});
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/Lab database only/);
});
