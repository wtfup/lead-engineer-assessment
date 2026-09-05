export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const orderView = row => ({id:row.id,tenant:row.tenant,campaignId:row.campaign_id,amountPaise:row.amount_paise,status:row.status});
export function validateEvent(body) {
  const fields = ['eventId','paymentId','orderId','status','amountPaise','currency','occurredAt'];
  if (!body || Array.isArray(body) || typeof body !== 'object'
      || Object.keys(body).length !== fields.length || fields.some(k=>!(k in body))) throw new HttpError(400,'Invalid event fields');
  for (const key of ['eventId','paymentId','orderId']) if (typeof body[key] !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(body[key])) throw new HttpError(400,`Invalid ${key}`);
  if (!['succeeded','failed','pending'].includes(body.status)) throw new HttpError(400,'Invalid status');
  if (!Number.isInteger(body.amountPaise) || body.amountPaise<=0 || body.amountPaise>1000000000) throw new HttpError(400,'amountPaise must be a positive integer <= 1000000000');
  if (body.currency !== 'INR') throw new HttpError(400,'Only INR is supported');
  if (typeof body.occurredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(body.occurredAt) || !Number.isFinite(Date.parse(body.occurredAt))) throw new HttpError(400,'occurredAt requires an ISO timestamp with timezone');
  const [year,month,day]=body.occurredAt.slice(0,10).split('-').map(Number);
  const leap=year%4===0 && (year%100!==0 || year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(year<1 || month<1 || month>12 || day<1 || day>days[month-1] || +body.occurredAt.slice(11,13)>23) throw new HttpError(400,'Invalid calendar timestamp');
  return body;
}
export function assertOrderAmount(order, event) {
  if (!order) throw new HttpError(404,'Order not found');
  if (order.amount_paise !== event.amountPaise || order.currency !== event.currency) throw new HttpError(409,'Payment amount/currency does not match order');
}
export const eventValues = (tenant,e) => [tenant,e.eventId,e.paymentId,e.orderId,e.status,e.amountPaise,e.currency,e.occurredAt];
export const insertEventSql = `INSERT INTO payment_events (tenant,event_id,payment_id,order_id,status,amount_paise,currency,occurred_at)
 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (tenant,event_id) DO NOTHING RETURNING id`;
