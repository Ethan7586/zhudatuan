import { PgTransactionAccess, type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { randomUUID } from 'node:crypto';
import type { OperationId, OperationInputFor } from '@shop/contract';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import { requestProjectionExport } from '../../../../platform/database/PgProjectionExport';
import type { OperationRequest } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { SystemClock } from '@shop/kernel';
import { bodyRecord, keysetResult, queryPage, textField } from '../../../../pipeline/Validation';
import type { OutboxWriter } from '../../../../platform/messaging/Outbox';
import { organizationScope } from '../../../../platform/security/OrganizationScope';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { OrganizationReadPort } from '../../../organization/public';
import type { ExportRepository } from '../../application/port/ExportRepository';
import type { OrderRepository } from '../../application/port/OrderRepository';
import type { ReminderRepository } from '../../application/port/ReminderRepository';
import { OrderReadFilter } from '../../application/model/OrderReadFilter';
import { ReceiveOrder } from './ReceiveOrder';
import { CancelOrder } from './CancelOrder';
import { ORDER_READ_FILTER_SQL, orderExceptionSql, orderReadFilterValues } from './OrderReadSql';
import type { MemberReadPort } from '../../../member/public';
import { emptyOrderFacets, orderRequest } from './OrderRequest';
import { orderTime } from '../../application/model/OrderTime';
import { orderProjection } from './OrderProjection';
import { OrderLabels } from '../../application/service/OrderLabels';
import type { CatalogPartnerPort } from '../../../partner/public';
import type { OrderMedia } from '../../application/service/OrderMedia';
export class PgOrderRepository implements OrderRepository, ReminderRepository, ExportRepository {
  private readonly receiver: ReceiveOrder;
  private readonly canceller: CancelOrder;
  private readonly labels: OrderLabels;
  constructor(
    private readonly transactions: PgTransactionAccess,
    outbox: OutboxWriter,
    private readonly organizations: Pick<OrganizationReadPort, 'descendants' | 'scope' | 'summaries'>,
    private readonly members: Pick<MemberReadPort, 'search' | 'profiles' | 'principals'>,
    partners: Pick<CatalogPartnerPort, 'names'>,
    private readonly media: Pick<OrderMedia, 'orders'>
  ) {
    this.receiver = new ReceiveOrder(transactions, outbox, new SystemClock());
    this.canceller = new CancelOrder(transactions, outbox, new SystemClock());
    this.labels = new OrderLabels(members, organizations, partners);
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
    const memberIds = filter.member ? await this.members.search(context, filter.member) : [];
    if (filter.member && memberIds.length === 0) return { status: 200, body: { items: [], count: 0, facets: emptyOrderFacets() } } as never;
    const [result, facets] = await Promise.all([
      database.query(
        `select orders.id,orders.order_number,orders.scope_id,orders.member_id,orders.mall_id,
      orders.checkout_id,orders.currency,orders.total_minor::float8 total_minor,orders.payment_state,orders.fulfillment_state,orders.aftersale_state,
      orders.lifecycle_state,
      case when jsonb_typeof(orders.address_snapshot)='object' and orders.address_snapshot?'recipientMasked'
        then jsonb_build_object('recipientMasked',coalesce(orders.address_snapshot->>'recipientMasked',''),
          'mobileMasked',coalesce(orders.address_snapshot->>'mobileMasked',''),
          'addressMasked',coalesce(orders.address_snapshot->>'addressMasked',''),
          'regionCode',coalesce(orders.address_snapshot->>'regionCode','')) else null end address,
      jsonb_build_object('paymentId',payment.payment_id,'version',coalesce(payment.version,0),'capturedMinor',coalesce(payment.captured_minor,0),
        'refundedMinor',coalesce(payment.refunded_minor,0),
        'refundableMinor',greatest(coalesce(payment.captured_minor,0)-coalesce(payment.refunded_minor,0),0),
        'updatedAt',payment.updated_at,
        'tenders',coalesce(payment.tenders,'[]'::jsonb)) payment,
      coalesce((select jsonb_agg(jsonb_build_object('id',fulfillment.id,'provider',fulfillment.provider,
        'partner',fulfillment.partner_id,'kind',fulfillment.kind,'state',fulfillment.state,
        'version',fulfillment.version,
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
      'quantity',line.quantity::float8,'unitMinor',line.unit_minor::float8,'totalMinor',line.total_minor::float8,'discountMinor',line.discount_minor::float8,
      'payableMinor',line.payable_minor::float8,'productType',coalesce(nullif(line.evidence->>'productType',''),'unknown'),
      'category',coalesce(nullif(line.evidence->>'category',''),'unknown'),'provider',line.provider,'partner',line.partner_id,
      'imageReference',nullif(line.evidence->>'imageReference',''),'imageUrl',nullif(line.evidence->>'imageUrl','')))
      filter(where line.id is not null),'[]') lines
      from ordering.orderrecord orders left join ordering.line line on line.order_id=orders.id
      left join lateral(select detail.payment_id,detail.version,detail.captured_minor,detail.refunded_minor,detail.updated_at,
        coalesce((select jsonb_agg(jsonb_build_object('sequence',tender.sequence,'kind',tender.kind,
          'referenceMasked',case when tender.reference_id is null then null else '尾号 '||right(tender.reference_id,4) end,
          'amountMinor',tender.amount_minor,'state',tender.state) order by tender.sequence)
          from ordering.paymenttenderread tender where tender.order_id=orders.id),'[]'::jsonb) tenders
        from ordering.paymentread detail where detail.order_id=orders.id) payment on true where (
      ($1::boolean and orders.member_id=$2) or (($3 or $4) and exists(select 1 from ordering.suborder where order_id=orders.id and partner_id=$2))
      or (not $1::boolean and not $3 and not $4 and orders.scope_id=any($5::text[]))
      ) ${ORDER_READ_FILTER_SQL}
      and ($22::timestamptz is null or (orders.created_at,orders.id)<($22::timestamptz,$23))
      group by orders.id,payment.payment_id,payment.version,payment.captured_minor,payment.refunded_minor,payment.updated_at,payment.tenders
      order by orders.created_at desc,orders.id desc limit $24`,
        [owner, access.scope.id, supplier, store, scopes, ...orderReadFilterValues(filter, timezone, memberIds), page.sort, page.id, page.fetch]
      ),
      orderFacets(database, [owner, access.scope.id, supplier, store, scopes, ...orderReadFilterValues(filter, timezone, memberIds, 'all')], execution.signal),
    ]);
    const projected = result.rows.map((row) => orderProjection(row));
    const labeled = await this.labels.list(context, access.scope.id, supplier || store, projected);
    const rows = await this.media.orders(labeled);
    const pageResult = keysetResult({ rows }, page, 'created_at');
    const body = pageResult.body as Readonly<Record<string, unknown>>;
    return { ...pageResult, body: Object.freeze({ ...body, facets }) } as never;
  }
  async schedule(context: WriteTransactionContext, input: OperationInputFor<'order.reminders.create'>, execution: ExecutionContext<'order.reminders.create'>) {
    const access = requireSession(execution.security);
    const database = this.transactions.database(context);
    const member = access.scope.kind === 'owner' || access.scope.kind === 'self';
    const supplier = access.scope.kind === 'supplier';
    const store = access.scope.kind === 'store';
    const scopes = member || supplier || store ? [] : await this.organizations.descendants(context, organizationScope(access.scope));
    const result = await database.query(
      `insert into ordering.reminder(id,order_id,member_id,kind,state,created_at)
      select $1,orders.id,orders.member_id,'fulfillment','queued',clock_timestamp() from ordering.orderrecord orders
      where orders.id=$2 and (($4::boolean and orders.member_id=$3)
        or (($5::boolean or $6::boolean) and exists(select 1 from ordering.suborder where order_id=orders.id and partner_id=$3))
        or (not $4::boolean and not $5::boolean and not $6::boolean and orders.scope_id=any($7::text[])))
        and orders.lifecycle_state in('paid','fulfilling','shipped') and orders.fulfillment_state not in('received','cancelled','returned')
        and not exists(select 1 from ordering.reminder prior where prior.order_id=orders.id and prior.created_at>clock_timestamp()-interval '30 minutes')
      returning *`,
      [`reminder:${randomUUID()}`, input.path.orderid, access.scope.id, member, supplier, store, scopes]
    );
    const reminder = result.rows[0] as
      | {
          id?: string;
        }
      | undefined;
    if (!reminder?.id) throw new DomainError('ORDER_REMINDER_NOT_ALLOWED');
    await new PgRuntimeWriter(database).schedule({ id: `job:${reminder.id}`, kind: 'notification', owner: 'order', scope: access.scope.id, payload: { reminder: reminder.id, order: input.path.orderid }, priority: 20 });
    return { status: 202, body: orderProjection(reminder) } as never;
  }
  async create(context: WriteTransactionContext, input: OperationInputFor<'order.orders.export'>, execution: ExecutionContext<'order.orders.export'>) {
    const access = requireSession(execution.security);
    const filter = OrderReadFilter.from(input);
    const visible = filter.snapshot();
    const memberIds = filter.member ? await this.members.search(context, filter.member) : [];
    const timezone = filter.placed === 'today' ? (await this.organizations.scope(context, access.organization)).timezone : 'UTC';
    const operational = { ...visible, timezone, ...(filter.member ? { memberIds } : {}) } as Record<string, unknown>;
    delete operational.member;
    const result = await requestProjectionExport(orderRequest('order.orders.export', input, execution), this.transactions.database(context), 'orders', operational, visible);
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
  async cancel(context: WriteTransactionContext, input: OperationInputFor<'order.orders.cancel'>, execution: ExecutionContext<'order.orders.cancel'>) {
    const access = requireSession(execution.security);
    const body = bodyRecord(input);
    const bodyVersion = body.expectedVersion;
    if (!Number.isSafeInteger(bodyVersion) || bodyVersion !== execution.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const member = ['owner', 'self'].includes(access.scope.kind);
    const scopeIds = member ? [] : await this.organizations.descendants(context, organizationScope(access.scope));
    const result = await this.canceller.execute(context, {
      orderId: input.path.orderid,
      memberId: member ? access.scope.id : null,
      scopeIds,
      actorId: access.actor.id,
      membershipId: access.membership.id,
      expectedVersion: bodyVersion as number,
      reason: textField(body, 'reason', 1000),
      traceId: access.trace,
    });
    return { status: 200, body: result } as never;
  }
}

async function orderFacets(database: SqlExecutor, values: readonly unknown[], signal: AbortSignal) {
  try {
    const result = await database.query<{
      all: number;
      unpaid: number;
      unshipped: number;
      active: number;
      completed: number;
      aftersale: number;
      exception: number;
      orderWatermark: Date | null;
      paymentWatermark: Date | null;
      fulfillmentWatermark: Date | null;
      aftersaleWatermark: Date | null;
      refundWatermark: Date | null;
    }>(
      `with visible as materialized (
        select orders.id,orders.updated_at,orders.payment_state,orders.fulfillment_state,orders.aftersale_state,
          orders.lifecycle_state,orders.verification_state
        from ordering.orderrecord orders where (
          ($1::boolean and orders.member_id=$2) or (($3 or $4) and exists(select 1 from ordering.suborder where order_id=orders.id and partner_id=$2))
          or (not $1::boolean and not $3 and not $4 and orders.scope_id=any($5::text[]))
        ) ${ORDER_READ_FILTER_SQL}
      )
      select count(*)::float8 all,
        count(*) filter(where payment_state in('unpaid','authorizing'))::float8 unpaid,
        count(*) filter(where payment_state in('paid','partially_refunded') and fulfillment_state in('unallocated','allocated'))::float8 unshipped,
        count(*) filter(where lifecycle_state<>'cancelled' and fulfillment_state in('processing','shipped','delivered'))::float8 active,
        count(*) filter(where lifecycle_state='completed')::float8 completed,
        count(*) filter(where aftersale_state<>'none')::float8 aftersale,
        count(*) filter(where ${orderExceptionSql('visible')})::float8 exception,
        max(updated_at) "orderWatermark",
        (select max(payment.updated_at) from ordering.paymentread payment join visible on visible.id=payment.order_id) "paymentWatermark",
        (select max(fulfillment.updated_at) from ordering.fulfillmentread fulfillment join visible on visible.id=fulfillment.order_id) "fulfillmentWatermark",
        (select max(aftersale.updated_at) from ordering.aftersale aftersale join visible on visible.id=aftersale.order_id) "aftersaleWatermark",
        (select max(refund.updated_at) from ordering.refundread refund join visible on visible.id=refund.order_id) "refundWatermark"
      from visible`,
      values
    );
    const row = result.rows[0];
    if (!row) throw new Error('ORDER_FACET_PROJECTION_MISSING');
    return Object.freeze({
      state: 'ready' as const,
      data: Object.freeze({
        counts: Object.freeze({ all: row.all, unpaid: row.unpaid, unshipped: row.unshipped, active: row.active, completed: row.completed, aftersale: row.aftersale, exception: row.exception }),
        watermarks: Object.freeze({
          order: orderTime(row.orderWatermark),
          payment: orderTime(row.paymentWatermark),
          fulfillment: orderTime(row.fulfillmentWatermark),
          aftersale: orderTime(row.aftersaleWatermark),
          refund: orderTime(row.refundWatermark),
        }),
      }),
    });
  } catch (cause) {
    if (signal.aborted) throw signal.reason ?? cause;
    return Object.freeze({ state: 'unavailable' as const, error: Object.freeze({ code: 'ORDER_FACET_UNAVAILABLE', message: '订单状态统计与数据水位暂时不可用，列表仍可继续使用。', retryable: true }) });
  }
}
