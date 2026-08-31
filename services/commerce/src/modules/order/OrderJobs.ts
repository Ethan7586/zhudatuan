import { randomUUID } from 'node:crypto';
import type { ClaimedJob, JobProcessor } from '../../foundation/application/JobRunner';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import type { OrderExpiryPaymentPort, PaymentHoldReleasePort } from '../payment/public/index';
import type { OrderExpiryCheckoutPort } from '../checkout/public/index';
import type { OrderExpiryInventoryPort } from '../inventory/public/index';
import type { OrderExpiryPort } from './public/index';

export interface OrderExpiryDependencies {
  readonly payments: OrderExpiryPaymentPort;
  readonly checkouts: OrderExpiryCheckoutPort;
  readonly inventory: OrderExpiryInventoryPort;
  readonly orders: OrderExpiryPort;
  readonly holds: PaymentHoldReleasePort;
}

export class OrderExpiryJobProcessor implements JobProcessor {
  constructor(
    private readonly pool: DatabasePool,
    private readonly dependencies: OrderExpiryDependencies
  ) {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'orderexpiry') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    const checkout = typeof payload.checkout === 'string' ? payload.checkout : null;
    const order = typeof payload.order === 'string' ? payload.order : null;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const expired = await this.dependencies.checkouts.expire(client, checkout);
      for (const item of expired.rows) await this.dependencies.inventory.expireCheckout(client, item.id);
      const expirations = await this.dependencies.payments.expirations(client, order);
      const orders = await this.dependencies.orders.expirable(client, [...new Set(expirations.map((target) => target.order))]);
      const allowed = new Map(orders.map((target) => [target.id, target]));
      for (const target of expirations.filter(({ external, order: id }) => external && allowed.has(id)))
        await client.query(
          `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
        values($1,'paymentquery','payment',$2,jsonb_build_object('intent',$3),'queued',1,clock_timestamp(),clock_timestamp(),clock_timestamp())
        on conflict(id) do update set state='queued',available_at=clock_timestamp(),updated_at=clock_timestamp()`,
          [`job:expiry:${target.intent}`, allowed.get(target.order)!.scope, target.intent]
        );
      const internal = new Set(expirations.filter(({ external, order: id }) => !external && allowed.has(id)).map(({ order: id }) => id));
      for (const id of [...internal].sort()) {
        const expiredOrder = allowed.get(id)!;
        await this.dependencies.orders.cancelUnpaid(client, expiredOrder.id);
        await this.dependencies.holds.release(client, expiredOrder.id);
        await client.query(
          `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
        values($1,'order.cancelled',1,'order',$2,$3,jsonb_build_object('order',$2::text,'reason','paymenttimeout'),$1,clock_timestamp(),clock_timestamp())`,
          [`event:${randomUUID()}`, expiredOrder.id, expiredOrder.scope]
        );
      }
      await this.dependencies.payments.expire(client, order);
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}
