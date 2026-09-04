import { createHash } from 'node:crypto';
import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { Clock } from '../../../../foundation/domain/Clock';
import { domainEvent } from '../../../../foundation/domain/DomainEvent';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OutboxWriter } from '../../../../foundation/messaging/Outbox';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { OrderTransition } from '../../domain/policy/OrderTransition';

interface CancellationRow extends Record<string, unknown> {
  readonly id: string;
  readonly scope_id: string;
  readonly member_id: string;
  readonly lifecycle_state: 'created' | 'awaitingpayment' | 'cancelled';
  readonly payment_state: 'unpaid' | 'authorizing' | 'failed';
  readonly fulfillment_state: 'unallocated' | 'allocated' | 'cancelled';
  readonly aftersale_state: string;
  readonly cancelled_at: Date | string | null;
  readonly cancellation_event_id: string | null;
  readonly version: number;
}

export interface CancelOrderInput {
  readonly orderId: string;
  readonly memberId: string | null;
  readonly scopeIds: readonly string[];
  readonly actorId: string;
  readonly membershipId: string;
  readonly expectedVersion: number;
  readonly reason: string;
  readonly traceId: string;
}

export interface CancelOrderOutput {
  readonly orderId: string;
  readonly lifecycleState: 'cancelled';
  readonly fulfillmentState: 'cancelled';
  readonly cancelledAt: string;
  readonly version: number;
  readonly eventId: string;
  readonly repeated: boolean;
}

export class CancelOrder {
  private readonly transitions = new OrderTransition();

  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly outbox: OutboxWriter,
    private readonly clock: Clock
  ) {}

  async execute(context: WriteTransactionContext, input: CancelOrderInput): Promise<Readonly<CancelOrderOutput>> {
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) throw new DomainError('VERSION_CONFLICT');
    const database = this.transactions.database(context);
    const selected = await database.query<CancellationRow>(
      `select orders.id,orders.scope_id,orders.member_id,orders.lifecycle_state,orders.payment_state,orders.fulfillment_state,
      orders.aftersale_state,cancellation.cancelled_at,cancellation.event_id cancellation_event_id,orders.version::float8 version
      from ordering.orderrecord orders left join lateral(
        select value.cancelled_at,value.event_id from ordering.cancellation value where value.order_id=orders.id order by value.version desc limit 1
      ) cancellation on true where orders.id=$1
      and (orders.member_id=$2 or orders.scope_id=any($3::text[]) or orders.mall_id=any($3::text[])) for update of orders`,
      [input.orderId, input.memberId, input.scopeIds]
    );
    const order = selected.rows[0];
    if (!order) throw new DomainError('RESOURCE_NOT_FOUND');
    if (order.lifecycle_state === 'cancelled') return output(order, true);
    if (!['unpaid', 'authorizing', 'failed'].includes(order.payment_state) || !['unallocated', 'allocated'].includes(order.fulfillment_state) || order.aftersale_state !== 'none') {
      throw new DomainError('ORDER_NOT_CANCELLABLE');
    }
    this.transitions.lifecycle(order.lifecycle_state, 'cancelled');
    this.transitions.fulfillment(order.fulfillment_state, 'cancelled');
    if (order.version !== input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const cancelledAt = this.clock.now().toISOString();
    const eventId = `event:${createHash('sha256').update(`order.cancelled:${order.id}:${order.version + 1}`).digest('hex')}`;
    const changed = await database.query<CancellationRow>(
      `update ordering.orderrecord set lifecycle_state='cancelled',fulfillment_state='cancelled',version=version+1,updated_at=clock_timestamp()
      where id=$1 and version=$2 and lifecycle_state in('created','awaitingpayment') and payment_state in('unpaid','authorizing','failed')
      and fulfillment_state in('unallocated','allocated') and aftersale_state='none'
      returning id,scope_id,member_id,lifecycle_state,payment_state,fulfillment_state,aftersale_state,
      $3::timestamptz cancelled_at,$4::text cancellation_event_id,version::float8 version`,
      [order.id, input.expectedVersion, cancelledAt, eventId]
    );
    const cancelled = changed.rows[0];
    if (!cancelled) throw new DomainError('VERSION_CONFLICT');
    await database.query(
      `insert into ordering.cancellation(order_id,scope_id,previous_state,next_state,actor_id,membership_id,reason,event_id,cancelled_at,version)
      values($1,$2,$3,'cancelled',$4,$5,$6,$7,$8,$9)`,
      [order.id, order.scope_id, order.lifecycle_state, input.actorId, input.membershipId, input.reason, eventId, cancelledAt, cancelled.version]
    );
    await this.outbox.append(context, domainEvent({
      event: eventId,
      type: 'order.cancelled',
      version: 1,
      aggregate: { type: 'order', id: order.id, version: cancelled.version },
      tenant: order.scope_id,
      occurred: cancelledAt,
      trace: input.traceId,
      actor: input.actorId,
      correlation: input.traceId,
      causation: input.traceId,
      payloadVersion: 1,
      payload: { order: order.id, reason: input.reason },
    }));
    return output(cancelled, false);
  }
}

function output(row: CancellationRow, repeated: boolean): Readonly<CancelOrderOutput> {
  const cancelledAt = row.cancelled_at instanceof Date ? row.cancelled_at.toISOString() : row.cancelled_at;
  if (!cancelledAt || !row.cancellation_event_id) throw new Error('ORDER_CANCELLATION_EVIDENCE_MISSING');
  return Object.freeze({ orderId: row.id, lifecycleState: 'cancelled', fulfillmentState: 'cancelled', cancelledAt, version: row.version, eventId: row.cancellation_event_id, repeated });
}
