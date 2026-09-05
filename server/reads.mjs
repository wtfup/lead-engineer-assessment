import { HttpError, orderView } from './common.mjs';
export function createReads(pool) {
  return {
    async orders(tenant, query) {
      const rawLimit = query.get('limit') ?? '20';
      if (!/^[0-9]+$/.test(rawLimit) || +rawLimit < 1 || +rawLimit > 100) throw new HttpError(400,'limit must be 1..100');
      const limit = +rawLimit;
      let after = '';
      const cursor = query.get('cursor');
      if (cursor) {
        try {
          if (cursor.length>512 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
          const parsed=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));
          if (parsed.tenant !== tenant || typeof parsed.after !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(parsed.after)) throw new Error();
          after=parsed.after;
        } catch { throw new HttpError(400,'Invalid tenant cursor'); }
      }
      const {rows}=await pool.query('SELECT * FROM orders WHERE tenant=$1 AND id>$2 ORDER BY id LIMIT $3',[tenant,after,limit+1]);
      const items=rows.slice(0,limit).map(orderView);
      return {items,nextCursor:rows.length>limit?Buffer.from(JSON.stringify({tenant,after:items.at(-1).id})).toString('base64url'):null};
    },
    async campaigns(tenant) {
      const {rows}=await pool.query(`SELECT c.id,c.tenant,c.name,COALESCE(SUM(a.spend_paise),0)::bigint spend
        FROM campaigns c LEFT JOIN ad_metrics a ON a.tenant=c.tenant AND a.campaign_id=c.id WHERE c.tenant=$1 GROUP BY c.id ORDER BY c.id`,[tenant]);
      return {items:rows.map(r=>({id:r.id,tenant:r.tenant,name:r.name,adSpendPaise:Number(r.spend)}))};
    },
    async audit(tenant,orderId) {
      if (!orderId || !/^[A-Za-z0-9_-]{1,80}$/.test(orderId)) throw new HttpError(400,'order_id is required');
      const {rows}=await pool.query('SELECT * FROM audit WHERE tenant=$1 AND order_id=$2 ORDER BY id',[tenant,orderId]);
      return {items:rows.map(r=>({id:String(r.id),tenant:r.tenant,orderId:r.order_id,eventId:r.event_id,action:r.action,createdAt:r.created_at.toISOString()}))};
    }
  };
}
