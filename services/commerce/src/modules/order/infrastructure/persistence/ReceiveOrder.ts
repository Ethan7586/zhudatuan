import { createHash } from 'node:crypto';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { OutboxWriter } from '../../../../platform/messaging/Outbox';
import { domainEvent } from '@shop/kernel';
import type { Clock } from '@shop/kernel';
import type { CommerceState, FulfillmentState, PaymentState } from '../../domain/model/Order';
import { ReceiptPolicy } from '../../domain/policy/ReceiptPolicy';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ReceiveOrderInput, ReceiveOrderOutput } from '../../public/OrderReceiptPort';

interface ReceiptRow extends Record<string, unknown> {
  readonly id: string;
  readonly scope_id: string;
  readonly member_id: string;
  readonly lifecycle_state: CommerceState;
  readonly payment_state: PaymentState;
  readonly fulfillment_state: FulfillmentState;
  readonly received_at: Date | string | null;
  readonly receipt_event_id: string | null;
  readonly version: number;
}

export class ReceiveOrder {
  private readonly policy = new ReceiptPolicy();

  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly outbox: OutboxWriter,
    private readonly clock: Clock
  ) {}

  async execute(context: WriteTransactionContext, input: ReceiveOrderInput): Promise<Readonly<ReceiveOrderOutput>> {
    const transaction = this.transactions.database(context);
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) throw new DomainError('VERSION_CONFLICT');
    const selected = await transaction.query<ReceiptRow>(
      `select id,scope_id,member_id,lifecycle_state,payment_state,fulfillment_state,received_at,receipt_event_id,version
      from ordering.orderrecord where id=$1
      and (member_id=$2 or scope_id=any($3::text[]) or mall_id=any($3::text[])) for update`,
      [input.orderId, input.memberId, input.scopeIds]
    );
    const order = selected.rows[0];
    if (!order) throw new DomainError('RESOURCE_NOT_FOUND');
    if (order.fulfillment_state === 'received') {
      if (!order.received_at || !order.receipt_event_id) throw new Error('ORDER_RECEIPT_EVIDENCE_MISSING');
      return output(order, true);
    }
    this.policy.assert({ commerce: order.lifecycle_state, payment: order.payment_state, fulfillment: order.fulfillment_state });
    if (order.version !== input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const receivedAt = input.receivedAt ?? this.clock.now().toISOString();
    if (Number.isNaN(Date.parse(receivedAt)) || Date.parse(receivedAt) > this.clock.now().getTime() + 60_000) throw new DomainError('VALIDATION_FAILED', { field: 'receivedAt' });
    const eventId = `event:${createHash('sha256')
      .update(`order.received:${order.id}:${order.version + 1}`)
      .digest('hex')}`;
    const changed = await transaction.query<ReceiptRow>(
      `update ordering.orderrecord set fulfillment_state='received',lifecycle_state='received',received_at=$2,
      receipt_event_id=$3,version=version+1,updated_at=clock_timestamp() where id=$1 and version=$4
      returning id,scope_id,member_id,lifecycle_state,payment_state,fulfillment_state,received_at,receipt_event_id,version`,
      [order.id, receivedAt, eventId, input.expectedVersion]
    );
    const received = changed.rows[0];
    if (!received) throw new DomainError('VERSION_CONFLICT');
    await this.outbox.append(
      context,
      domainEvent({
        event: eventId,
        type: 'order.received',
        version: 1,
        aggregate: { type: 'order', id: order.id, version: received.version },
        tenant: order.scope_id,
        occurred: receivedAt,
        trace: input.traceId,
        actor: input.actorId,
        correlation: input.traceId,
        causation: input.traceId,
        payloadVersion: 1,
        payload: { orderId: order.id, receivedAt, fulfillmentState: 'received' },
      })
    );
    await transaction.query(
      `insert into ordering.receipt(order_id,scope_id,previous_state,next_state,actor_id,membership_id,reason,event_id,received_at,version)
      values($1,$2,$3,'received',$4,$5,$6,$7,$8,$9)`,
      [order.id, order.scope_id, order.fulfillment_state, input.actorId, input.membershipId, input.reason, eventId, receivedAt, received.version]
    );
    return output(received, false);
  }
}

function output(row: ReceiptRow, repeated: boolean): Readonly<ReceiveOrderOutput> {
  const receivedAt = row.received_at instanceof Date ? row.received_at.toISOString() : row.received_at;
  if (!receivedAt || !row.receipt_event_id) throw new Error('ORDER_RECEIPT_EVIDENCE_MISSING');
  return Object.freeze({ orderId: row.id, fulfillmentState: 'received', receivedAt, version: row.version, eventId: row.receipt_event_id, repeated });
}
