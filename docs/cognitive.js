/* Public, key-free state machine. Browser and Node tests use these exact functions. */
(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  if (root && root.document) root.CognitiveCore = core;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const STATE_VERSION = 'cognitive-local-v1';
  const RESPONSE_VERSION = 'cognitive-response-v1';
  const STORAGE_KEY = 'lead-reasoning-50:attempt-v1';
  const pseudonym = /^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/;
  const isTime = value => Number.isSafeInteger(value) && value > 0 && value < 8640000000000000;
  function createAttempt(candidateId, data, now) {
    if (typeof candidateId !== 'string' || !pseudonym.test(candidateId)) throw new Error('Use a 3–32 character pseudonym: letters, digits, hyphens, underscores only.');
    if (!isTime(now)) throw new Error('Device time is invalid. Ask your interviewer.');
    return {schemaVersion:STATE_VERSION, assessmentId:data.assessmentId, assessmentVersion:data.assessmentVersion,
      candidateId, startedAt:now, deadlineAt:now + data.timeLimitSeconds * 1000, endedAt:null,
      lastSeenAt:now, status:'in-progress', answers:Object.fromEntries(data.questions.map(q => [q.id, []]))};
  }
  function normalizeChoices(question, values) {
    if (!Array.isArray(values)) throw new Error('Invalid choice array.');
    const allowed = new Set(question.options.map(o => o.id));
    if (values.some(v => typeof v !== 'string' || !allowed.has(v))) throw new Error('Invalid choice.');
    const selected = [...new Set(values)].sort();
    if (question.type !== 'select-all' && selected.length > 1) throw new Error('Only one choice is allowed.');
    return selected;
  }
  function advanceAttempt(state, now) {
    if (!isTime(now)) throw new Error('Device time is invalid.');
    state.lastSeenAt = Math.max(now, state.lastSeenAt, state.startedAt);
    if (state.status === 'in-progress' && state.lastSeenAt >= state.deadlineAt) {
      state.status = 'expired'; state.endedAt = state.deadlineAt;
    }
    return state;
  }
  function remainingSeconds(state, now) {
    if (state.status !== 'in-progress') return 0;
    return Math.max(0, Math.ceil((state.deadlineAt - Math.max(now,state.lastSeenAt,state.startedAt))/1000));
  }
  function setAnswer(state, question, values, now) {
    advanceAttempt(state,now);
    if (state.status !== 'in-progress') return false;
    if (!Object.hasOwn(state.answers,question.id)) throw new Error('Unknown question.');
    state.answers[question.id] = normalizeChoices(question,values);
    return true;
  }
  function finishAttempt(state, now, confirmed) {
    advanceAttempt(state,now);
    if (!confirmed || state.status !== 'in-progress') return false;
    state.status = 'finished'; state.endedAt = Math.min(state.lastSeenAt,state.deadlineAt);
    return true;
  }
  function restoreAttempt(raw, data, now) {
    try {
      const saved = JSON.parse(raw);
      if (!saved || saved.schemaVersion !== STATE_VERSION || saved.assessmentId !== data.assessmentId || saved.assessmentVersion !== data.assessmentVersion) throw new Error('version');
      if (typeof saved.candidateId !== 'string' || !pseudonym.test(saved.candidateId)) throw new Error('id');
      if (![saved.startedAt,saved.deadlineAt,saved.lastSeenAt].every(isTime) || saved.deadlineAt !== saved.startedAt + data.timeLimitSeconds * 1000 || saved.lastSeenAt < saved.startedAt) throw new Error('time');
      if (!['in-progress','finished','expired'].includes(saved.status)) throw new Error('status');
      if (saved.status === 'in-progress' && saved.endedAt !== null) throw new Error('end');
      if (saved.status !== 'in-progress' && (!isTime(saved.endedAt) || saved.endedAt < saved.startedAt || saved.endedAt > saved.deadlineAt || saved.endedAt > saved.lastSeenAt)) throw new Error('end');
      if (saved.status === 'expired' && saved.endedAt !== saved.deadlineAt) throw new Error('expiry');
      if (!saved.answers || typeof saved.answers !== 'object' || Array.isArray(saved.answers) || Object.keys(saved.answers).length !== data.questions.length) throw new Error('answers');
      const state = createAttempt(saved.candidateId,data,saved.startedAt);
      for (const q of data.questions) {
        const values = normalizeChoices(q,saved.answers[q.id]);
        if (values.length !== saved.answers[q.id].length) throw new Error('duplicate choices');
        state.answers[q.id] = values;
      }
      state.lastSeenAt = saved.lastSeenAt; state.status = saved.status; state.endedAt = saved.endedAt;
      return advanceAttempt(state,now);
    } catch (_) { throw new Error('Saved attempt cannot be restored safely. Preserve the backup and ask your interviewer.'); }
  }
  function loadSaved(storage,key) {
    try { return {ok:true, raw:storage.getItem(key)}; }
    catch (_) { return {ok:false, raw:null}; }
  }
  function saveAttempt(storage,key,state) {
    try { storage.setItem(key,JSON.stringify(state)); return {ok:true}; }
    catch (_) { return {ok:false}; }
  }
  function exportSnapshot(state,data,now) {
    advanceAttempt(state,now);
    const end = state.endedAt === null ? Math.min(state.lastSeenAt,state.deadlineAt) : state.endedAt;
    return {schemaVersion:RESPONSE_VERSION, assessmentId:data.assessmentId, assessmentVersion:data.assessmentVersion,
      candidateId:state.candidateId, status:state.status,
      conditions:{mode:'no-ai', acknowledgedAt:new Date(state.startedAt).toISOString(), proctoring:'local-honor-system'},
      timing:{timeLimitSeconds:data.timeLimitSeconds, startedAt:new Date(state.startedAt).toISOString(), deadlineAt:new Date(state.deadlineAt).toISOString(),
        endedAt:state.endedAt === null ? null : new Date(state.endedAt).toISOString(), exportedAt:new Date(now).toISOString(),
        elapsedSeconds:Math.max(0,Math.floor((end-state.startedAt)/1000))},
      answers:Object.fromEntries(data.questions.map(q=>[q.id,[...state.answers[q.id]]]))};
  }
  return {STORAGE_KEY,createAttempt,restoreAttempt,advanceAttempt,remainingSeconds,setAnswer,finishAttempt,loadSaved,saveAttempt,exportSnapshot};
});

