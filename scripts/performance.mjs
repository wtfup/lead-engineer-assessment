import {createPool} from '../server/db.mjs';
import {readFile} from 'node:fs/promises';
const pool=createPool();
try{const sql=await readFile(new URL('../database/performance.sql',import.meta.url),'utf8');const result=await pool.query(sql);console.log('Performance lab executed against assessment only.');for(const r of Array.isArray(result)?result:[result])if(r.rows?.length)console.log(JSON.stringify(r.rows,null,2));}finally{await pool.end();}
