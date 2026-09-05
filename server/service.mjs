// Assessment domain service. Target behavior is specified in API_CONTRACT.md.
import { HttpError, orderView, assertOrderAmount, eventValues, insertEventSql } from './common.mjs';

const STATUS_RANK = { pending: 0, failed: 1, succeeded: 2 };
const ORDER_STATUS = { succeeded: 'paid', failed: 'failed', pending: 'pending' };
const sameInstant = (a, b) => Date.parse(a) === Date.parse(b);

export function createService({ pool }) {
  return {
    async summary(tenant) {
      const row=(await pool.query(`SELECT count(*)::int paid,COALESCE(sum(o.amount_paise),0)::bigint gross,
          COALESCE(sum(CASE WHEN r.status='settled' THEN r.amount_paise ELSE 0 END),0)::bigint refunded
        FROM orders o
        LEFT JOIN (SELECT tenant,order_id,status,amount_paise FROM refunds) r ON r.tenant=o.tenant AND r.order_id=o.id
        WHERE o.tenant=$1 AND o.status='paid'`,[tenant])).rows[0];
      const spend=Number((await pool.query('SELECT COALESCE(sum(spend_paise),0)::bigint spend FROM ad_metrics WHERE tenant=$1',[tenant])).rows[0].spend);
      const revenue=Number(row.gross)-Number(row.refunded);
      return {tenant,paidOrders:row.paid,netRevenuePaise:revenue,adSpendPaise:spend,roas:spend?revenue/spend:null};
    },
    async order(tenant,id) {
      const row=(await pool.query('SELECT * FROM orders WHERE tenant=$1 AND id=$2',[tenant,id])).rows[0];
      if (!row) throw new HttpError(404,'Order not found');
      return orderView(row);
    },
    async paymentEvent(tenant,e) {
      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        // Lock the order row first so concurrent events for the same order/payment serialize here.
        const order=(await client.query('SELECT * FROM orders WHERE tenant=$1 AND id=$2 FOR UPDATE',[tenant,e.orderId])).rows[0];
        assertOrderAmount(order,e);

        const inserted=(await client.query(insertEventSql,eventValues(tenant,e))).rows[0];
        if(!inserted) {
          // Same (tenant,eventId) already recorded: distinguish exact replay from a changed payload.
          const existing=(await client.query('SELECT * FROM payment_events WHERE tenant=$1 AND event_id=$2',[tenant,e.eventId])).rows[0];
          const isExactReplay = existing.payment_id===e.paymentId && existing.order_id===e.orderId
            && existing.status===e.status && existing.amount_paise===e.amountPaise && existing.currency===e.currency
            && sameInstant(existing.occurred_at.toISOString(),e.occurredAt);
          if(!isExactReplay) throw new HttpError(409,'Event identity reused with a different payload');
          await client.query('COMMIT');
          return {accepted:true,duplicate:true,orderId:e.orderId,orderStatus:order.status};
        }

        const existingPayment=(await client.query('SELECT * FROM payments WHERE tenant=$1 AND payment_id=$2',[tenant,e.paymentId])).rows[0];
        if(existingPayment && existingPayment.order_id!==e.orderId) throw new HttpError(409,'Payment identity is already bound to a different order');

        const wasAlreadyPaid = order.status==='paid';
        const priorRank = existingPayment ? STATUS_RANK[existingPayment.status] : -1;
        const applies = STATUS_RANK[e.status] >= priorRank;

        if(applies) {
          await client.query(`INSERT INTO payments (tenant,payment_id,order_id,status,amount_paise) VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT (tenant,payment_id) DO UPDATE SET status=EXCLUDED.status,amount_paise=EXCLUDED.amount_paise`,
            [tenant,e.paymentId,e.orderId,e.status,e.amountPaise]);
          await client.query('UPDATE orders SET status=$1 WHERE tenant=$2 AND id=$3',[ORDER_STATUS[e.status],tenant,e.orderId]);
        }

        const orderStatus = applies ? ORDER_STATUS[e.status] : order.status;
        if(e.status==='succeeded' && applies && !wasAlreadyPaid) {
          await client.query('INSERT INTO outbox (tenant,order_id,business_key) VALUES ($1,$2,$3)',[tenant,e.orderId,`${tenant}:payment:${e.paymentId}`]);
        }
        await client.query('INSERT INTO audit (tenant,order_id,event_id,action) VALUES ($1,$2,$3,$4)',[tenant,e.orderId,e.eventId,`payment_${e.status}`]);

        await client.query('COMMIT');
        return {accepted:true,duplicate:false,orderId:e.orderId,orderStatus};
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  };
}
