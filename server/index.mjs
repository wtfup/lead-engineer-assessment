import http from 'node:http';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPool } from './db.mjs';
import { createReads } from './reads.mjs';
import { processJobs } from './worker.mjs';
import { HttpError, validateEvent } from './common.mjs';

async function readJson(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new HttpError(415,'application/json required');
  let size=0; const chunks=[];
  for await(const chunk of req) { size+=chunk.length; if(size>16384) throw new HttpError(413,'Body too large'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400,'Invalid JSON'); }
}
export async function createServer({pool,serviceModule=process.env.SERVICE_MODULE,afterProviderAccepted}={}) {
  const ownsPool=!pool;
  pool ||= createPool();
  let moduleUrl=new URL('./service.mjs',import.meta.url);
  if(serviceModule) {
    if(!isAbsolute(serviceModule) || !serviceModule.endsWith('.mjs')) { if(ownsPool) await pool.end(); throw new Error('SERVICE_MODULE must be an absolute local .mjs path'); }
    moduleUrl=pathToFileURL(serviceModule);
  }
  const {createService}=await import(moduleUrl.href);
  const service=await createService({pool});
  const reads=createReads(pool);
  const server=http.createServer(async(req,res)=>{
    res.setHeader('content-type','application/json; charset=utf-8');
    res.setHeader('cache-control','no-store');
    res.setHeader('x-content-type-options','nosniff');
    try {
      const url=new URL(req.url,'http://127.0.0.1');
      let result;
      if(req.method==='GET' && url.pathname==='/health') {
        await pool.query('SELECT 1'); result={status:'ok',database:'postgresql',synthetic:true};
      } else {
        const tenant=req.headers['x-lab-tenant'];
        if(!['north','south'].includes(tenant)) throw new HttpError(400,'x-lab-tenant must be north or south (simulated auth)');
        const path=url.pathname;
        if(req.method==='GET' && path==='/api/summary') result=await service.summary(tenant);
        else if(req.method==='GET' && path==='/api/orders') result=await reads.orders(tenant,url.searchParams);
        else if(req.method==='GET' && /^\/api\/orders\/[A-Za-z0-9_-]{1,80}$/.test(path)) result=await service.order(tenant,path.split('/').at(-1));
        else if(req.method==='GET' && path==='/api/campaigns') result=await reads.campaigns(tenant);
        else if(req.method==='GET' && path==='/api/audit') result=await reads.audit(tenant,url.searchParams.get('order_id'));
        else if(req.method==='POST' && path==='/api/payments/events') result=await service.paymentEvent(tenant,validateEvent(await readJson(req)));
        else if(req.method==='POST' && path==='/api/jobs/process') result=await processJobs(pool,tenant,{afterProviderAccepted});
        else throw new HttpError(404,'Route not found');
      }
      res.writeHead(200); res.end(JSON.stringify(result));
    } catch(error) {
      const status=error instanceof HttpError?error.status:500;
      res.writeHead(status); res.end(JSON.stringify({error:status===500?'Internal lab error':error.message}));
    }
  });
  server.requestTimeout=10000; server.headersTimeout=10000;
  server.on('close',()=>{if(ownsPool) void pool.end();});
  return server;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const host=process.env.HOST||'127.0.0.1';
  if(!['127.0.0.1','localhost'].includes(host)) throw new Error('API must bind loopback');
  const port=Number(process.env.PORT||4318);
  if(!Number.isInteger(port)||port<1||port>65535) throw new Error('Invalid port');
  const server=await createServer();
  server.listen(port,host,()=>console.log(`Synthetic assessment API http://${host}:${port}`));
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close());
}
