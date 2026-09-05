import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openTestLab } from '../server/test-lab.mjs';

async function withApi(run, options={}) {
  const lab = await openTestLab(); let server;
  try {
    const { createServer } = await import('../server/index.mjs');
    server = await createServer({pool:lab.pool,...options});
    server.listen(0,'127.0.0.1'); await once(server,'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (path,{tenant='north',body,method=body?'POST':'GET'}={}) => {
      const response = await fetch(base+path,{method,headers:{'x-lab-tenant':tenant,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
      return {status:response.status,body:await response.json()};
    };
    await run({...lab,request,base});
  } finally { if(server) await new Promise(resolve=>server.close(resolve)); await lab.close(); }
}
const event = (overrides={}) => ({eventId:'test-event-1',paymentId:'test-payment-1',orderId:'n-003',status:'succeeded',amountPaise:90000,currency:'INR',occurredAt:'2026-08-05T10:00:00+05:30',...overrides});
const post = (request, body=event(), tenant='north') => request('/api/payments/events',{body,tenant});
const count = async (pool,table,order='n-003') => Number((await pool.query(`SELECT count(*) n FROM ${table} WHERE order_id=$1`,[order])).rows[0].n);

test('one successful payment reaches durable local fulfilment and an audit trail',()=>withApi(async({request,pool})=>{
  assert.equal((await post(request)).status,200);
  assert.equal((await request('/api/orders/n-003')).body.status,'paid');
  assert.equal((await request('/api/jobs/process',{method:'POST'})).status,200);
  assert.equal(await count(pool,'outbox'),1);
  assert.equal(await count(pool,'provider_receipts'),1);
  assert.equal(await count(pool,'fulfilments'),1);
  const audit=await request('/api/audit?order_id=n-003');
  assert.ok(audit.body.items.some(x=>x.action==='payment_succeeded'));
}));


test('order detail cannot cross the lab tenant boundary',()=>withApi(async({request})=>{
  const response=await request('/api/orders/s-001');
  assert.equal(response.status,404);
  assert.equal(response.body.tenant,undefined);
}));

test('summary counts paid orders once, subtracts settled refunds, never trusts ad conversions',()=>withApi(async({request})=>{
  assert.deepEqual((await request('/api/summary')).body,{tenant:'north',paidOrders:2,netRevenuePaise:220000,adSpendPaise:55000,roas:4});
  assert.deepEqual((await request('/api/summary',{tenant:'south'})).body,{tenant:'south',paidOrders:2,netRevenuePaise:200000,adSpendPaise:40000,roas:5});
}));


test('concurrent duplicate delivery creates one event, one outbox job and one fulfilment',()=>withApi(async({request,pool})=>{
  const responses=await Promise.all(Array.from({length:12},()=>post(request)));
  assert.ok(responses.every(x=>x.status===200));
    assert.equal(responses.filter(x=>x.body.duplicate===false).length,1);
  assert.equal(responses.filter(x=>x.body.duplicate===true).length,11);
  assert.equal(await count(pool,'payment_events'),1);
  assert.equal(await count(pool,'outbox'),1);
  await Promise.all(Array.from({length:4},()=>request('/api/jobs/process',{method:'POST'})));
  assert.equal(await count(pool,'provider_receipts'),1);
  assert.equal(await count(pool,'fulfilments'),1);
  assert.equal(await count(pool,'audit'),2); // accepted event + fulfilment; duplicate deliveries are no-ops
}));

test('same business payment under different event IDs still fulfils once',()=>withApi(async({request,pool})=>{
  const responses=await Promise.all(Array.from({length:8},(_,i)=>post(request,event({eventId:`business-${i}`}))));
  assert.ok(responses.every(x=>x.status===200));
  assert.equal(await count(pool,'payment_events'),8);
  assert.equal(await count(pool,'payments'),1);
  assert.equal(await count(pool,'outbox'),1);
  await request('/api/jobs/process',{method:'POST'});
  assert.equal(await count(pool,'fulfilments'),1);
}));

test('database failure rolls back event, payment, order, outbox and audit together',()=>withApi(async({request,pool})=>{
  await pool.query(`CREATE FUNCTION reject_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected disk-like failure'; END $$;
    CREATE TRIGGER fail_outbox BEFORE INSERT ON outbox FOR EACH ROW EXECUTE FUNCTION reject_outbox()`);
  assert.equal((await post(request)).status,500);
  assert.equal((await request('/api/orders/n-003')).body.status,'pending');
  for(const table of ['payment_events','payments','outbox','audit']) assert.equal(await count(pool,table),0,table);
  await pool.query('DROP TRIGGER fail_outbox ON outbox');
  assert.equal((await post(request)).status,200);
  assert.equal(await count(pool,'outbox'),1);
}));

test('late failed and pending events never regress a successful payment',()=>withApi(async({request,pool})=>{
  await post(request);
  for(const status of ['failed','pending']) assert.equal((await post(request,event({eventId:`late-${status}`,status,occurredAt:'2026-08-07T12:00:00Z'}))).status,200);
  assert.equal((await request('/api/orders/n-003')).body.status,'paid');
  assert.equal((await pool.query("SELECT status FROM payments WHERE tenant='north' AND payment_id='test-payment-1'")).rows[0].status,'succeeded');
  assert.equal(await count(pool,'outbox'),1);
}));

test('conflicting event identity is rejected rather than silently replayed',()=>withApi(async({request,pool})=>{
  await post(request);
  const response=await post(request,event({status:'failed'}));
  assert.equal(response.status,409);
  assert.equal((await request('/api/orders/n-003')).body.status,'paid');
  assert.equal(await count(pool,'audit'),1);
}));

test('invalid amounts, currency, timestamps and wrong tenant cause zero business writes',()=>withApi(async({request,pool})=>{
  for(const body of [event({amountPaise:0}),event({amountPaise:-1}),event({amountPaise:90000.5}),event({amountPaise:'90000'}),event({currency:'USD'}),event({occurredAt:'2026-08-05T10:00:00'})]) assert.equal((await post(request,body)).status,400);
  assert.equal((await post(request,event({amountPaise:90001}))).status,409);
  assert.equal((await post(request,event(),'south')).status,404);
  for(const table of ['payment_events','payments','outbox','audit']) assert.equal(await count(pool,table),0,table);
}));

test('provider acceptance followed by worker restart reconciles without duplicate fulfilment',()=>{
  let crash=true;
  return withApi(async({request,pool})=>{
    await post(request);
    assert.equal((await request('/api/jobs/process',{method:'POST'})).status,500);
    assert.equal(await count(pool,'provider_receipts'),1);
    assert.equal(await count(pool,'fulfilments'),0);
    const {processJobs}=await import('../server/worker.mjs'); // fresh worker invocation, no in-memory receipt cache
    const resumed=await processJobs(pool,'north');
    assert.equal(resumed.processed,1);
    assert.equal(await count(pool,'provider_receipts'),1);
    assert.equal(await count(pool,'fulfilments'),1);
    assert.equal((await processJobs(pool,'north')).processed,0);
  },{afterProviderAccepted:()=>{if(crash){crash=false;throw new Error('simulated worker death after durable acceptance');}}});
});

test('API receipt distinguishes exact replay, equivalent instant, and new transport identity',()=>withApi(async({request,pool})=>{
  const first=await post(request); assert.equal(first.status,200); assert.equal(first.body.accepted,true); assert.equal(first.body.duplicate,false);
  const before=await count(pool,'audit');
  for(const body of [event(),event({occurredAt:'2026-08-05T04:30:00Z'})]) {
    const reply=await post(request,body); assert.equal(reply.status,200); assert.equal(reply.body.duplicate,true);
  }
  assert.equal(await count(pool,'audit'),before);
  const fresh=await post(request,event({eventId:'second-transport'}));
  assert.equal(fresh.status,200); assert.equal(fresh.body.duplicate,false);
  assert.equal(await count(pool,'payment_events'),2); assert.equal(await count(pool,'payments'),1); assert.equal(await count(pool,'outbox'),1);
}));

test('same event identity with a genuinely different instant conflicts without writes',()=>withApi(async({request,pool})=>{
  await post(request); const before=await count(pool,'audit');
  const reply=await post(request,event({occurredAt:'2026-08-05T04:30:01Z'}));
  assert.equal(reply.status,409); assert.equal(await count(pool,'audit'),before); assert.equal(await count(pool,'payment_events'),1);
}));

test('historical paid order does not backfill fulfilment outside the replay window',()=>withApi(async({request,pool})=>{
  const reply=await post(request,event({eventId:'historical-new-event',paymentId:'historical-new-payment',orderId:'n-001',amountPaise:100000}));
  assert.equal(reply.status,200); assert.equal(reply.body.duplicate,false);
  assert.equal(await count(pool,'outbox','n-001'),0); assert.equal((await request('/api/orders/n-001')).body.status,'paid');
}));
