import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createPool, assertLabSchema } from './db.mjs';

export async function resetDatabase({ pool, schema = process.env.LAB_SCHEMA || 'assessment_lab' } = {}) {
  assertLabSchema(schema);
  const ownPool = !pool;
  pool ||= createPool({ schema });
  const client = await pool.connect();
  try {
    const identity = (await client.query('SELECT current_database() db, current_user usr')).rows[0];
    if (identity.db !== 'assessment' || identity.usr !== 'assessment') throw new Error('Lab database identity mismatch');
    await client.query('BEGIN');
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema}`);
    await client.query(await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8'));
    const seed = JSON.parse(await readFile(new URL('../fixtures/seed.json', import.meta.url), 'utf8'));
    for (const tenant of seed.tenants) await client.query('INSERT INTO tenants VALUES ($1)', [tenant]);
    for (const x of seed.campaigns) await client.query('INSERT INTO campaigns VALUES ($1,$2,$3)', [x.id,x.tenant,x.name]);
    for (const x of seed.orders) await client.query('INSERT INTO orders VALUES ($1,$2,$3,$4,$5,$6,$7)', [x.id,x.tenant,x.campaignId,x.amountPaise,x.currency,x.status,x.createdAt]);
    for (const x of seed.refunds) await client.query('INSERT INTO refunds VALUES ($1,$2,$3,$4,$5,$6)', [x.id,x.tenant,x.orderId,x.amountPaise,x.status,x.occurredAt]);
    for (const x of seed.adMetrics) await client.query('INSERT INTO ad_metrics VALUES ($1,$2,$3,$4,$5,$6)', [x.tenant,x.campaignId,x.day,x.spendPaise,x.reportedConversions,x.reportedRevenuePaise]);
    for (const x of seed.paymentEvents) {
      await client.query(`INSERT INTO payment_events (tenant,event_id,payment_id,order_id,status,amount_paise,currency,occurred_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (tenant,event_id) DO NOTHING`, [x.tenant,x.eventId,x.paymentId,x.orderId,x.status,x.amountPaise,x.currency,x.occurredAt]);
    }
    for (const x of seed.payments) await client.query('INSERT INTO payments VALUES ($1,$2,$3,$4,$5)', [x.tenant,x.paymentId,x.orderId,x.status,x.amountPaise]);
    await client.query('COMMIT');
    return { schema, orders: seed.orders.length, synthetic: true };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); if (ownPool) await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  resetDatabase().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
