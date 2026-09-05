import { randomBytes } from 'node:crypto';
import { createPool } from './db.mjs';
import { resetDatabase } from './reset.mjs';

// Every test receives an independent schema. Never reset another test or the running UI.
export async function openTestLab() {
  const schema = `assessment_test_${randomBytes(12).toString('hex')}`;
  const pool = createPool({ schema });
  const reset = () => resetDatabase({ pool, schema });
  try { await reset(); } catch (error) { await pool.end(); throw error; }
  return { pool, schema, reset, async close() {
    try { await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await pool.end(); }
  } };
}
