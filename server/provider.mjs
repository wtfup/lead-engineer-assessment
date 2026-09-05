// Deterministic, durable, local-only provider. No HTTP, SDK or credentials.
// The lookup contract is intentionally supplied; do not replace it with blind retries.
export async function acceptLocal(pool, job) {
  let receipt=(await pool.query('SELECT * FROM provider_receipts WHERE business_key=$1',[job.business_key])).rows[0];
  if (receipt) return receipt;
  await pool.query(`INSERT INTO provider_receipts (business_key,tenant,order_id,receipt_id)
    VALUES ($1,$2,$3,$4) ON CONFLICT (business_key) DO NOTHING`,
  [job.business_key,job.tenant,job.order_id,`local:${job.business_key}`]);
  receipt=(await pool.query('SELECT * FROM provider_receipts WHERE business_key=$1',[job.business_key])).rows[0];
  return receipt;
}
