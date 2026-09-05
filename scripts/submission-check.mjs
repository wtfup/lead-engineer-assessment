import {existsSync,readFileSync} from 'node:fs';
const required=['submission/DECISIONS.md','submission/DATABASE.md','submission/REVIEW.md','submission/HANDOVER.md','submission/AI_USAGE.md','submission/LEARNING.md','submission/AUTOMATION.md','submission/reconciliation.sql','submission/performance.sql','submission/session.json'];let bad=0;
for(const p of required){const ok=existsSync(p)&&readFileSync(p,'utf8').trim().length>40;console.log(ok?'PRESENT':'MISSING/EMPTY',p);if(!ok)bad++;}
console.log('Presence check only. This does not prove correctness, honesty, authorship, or a passing assessment. Do not publish cognitive answers or personal information.');process.exitCode=bad?1:0;
