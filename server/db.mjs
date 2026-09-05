import pg from 'pg';
import { assertLabDatabaseUrl } from './config.mjs';

export function assertLabSchema(schema) {
  if (!/^assessment_(lab|test_[a-f0-9]{24})$/.test(schema)) throw new Error('Lab schema name required');
  return schema;
}
export function createPool({ schema = process.env.LAB_SCHEMA || 'assessment_lab', connectionString } = {}) {
  assertLabSchema(schema);
  return new pg.Pool({
    connectionString: assertLabDatabaseUrl(connectionString),
    options: `-c search_path=${schema} -c statement_timeout=10000 -c lock_timeout=5000`,
    max: 20, connectionTimeoutMillis: 3000, idleTimeoutMillis: 3000,
  });
}
