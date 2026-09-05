export const DEFAULT_DATABASE_URL = 'postgresql://assessment:assessment@127.0.0.1:55439/assessment';

export function assertLabDatabaseUrl(value = process.env.DATABASE_URL || DEFAULT_DATABASE_URL) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Lab database URL required'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || !['127.0.0.1', 'localhost', 'db'].includes(url.hostname)
      || url.pathname !== '/assessment' || url.username !== 'assessment'
      || url.password !== 'assessment' || url.search || url.hash) {
    throw new Error('Lab database only: assessment/assessment on loopback or db, no URL options');
  }
  return value;
}
