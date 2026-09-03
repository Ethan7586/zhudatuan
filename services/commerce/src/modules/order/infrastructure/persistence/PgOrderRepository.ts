import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { randomUUID } from 'node:crypto';
import type { OperationId, OperationInputFor } from '@shop/contract';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import { requestProjectionExport } from '../../../../adapter/database/PgProjectionExport';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { SystemClock } from '../../../../foundation/domain/Clock';
import { bodyRecord, keysetResult, queryPage, textField } from '../../../../foundation/interface/Validation';
import type { OutboxWriter } from '../../../../foundation/messaging/Outbox';
import { organizationScope } from '../../../../foundation/security/OrganizationScope';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { OrganizationReadPort } from '../../../organization/public';
import type { ExportRepository } from '../../application/port/ExportRepository';
import type { OrderRepository } from '../../application/port/OrderRepository';
import type { ReminderRepository } from '../../application/port/ReminderRepository';
import { OrderReadFilter } from '../../application/model/OrderReadFilter';
import { ReceiveOrder } from './ReceiveOrder';
import { ORDER_READ_FILTER_SQL, orderReadFilterValues } from './OrderReadSql';
export class PgOrderRepository implements OrderRepository, ReminderRepository, ExportRepository {
  private readonly receiver: ReceiveOrder;
  constructor(
    private readonly transactions: PgTransactionAccess,
    outbox: OutboxWriter,
    private readonly organizations: Pick<OrganizationReadPort, 'descendants' | 'scope'>
  ) {
    this.receiver = new ReceiveOrder(transactions, outbox, SystemClock);
  }
  async read(context: ReadTransactionContext, input: OperationInputFor<'order.orders.read'>, execution: ExecutionContext<'order.orders.read'>) {
    const access = requireSession(execution.security);
    const owner = access.scope.kind === 'owner';
    const supplier = access.scope.kind === 'supplier';
    const store = access.scope.kind === 'store';
    const filter = OrderReadFilter.from(input);
    const page = queryPage(input);
    const database = this.transactions.database(context);
    const scopes = owner || supplier || store ? [] : await this.organizations.descendants(context, organizationScope(access.scope));
    const timezone = filter.placed === 'today' ? (await this.organizations.scope(context, access.organization)).timezone : 'UTC';
    const result = await database.query(
      `select orders.id,orders.order_number,orders.scope_id,orders.member_id,orders.mall_id,
      orders.checkout_id,orders.currency,orders.total_minor,orders.payment_state,orders.fulfillment_state,orders.aftersale_state,
      orders.lifecycle_state,
      case when jsonb_typeof(orders.address_snapshot)='object' and orders.address_snapshot?'recipientMasked'
        then jsonb_build_object('recipientMasked',coalesce(orders.address_snapshot->>'recipientMasked',''),
          'mobileMasked',coalesce(orders.address_snapshot->>'mobileMasked',''),
          'addressMasked',coalesce(orders.address_snapshot->>'addressMasked',''),
          'regionCode',coalesce(orders.address_snapshot->>'regionCode','')) else null end address,
      jsonb_build_object('paymentId',payment.payment_id,'capturedMinor',coalesce(payment.captured_minor,0),
        'refundedMinor',coalesce(payment.refunded_minor,0),
        'refundableMinor',greatest(coalesce(payment.captured_minor,0)-coalesce(payment.refunded_minor,0),0),
        'updatedAt',payment.updated_at,
        'tenders',coalesce(payment.tenders,'[]'::jsonb)) payment,
      coalesce((select jsonb_agg(jsonb_build_object('id',fulfillment.id,'provider',fulfillment.provider,
        'partner',fulfillment.partner_id,'kind',fulfillment.kind,'state',fulfillment.state,
        'externalReferenceMasked',case when fulfillment.external_reference is null then null else '尾号 '||right(fulfillment.external_reference,4) end,
        'createdAt',fulfillment.created_at,'updatedAt',fulfillment.updated_at,
        'milestones',coalesce((select jsonb_agg(jsonb_build_object('id',milestone.id,'kind',milestone.kind,
          'state',milestone.state,'trackingMasked',case when milestone.tracking is null then null else '尾号 '||right(milestone.tracking,4) end,
          'occurredAt',milestone.occurred_at) order by milestone.occurred_at,milestone.id)
          from ordering.fulfillmentmilestoneread milestone where milestone.fulfillment_id=fulfillment.id),'[]'::jsonb))
        order by fulfillment.created_at,fulfillment.id) from ordering.fulfillmentread fulfillment where fulfillment.order_id=orders.id),'[]'::jsonb) fulfillments,
      coalesce((select jsonb_agg(jsonb_build_object('id',refund.id,'aftersaleId',refund.aftersale_id,
        'provider',refund.provider,'providerReferenceMasked','尾号 '||right(refund.provider_reference,4),
        'amountMinor',refund.amount_minor,'currency',refund.currency,'state',refund.state,'reason',refund.reason,
        'createdAt',refund.created_at,'updatedAt',refund.updated_at,
        'tenders',coalesce((select jsonb_agg(jsonb_build_object('sequence',tender.sequence,'kind',tender.kind,
          'referenceMasked',case when tender.reference_id is null then null else '尾号 '||right(tender.reference_id,4) end,
          'amountMinor',tender.amount_minor,'state',tender.state) order by tender.sequence)
          from ordering.refundtenderread tender where tender.refund_id=refund.id),'[]'::jsonb))
        order by refund.created_at,refund.id) from ordering.refundread refund where refund.order_id=orders.id),'[]'::jsonb) refunds,
      '[]'::jsonb timeline,orders.received_at "receivedAt",orders.created_at,orders.updated_at,orders.version,
      coalesce(jsonb_agg(jsonb_build_object('id',line.id,'sku',line.sku_id,'listing',line.listing_id,'title',line.title_snapshot,
      'quantity',line.quantity,'unitMinor',line.unit_minor,'totalMinor',line.total_minor,'discountMinor',line.discount_minor,
      'payableMinor',line.payable_minor,'productType',coalesce(nullif(line.evidence->>'productType',''),'unknown'),
      'category',coalesce(nullif(line.evidence->>'category',''),'unknown'),'provider',line.provider,'partner',line.partner_id))
      filter(where line.id is not null),'[]') lines
      from ordering.orderrecord orders left join ordering.line line on line.order_id=orders.id
      left join lateral(select detail.payment_id,detail.captured_minor,detail.refunded_minor,detail.updated_at,
        coalesce((select jsonb_agg(jsonb_build_object('sequence',tender.sequence,'kind',tender.kind,
          'referenceMasked',case when tender.reference_id is null then null else '尾号 '||right(tender.reference_id,4) end,
          'amountMinor',tender.amount_minor,'state',tender.state) order by tender.sequence)
          from ordering.paymenttenderread tender where tender.order_id=orders.id),'[]'::jsonb) tenders
        from ordering.paymentread detail where detail.order_id=orders.id) payment on true where (
      ($1::boolean and orders.member_id=$2) or (($3 or $4) and exists(select 1 from ordering.suborder where order_id=orders.id and partner_id=$2))
      or (not $1::boolean and not $3 and not $4 and orders.scope_id=any($5::text[]))
      ) ${ORDER_READ_FILTER_SQL}
      and ($14::timestamptz is null or (orders.created_at,orders.id)<($14::timestamptz,$15))
      group by orders.id,payment.payment_id,payment.captured_minor,payment.refunded_minor,payment.updated_at,payment.tenders
      order by orders.created_at desc,orders.id desc limit $16`,
      [owner, access.scope.id, supplier, store, scopes, ...orderReadFilterValues(filter, timezone), page.sort, page.id, page.fetch]
    );
    return keysetResult(result, page, 'created_at') as never;
  }
  async schedule(context: WriteTransactionContext, input: OperationInputFor<'order.reminders.create'>, execution: ExecutionContext<'order.reminders.create'>) {
    const access = requireSession(execution.security);
    const database = this.transactions.database(context);
    const result = await database.query(
      `insert into ordering.reminder(id,order_id,member_id,kind,state,created_at)
      select $1,orders.id,orders.member_id,'fulfillment','queued',clock_timestamp() from ordering.orderrecord orders
      where orders.id=$2 and orders.member_id=$3 and orders.lifecycle_state in('paid','fulfilling','shipped','received','completed')
        and not exists(select 1 from ordering.reminder prior where prior.order_id=orders.id and prior.created_at>clock_timestamp()-interval '30 minutes')
      returning *`,
      [`reminder:${randomUUID()}`, input.path.orderid, access.scope.id]
    );
    const reminder = result.rows[0] as
      | {
          id?: string;
        }
      | undefined;
    if (!reminder?.id) throw new Error('ORDER_REMINDER_NOT_ALLOWED_OR_RATE_LIMITED');
    await new PgRuntimeWriter(database).schedule({ id: `job:${reminder.id}`, kind: 'notification', owner: 'order', scope: access.scope.id, payload: { reminder: reminder.id, order: input.path.orderid }, priority: 20 });
    return { status: 202, body: Object.freeze({ ...reminder }) } as never;
  }
  async create(context: WriteTransactionContext, input: OperationInputFor<'order.orders.export'>, execution: ExecutionContext<'order.orders.export'>) {
    const database = this.transactions.database(context);
    const result = await requestProjectionExport(orderRequest('order.orders.export', input, execution), this.transactions.database(context), 'orders', bodyRecord(input));
    return { status: 202, body: result } as never;
  }
  async receive(context: WriteTransactionContext, input: OperationInputFor<'order.orders.receive'>, execution: ExecutionContext<'order.orders.receive'>) {
    const access = requireSession(execution.security);
    const body = bodyRecord(input);
    const bodyVersion = body.expectedVersion;
    if (!Number.isSafeInteger(bodyVersion) || bodyVersion !== execution.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const member = ['owner', 'self'].includes(access.scope.kind);
    const database = this.transactions.database(context);
    const scopeIds = member ? [] : await this.organizations.descendants(context, organizationScope(access.scope));
    const result = await this.receiver.execute(context, {
      orderId: input.path.orderid,
      scopeId: access.scope.id,
      scopeIds,
      actorId: access.actor.id,
      membershipId: access.membership.id,
      memberId: member ? access.scope.id : null,
      expectedVersion: bodyVersion as number,
      receivedAt: body.receivedAt === undefined ? null : textField(body, 'receivedAt'),
      reason: body.reason === undefined ? null : textField(body, 'reason', 1000),
      traceId: access.trace,
    });
    return { status: 200, body: result } as never;
  }
}
export function orderRequest<TKey extends OperationId>(type: TKey, input: OperationInputFor<TKey>, execution: ExecutionContext<TKey>): OperationRequest {
  const wire = input as Readonly<{
    path?: Readonly<Record<string, string>>;
    query?: Readonly<Record<string, string | readonly string[]>>;
    body?: unknown;
  }>;
  return {
    type,
    input: {
      path: wire.path ?? {},
      query: wire.query ?? {},
      headers: execution.headers,
      body: wire.body,
      rawBody: execution.rawBody,
      deadline: execution.deadline,
      signal: execution.signal,
      ...(execution.publicActor === undefined ? {} : { publicActor: execution.publicActor }),
      ...(execution.idempotencyKey === undefined ? {} : { idempotency: execution.idempotencyKey }),
      ...(execution.expectedVersion === undefined ? {} : { expectedVersion: execution.expectedVersion }),
    },
    security: execution.security,
  };
}