(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.document) return;
  const C = window.CognitiveCore;
  const $ = id => document.getElementById(id);
  let data, state, storage = null, rawBackup = null, lastPersist = 0, previousStatus = '', lastWarning = null;
  const fieldsets = new Map();
  function el(tag,text,className) {
    const node=document.createElement(tag);
    if (text !== undefined) node.textContent=text;
    if (className) node.className=className;
    return node;
  }
  function storageWarning(text) { $('storage-warning').hidden=false; $('storage-warning').textContent=text; }
  function persist() {
    if (!state) return;
    const result=C.saveAttempt(storage,C.STORAGE_KEY,state);
    lastPersist=Date.now();
    if (!result.ok) storageWarning('Local autosave is unavailable or full. Your current answers still work in this open page. Download backups now and at completion; closing or refreshing may lose this attempt. Tell your interviewer.');
  }
  function appendText(container,text,caption) {
    for (const block of text.split(/\n\s*\n/)) {
      if (block.trim().startsWith('|')) {
        const wrap=el('div',undefined,'table-wrap'); const table=el('table');
        table.append(el('caption',caption)); const rows=block.trim().split('\n');
        const head=el('thead'); const body=el('tbody');
        rows.forEach((row,index)=>{
          const cells=row.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(t=>t.trim());
          if (cells.every(cell=>/^:?-+:?$/.test(cell))) return;
          const tr=el('tr');
          cells.forEach(text=>{const cell=el(index===0?'th':'td',text); if(index===0)cell.scope='col'; tr.append(cell);});
          (index===0?head:body).append(tr);
        });
        table.append(head,body);wrap.append(table);container.append(wrap);
      } else container.append(el('p',block));
    }
  }
  function renderQuestions() {
    const root=$('questions');root.replaceChildren();$('section-nav').replaceChildren();fieldsets.clear();
    const emitted=new Set();
    for (const section of data.sections) {
      const group=el('section',undefined,'question-section');group.id=`section-${section.id}`;
      const heading=el('h2',section.title);heading.id=`heading-${section.id}`;group.setAttribute('aria-labelledby',heading.id);group.append(heading);
      group.append(el('p',`Suggested ${section.suggestedMinutes} minutes · one continuous timer`,'muted'));
      const link=el('a',section.title);link.href=`#${group.id}`;$('section-nav').append(link);
      for (const q of data.questions.filter(item=>item.section===section.id)) {
        for (const [field,list,className] of [['passageId','passages','passage'],['stimulusId','stimuli','stimulus']]) {
          if (!q[field] || emitted.has(q[field])) continue;
          const source=data[list].find(s=>s.id===q[field]);
          const article=el('article',undefined,className);article.id=source.id;
          const h=el('h3',`${source.id} — ${source.title}`);h.id=`title-${source.id}`;article.setAttribute('aria-labelledby',h.id);article.append(h);
          appendText(article,source.text,source.title);group.append(article);emitted.add(q[field]);
        }
        const fs=el('fieldset',undefined,'question');fs.id=q.id;fs.dataset.questionId=q.id;
        const legend=el('legend');legend.append(el('span',q.id,'q-id'),document.createTextNode(q.prompt));fs.append(legend);
        const typeLabel={'mcq':'Choose one','boolean':'True or false — choose one','select-all':'Select all that apply — exact match'}[q.type];
        fs.append(el('p',typeLabel,'type-label'));
        for (const option of q.options) {
          const label=el('label',undefined,'choice');
          const input=el('input');input.type=q.type==='select-all'?'checkbox':'radio';input.name=q.id;input.id=`${q.id}-${option.id}`;input.value=option.id;
          input.checked=state.answers[q.id].includes(option.id);label.htmlFor=input.id;
          label.append(input,el('span',`${option.id}. ${option.text}`));fs.append(label);
          input.addEventListener('change',()=>{
            const selected=[...fs.querySelectorAll('input:checked')].map(x=>x.value);
            C.setAnswer(state,q,selected,Date.now());syncQuestion(q);persist();update();
          });
        }
        const clear=el('button','Clear response','secondary clear-answer');clear.type='button';clear.setAttribute('aria-label',`Clear response for ${q.id}`);
        clear.addEventListener('click',()=>{C.setAnswer(state,q,[],Date.now());syncQuestion(q);persist();update();});fs.append(clear);
        fieldsets.set(q.id,fs);syncQuestion(q);group.append(fs);
      }
      root.append(group);
    }
  }
  function syncQuestion(q) {
    const fs=fieldsets.get(q.id);if(!fs)return;
    for (const input of fs.querySelectorAll('input')) input.checked=state.answers[q.id].includes(input.value);
    fs.classList.toggle('answered',state.answers[q.id].length>0);
  }
  function update() {
    if (!state) return;
    C.advanceAttempt(state,Date.now());
    const seconds=C.remainingSeconds(state,Date.now());
    $('timer').textContent=`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
    $('timer').classList.toggle('urgent',seconds<=300);
    const answered=Object.values(state.answers).filter(a=>a.length>0).length;
    $('progress').textContent=`${answered} of ${data.questions.length} answered`;
    const active=state.status==='in-progress';
    for (const fs of fieldsets.values())fs.disabled=!active;
    $('finish').disabled=!active;
    const statusText=active?'In progress — local autosave when available':state.status==='expired'?'Time expired — responses locked; download remains available':'Finished early — responses locked; download remains available';
    if (state.status!==previousStatus) {
      $('attempt-state').textContent=statusText;previousStatus=state.status;
      if(!active){$('announcement').textContent=statusText;persist();}
    }
    if(active){
      const threshold=seconds<=60?60:seconds<=300?300:seconds<=600?600:null;
      if(threshold!==null && threshold!==lastWarning){$('announcement').textContent=`${Math.ceil(seconds/60)} minute${seconds>60?'s':''} remaining.`;lastWarning=threshold;}
    }
  }
  function showAttempt(focus) {
    $('start-form').hidden=true;$('attempt').hidden=false;
    $('attempt-id').textContent=`Candidate ID: ${state.candidateId} · Assessment ${data.assessmentVersion}`;
    renderQuestions();update();persist();
    if (focus) $('attempt-heading').focus();
  }
  function snapshotText() {
    const snapshot=C.exportSnapshot(state,data,Date.now());update();persist();
    return JSON.stringify(snapshot,null,2)+'\n';
  }
  function fallback(text) {
    $('json-fallback').hidden=false;$('snapshot-text').value=text;
  }
  function download(text,filename,mime) {
    const blob=new Blob([text],{type:mime});const url=URL.createObjectURL(blob);
    const a=el('a');a.href=url;a.download=filename;a.hidden=true;document.body.append(a);a.click();a.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  $('start-form').addEventListener('submit',event=>{
    event.preventDefault();
    if(!data || state || rawBackup!==null || !$('conditions').checked || !$('start-form').reportValidity())return;
    try { state=C.createAttempt($('candidate-id').value.trim(),data,Date.now());showAttempt(true); }
    catch(error){$('load-status').textContent=error.message;}
  });
  $('finish').addEventListener('click',()=>{
    if(!state)return;update();if(state.status!=='in-progress')return;
    const remaining=data.questions.length-Object.values(state.answers).filter(a=>a.length>0).length;
    const confirmed=window.confirm(`Finish now? ${remaining} question(s) are unanswered. Your responses will lock and this attempt cannot be restarted here. You can still download your file. Cancel to keep working.`);
    C.finishAttempt(state,Date.now(),confirmed);update();persist();
  });
  $('download').addEventListener('click',()=>{
    if(!state)return;const text=snapshotText();fallback(text);
    try { download(text,`${state.candidateId}-reasoning-${state.status}.json`,'application/json');$('export-status').textContent='Download requested. Check that the file exists in your downloads. This is not submission; hand the final file privately to your interviewer.'; }
    catch(_){$('export-status').textContent='Download was blocked. Copy the snapshot text below into a private .json file and give it to your interviewer.';}
  });
  $('show-json').addEventListener('click',()=>{if(state){fallback(snapshotText());$('snapshot-text').focus();}});
  $('select-json').addEventListener('click',()=>{$('snapshot-text').focus();$('snapshot-text').select();});
  $('raw-backup').addEventListener('click',()=>{if(rawBackup!==null){try{download(rawBackup,'reasoning-saved-recovery.txt','text/plain');}catch(_){$('storage-warning').hidden=false;$('storage-warning').textContent='Backup download is blocked. Keep this browser open and ask the interviewer for recovery assistance.';}}});
  document.addEventListener('visibilitychange',()=>{if(state){update();persist();}});
  window.addEventListener('pagehide',persist);
  window.addEventListener('storage',event=>{if(event.key===C.STORAGE_KEY && state)storageWarning('Another tab changed this attempt\'s storage. Use one tab only. Download this tab\'s current responses and ask your interviewer to resolve the conflicting copies.');});
  async function init() {
    try {
      const response=await fetch('./cognitive-questions.json',{cache:'no-store'});
      if(!response.ok)throw new Error(`Question file returned HTTP ${response.status}.`);
      data=await response.json();
      if(data.schemaVersion!=='cognitive-assessment-v1' || data.questions.length!==50 || data.timeLimitSeconds!==2400)throw new Error('Question file version or count is invalid.');
      for(const text of data.instructions)$('instructions').append(el('li',text));
      try{storage=window.localStorage;}catch(_){storage=null;}
      const loaded=C.loadSaved(storage,C.STORAGE_KEY);
      if(!loaded.ok)storageWarning('Browser storage cannot be read. A prior attempt may exist but is unavailable. Tell your interviewer before starting. If they authorize this in-memory attempt, keep this page open and download backups; refresh or closing can lose your work.');
      if(loaded.ok && loaded.raw!==null){
        try{state=C.restoreAttempt(loaded.raw,data,Date.now());$('load-status').textContent='Saved attempt restored. Its original start and deadline have been retained.';showAttempt(false);}
        catch(_){rawBackup=loaded.raw;$('recovery').hidden=false;$('raw-backup').disabled=false;$('load-status').textContent='Recovery required. No new attempt was started.';return;}
      }else{$('start').disabled=false;$('load-status').textContent='Ready. The timer has not started.';}
      window.setInterval(()=>{if(state){update();if(Date.now()-lastPersist>=15000)persist();}},1000);
    } catch(error){data=null;$('start').disabled=true;$('load-status').textContent=`Unable to load the assessment. ${error.message} Reload before starting, or ask your interviewer for the printable paper.`;}
  }
  init();
})();
