import test from 'node:test';
import assert from 'node:assert/strict';

test('real PostgreSQL reset loads constrained synthetic seed and is repeatable', async () => {
  const { openTestLab } = await import('../server/test-lab.mjs');
  const lab = await openTestLab();
  try {
    const count = await lab.pool.query('SELECT count(*)::int AS n FROM orders');
    assert.equal(count.rows[0].n, 8);
    const db = await lab.pool.query('SELECT current_database() AS db, current_user AS usr, version() AS version');
    assert.equal(db.rows[0].db, 'assessment');
    assert.equal(db.rows[0].usr, 'assessment');
    assert.match(db.rows[0].version, /PostgreSQL/);
    await assert.rejects(lab.pool.query("INSERT INTO orders VALUES ('bad','north','n-search',-1,'INR','pending','2026-08-01T00:00:00Z')"), /check constraint/i);
    await lab.reset();
    assert.equal((await lab.pool.query('SELECT count(*)::int AS n FROM orders')).rows[0].n, 8);
  } finally { await lab.close(); }
});

test('performance lab uses real 50000 rows without changing business fixtures', async () => {
  const { openTestLab } = await import('../server/test-lab.mjs');
  const { readFile } = await import('node:fs/promises');
  const lab = await openTestLab();
  try {
    const sql=await readFile(new URL('../database/performance.sql',import.meta.url),'utf8');
    const results=await lab.pool.query(sql);
    assert.equal((await lab.pool.query('SELECT count(*)::int n FROM query_lab_orders')).rows[0].n,50000);
    assert.equal((await lab.pool.query('SELECT count(*)::int n FROM orders')).rows[0].n,8);
    const plan=results.at(-1).rows[0]['QUERY PLAN'][0];
    assert.ok(plan.Plan);
    assert.equal(plan.Plan['Actual Rows'],50);
  } finally { await lab.close(); }
});

test('database safety rejects non-lab targets and URL overrides before connecting', async () => {
  const { assertLabDatabaseUrl } = await import('../server/config.mjs');
  for (const url of [
    'postgresql://assessment:assessment@example.com/assessment',
    'postgresql://assessment:assessment@127.0.0.1/production',
    'postgresql://root:assessment@127.0.0.1/assessment',
    'postgresql://assessment:assessment@127.0.0.1/assessment?host=example.com',
    'postgresql://assessment:secret@127.0.0.1/assessment',
  ]) assert.throws(() => assertLabDatabaseUrl(url), /lab/i);
  assert.equal(assertLabDatabaseUrl('postgresql://assessment:assessment@127.0.0.1:55439/assessment'), 'postgresql://assessment:assessment@127.0.0.1:55439/assessment');
  assert.doesNotThrow(() => assertLabDatabaseUrl('postgresql://assessment:assessment@db:5432/assessment'));
});
