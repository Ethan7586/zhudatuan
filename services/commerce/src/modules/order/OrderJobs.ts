import { randomUUID } from 'node:crypto';
import type { ClaimedJob, JobProcessor } from '../../foundation/application/JobRunner';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import { paymentPort, releaseOrderHolds } from '../payment/PaymentModule';
import { checkoutSessionPort } from '../checkout/CheckoutModule';
import { inventoryPort } from '../inventory/InventoryModule';
import { orderPort } from './OrderPort';

export class OrderExpiryJobProcessor implements JobProcessor {
  constructor(private readonly pool: DatabasePool) {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'orderexpiry') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    const checkout = typeof payload.checkout === 'string' ? payload.checkout : null;
    const order = typeof payload.order === 'string' ? payload.order : null;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const expired = await checkoutSessionPort.expire(client, checkout);
      for (const item of expired.rows) await inventoryPort.expireCheckout(client, item.id);
      const external = await client.query<{ intent: string; scope_id: string }>(`select intent.id intent,orders.scope_id from payment.intent intent
        join ordering.orderrecord orders on orders.id=intent.order_id where intent.expires_at<=clock_timestamp()
        and intent.state in('created','authorizing','authorized') and orders.payment_state in('unpaid','authorizing')
        and ($1::text is null or orders.id=$1) and exists(select 1 from payment.attempt attempt where attempt.intent_id=intent.id and attempt.provider='wechat')
        order by intent.id for update of intent,orders`, [order]);
      for (const target of external.rows) await client.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
        values($1,'paymentquery','payment',$2,jsonb_build_object('intent',$3),'queued',1,clock_timestamp(),clock_timestamp(),clock_timestamp())
        on conflict(id) do update set state='queued',available_at=clock_timestamp(),updated_at=clock_timestamp()`,
      [`job:expiry:${target.intent}`, target.scope_id, target.intent]);
      const orders = await client.query<{ id: string; scope_id: string }>(`select orders.id,orders.scope_id from ordering.orderrecord orders
        join payment.intent intent on intent.order_id=orders.id where intent.expires_at<=clock_timestamp()
        and intent.state in('created','authorizing','authorized') and orders.payment_state in('unpaid','authorizing')
        and ($1::text is null or orders.id=$1) and not exists(select 1 from payment.attempt attempt
          where attempt.intent_id=intent.id and attempt.provider='wechat') order by orders.id for update of intent,orders`, [order]);
      for (const expiredOrder of orders.rows) {
        await orderPort.cancelUnpaid(client, expiredOrder.id);
        await releaseOrderHolds(client, expiredOrder.id);
        await client.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
        values($1,'order.cancelled',1,'order',$2,$3,jsonb_build_object('order',$2,'reason','paymenttimeout'),$1,clock_timestamp(),clock_timestamp())`,
        [`event:${randomUUID()}`, expiredOrder.id, expiredOrder.scope_id]);
      }
      await paymentPort.expire(client, order);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}
