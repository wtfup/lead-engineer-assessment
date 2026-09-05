import { acceptLocal } from './provider.mjs';
export async function processJobs(pool, tenant, { afterProviderAccepted } = {}) {
  let processed=0;
  for (let i=0;i<100;i++) {
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const job=(await client.query("SELECT * FROM outbox WHERE tenant=$1 AND status='pending' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED",[tenant])).rows[0];
      if (!job) { await client.query('COMMIT'); break; }
      // Separate connection commits provider state before our transaction: a real uncertainty boundary.
      const receipt=await acceptLocal(pool,job);
      if (afterProviderAccepted) await afterProviderAccepted(job,receipt);
      await client.query('INSERT INTO fulfilments (job_id,tenant,order_id,receipt_id) VALUES ($1,$2,$3,$4) ON CONFLICT (job_id) DO NOTHING',[job.id,tenant,job.order_id,receipt.receipt_id]);
      await client.query("UPDATE outbox SET status='done' WHERE id=$1",[job.id]);
      await client.query("INSERT INTO audit (tenant,order_id,action) VALUES ($1,$2,'fulfilled')",[tenant,job.order_id]);
      await client.query('COMMIT'); processed++;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  const remaining=Number((await pool.query("SELECT count(*) n FROM outbox WHERE tenant=$1 AND status='pending'",[tenant])).rows[0].n);
  return {processed,remaining};
}
