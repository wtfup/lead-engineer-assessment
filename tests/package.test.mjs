import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root = new URL('../', import.meta.url);
test('candidate can find the brief, safety contract and handover instructions', () => {
  for(const file of ['README.md','candidate/00_START_HERE.md','candidate/02_MISSION.md','candidate/03_DATABASE.md','candidate/07_SUBMISSION.md','docs/index.html']) assert.ok(existsSync(new URL(file,root)), `missing ${file}`);
});
test('lab ports never publish to a public interface',()=>{
  const compose=readFileSync(new URL('compose.yaml',root),'utf8');
  assert.match(compose,/127\.0\.0\.1:55439:5432/);
  assert.match(compose,/127\.0\.0\.1:4317:4317/);
  assert.doesNotMatch(compose,/\"5432:5432\"/);
});
test('public reasoning data has fifty unique answer-free questions',()=>{
  const file=new URL('docs/cognitive-questions.json',root);
  assert.ok(existsSync(file),'reasoning form missing');
  const data=JSON.parse(readFileSync(file,'utf8'));
  const qs=Array.isArray(data)?data:data.questions;
  assert.equal(qs.length,50);
  assert.equal(new Set(qs.map(q=>q.id)).size,50);
  assert.doesNotMatch(JSON.stringify(data),/"(?:correctAnswer|correct|answerKey|rationale|solution)"\s*:/i);
});
