import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openTestLab } from '../server/test-lab.mjs';

test('loopback HTTP health, typed reads, tenant pagination and safe input errors', async () => {
  const lab = await openTestLab();
  let server;
  try {
    const { createServer } = await import('../server/index.mjs');
    server = await createServer({ pool: lab.pool });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (path, init={}) => fetch(base + path, { ...init, headers: {'x-lab-tenant':'north', ...init.headers} });
    assert.deepEqual(await (await request('/health')).json(), {status:'ok',database:'postgresql',synthetic:true});
    const summary = await (await request('/api/summary')).json();
    assert.deepEqual(Object.keys(summary).sort(), ['adSpendPaise','netRevenuePaise','paidOrders','roas','tenant'].sort());
    assert.equal(summary.tenant, 'north');
    assert.ok(Number.isInteger(summary.netRevenuePaise));
    const first = await (await request('/api/orders?limit=2')).json();
    assert.deepEqual(first.items.map(x=>x.id), ['n-001','n-002']);
    assert.ok(first.nextCursor);
    const second = await (await request(`/api/orders?limit=2&cursor=${first.nextCursor}`)).json();
    assert.deepEqual(second.items.map(x=>x.id), ['n-003','n-004']);
    assert.equal((await request(`/api/orders?cursor=${first.nextCursor}`, {headers:{'x-lab-tenant':'south'}})).status, 400);
    const detail = await (await request('/api/orders/n-001')).json();
    assert.deepEqual(detail, {id:'n-001',tenant:'north',campaignId:'n-search',amountPaise:100000,status:'paid'});
    const campaigns = await (await request('/api/campaigns')).json();
    assert.equal(campaigns.items.length, 2);
    assert.ok(campaigns.items.every(x=>x.tenant==='north'));
    assert.deepEqual(await (await request('/api/audit?order_id=n-001')).json(), {items:[]});
    assert.equal((await fetch(base+'/api/orders')).status, 400);
    assert.equal((await request('/api/orders?limit=NaN')).status, 400);
    assert.equal((await request('/api/orders?cursor=garbage')).status, 400);
    assert.equal((await request('/api/orders/missing')).status, 404);
    assert.equal((await request('/api/payments/events',{method:'POST',headers:{'content-type':'application/json'},body:'{bad'})).status,400);
    assert.equal((await request('/api/payments/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({})})).status,400);
    assert.equal((await request('/api/payments/events',{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(17000)})).status,413);
    assert.equal((await request('/api/payments/events',{method:'POST',headers:{'content-type':'text/plain'},body:'{}'})).status,415);
    const impossibleDate={eventId:'date-check',paymentId:'date-check',orderId:'n-003',status:'succeeded',amountPaise:90000,currency:'INR',occurredAt:'2026-02-30T10:00:00Z'};
    assert.equal((await request('/api/payments/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(impossibleDate)})).status,400);
    await assert.rejects(createServer({pool:lab.pool,serviceModule:'https://example.com/service.mjs'}),/absolute local/);
    assert.deepEqual(await (await request('/api/jobs/process',{method:'POST'})).json(),{processed:0,remaining:0});
  } finally { if(server) await new Promise(resolve=>server.close(resolve)); await lab.close(); }
});
