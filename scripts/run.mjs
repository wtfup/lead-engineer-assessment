import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const mode=process.argv[2] === 'start'?'start':'dev';
const env={...process.env,NEXT_TELEMETRY_DISABLED:'1'};
const children=[]; let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const c of children)c.kill('SIGTERM');setTimeout(()=>process.exit(code),400).unref();}
for(const [bin,args] of [[process.execPath,['server/index.mjs']],[process.execPath,['node_modules/next/dist/bin/next',mode,'-p','4317','-H',process.env.WEB_HOST||'127.0.0.1']]]){
 const c=spawn(bin,args,{cwd:root,env,stdio:'inherit'});children.push(c);c.on('error',e=>{console.error(e.message);stop(1)});c.on('exit',code=>{if(!stopping)stop(code||0)});
}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
