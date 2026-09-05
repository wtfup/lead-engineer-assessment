// Targeted regression coverage for the three defect families repaired in server/service.mjs:
// tenant isolation on single-order reads, an explicit transaction boundary, and status-precedence
// idempotency. These fail against the original starter and pass against the repaired service.
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

test('single-order read cannot cross the tenant boundary (was: WHERE id=$1 with no tenant filter)',()=>withApi(async({request})=>{
  const asOwner=await request('/api/orders/s-001',{tenant:'south'});
  assert.equal(asOwner.status,200);
  assert.equal(asOwner.body.id,'s-001');
  const crossTenant=await request('/api/orders/s-001',{tenant:'north'});
  assert.equal(crossTenant.status,404);
  assert.equal(crossTenant.body.tenant,undefined);
}));

test('a failed write after the order update rolls back the whole payment event, not just the outbox insert',()=>withApi(async({request,pool})=>{
  // The original service issued five independent pool.query calls with no shared transaction,
  // so a failure after the order UPDATE left payment_events/payments/orders durably half-applied.
  await pool.query(`CREATE FUNCTION reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected late failure'; END $$;
    CREATE TRIGGER fail_audit BEFORE INSERT ON audit FOR EACH ROW EXECUTE FUNCTION reject_audit()`);
  const response=await post(request);
  assert.equal(response.status,500);
  assert.equal((await request('/api/orders/n-003')).body.status,'pending');
  for(const table of ['payment_events','payments','outbox','audit']) assert.equal(await count(pool,table),0,table);
  await pool.query('DROP TRIGGER fail_audit ON audit');
  assert.equal((await post(request)).status,200);
}));

test('a late failed event cannot revoke an already-succeeded payment (status precedence, not last-write-wins)',()=>withApi(async({request,pool})=>{
  // The original service upserted payments with `DO UPDATE SET status=EXCLUDED.status`, so whichever
  // event arrived last always won, regardless of precedence. A late failed observation for the same
  // payment (a different transport event ID) must be retained as evidence but must not flip a paid order.
  await post(request);
  assert.equal((await request('/api/orders/n-003')).body.status,'paid');
  const late=await post(request,event({eventId:'late-failed-observation',status:'failed',occurredAt:'2026-08-07T12:00:00Z'}));
  assert.equal(late.status,200);
  assert.equal((await request('/api/orders/n-003')).body.status,'paid');
  assert.equal((await pool.query("SELECT status FROM payments WHERE tenant='north' AND payment_id='test-payment-1'")).rows[0].status,'succeeded');
  assert.equal(await count(pool,'outbox'),1);
}));
