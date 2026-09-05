import {spawnSync} from 'node:child_process';
const [major,minor]=process.versions.node.split('.').map(Number);
const compatible=major>22||(major===22&&minor>=13);
console.log('Node:',process.versions.node,compatible?'OK':'REQUIRES >=22.13');
const git=spawnSync('git',['--version'],{encoding:'utf8'});console.log(git.stdout.trim()||'Git unavailable');
const docker=spawnSync('docker',['compose','version'],{encoding:'utf8'});console.log(docker.stdout.trim()||'Docker Compose unavailable: install Docker Desktop before the test.');
try {const {default:pg}=await import('pg');const p=new pg.Pool({connectionString:'postgresql://assessment:assessment@127.0.0.1:55439/assessment',connectionTimeoutMillis:3000});try{const r=await p.query('select current_database() as database, version()');console.log('Lab PostgreSQL:',r.rows[0].database,r.rows[0].version.split(' on ')[0]);}finally{await p.end();}}catch(e){console.log('Lab database not ready:',e.message);console.log('Run: docker compose up -d db');process.exitCode=1;}
if(!compatible)process.exitCode=1;
