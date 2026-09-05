import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const dir=new URL('../submission/',import.meta.url),file=new URL('session.json',dir);
const action=process.argv[2]||'status';let state;
try{state=JSON.parse(await readFile(file,'utf8'));}catch{}
if(action==='start'){
 if(state){console.log('Session already exists. Original start preserved.');}
 else{state={schemaVersion:1,practicalStartedAt:new Date().toISOString(),events:[],timing:'local clock, honor/proctor based, not tamperproof'};await mkdir(dir,{recursive:true});await writeFile(file,JSON.stringify(state,null,2)+'\n');console.log('200-minute practical started. No monitoring or upload is performed.');}
}else if(action==='card'){
 if(!state)throw new Error('Run npm run session -- start first, AFTER reasoning.');
 const mins=(Date.now()-Date.parse(state.practicalStartedAt))/60000;
 if(mins<110){console.log(`Change card due at practical minute 110; elapsed ${Math.floor(mins)}. This timing is not a security boundary.`);process.exit(1);}
 console.log(await readFile(new URL('../candidate/08_CHANGE_CARD.md',import.meta.url),'utf8'));
 state.events.push({type:'change-card-opened',at:new Date().toISOString()});await writeFile(file,JSON.stringify(state,null,2)+'\n');
}else if(action==='finish'){
 if(!state)throw new Error('Session not started');state.finishedAt=new Date().toISOString();await writeFile(file,JSON.stringify(state,null,2)+'\n');
}
if(state){const elapsed=Math.max(0,Math.floor((Date.now()-Date.parse(state.practicalStartedAt))/60000));console.log(JSON.stringify({...state,elapsedMinutes:elapsed,remainingMinutes:Math.max(0,200-elapsed)},null,2));console.log('Record:',fileURLToPath(file));}
else console.log('No practical session yet. Setup is outside the clock.');
