// Assessment domain service. Target behavior is specified in API_CONTRACT.md.
import { HttpError, orderView, assertOrderAmount, eventValues, insertEventSql } from './common.mjs';

export function createService({ pool }) {
  return {
    async summary(tenant) {
      const row=(await pool.query(`SELECT count(*)::int paid,COALESCE(sum(amount_paise),0)::bigint revenue
        FROM payment_events WHERE tenant=$1 AND status='succeeded'`,[tenant])).rows[0];
      const spend=Number((await pool.query('SELECT COALESCE(sum(spend_paise),0)::bigint spend FROM ad_metrics WHERE tenant=$1',[tenant])).rows[0].spend);
      const revenue=Number(row.revenue);
      return {tenant,paidOrders:row.paid,netRevenuePaise:revenue,adSpendPaise:spend,roas:spend?revenue/spend:null};
    },
    async order(tenant,id) {
      const row=(await pool.query('SELECT * FROM orders WHERE id=$1',[id])).rows[0];
      if (!row) throw new HttpError(404,'Order not found');
      return orderView(row);
    },
    async paymentEvent(tenant,e) {
      const order=(await pool.query('SELECT * FROM orders WHERE tenant=$1 AND id=$2',[tenant,e.orderId])).rows[0];
      assertOrderAmount(order,e);
      await pool.query(insertEventSql,eventValues(tenant,e));
      await pool.query(`INSERT INTO payments (tenant,payment_id,order_id,status,amount_paise) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (tenant,payment_id) DO UPDATE SET status=EXCLUDED.status`,[tenant,e.paymentId,e.orderId,e.status,e.amountPaise]);
      const status=e.status==='succeeded'?'paid':e.status==='failed'?'failed':'pending';
      await pool.query('UPDATE orders SET status=$1 WHERE tenant=$2 AND id=$3',[status,tenant,e.orderId]);
      if(e.status==='succeeded') await pool.query('INSERT INTO outbox (tenant,order_id,business_key) VALUES ($1,$2,$3)',[tenant,e.orderId,`${tenant}:${e.eventId}`]);
      await pool.query('INSERT INTO audit (tenant,order_id,event_id,action) VALUES ($1,$2,$3,$4)',[tenant,e.orderId,e.eventId,`payment_${e.status}`]);
      return {accepted:true,duplicate:false,orderId:e.orderId,orderStatus:status};
    }
  };
}
