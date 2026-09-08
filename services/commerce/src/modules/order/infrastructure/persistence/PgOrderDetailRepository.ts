import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import { organizationScope } from '../../../../platform/security/OrganizationScope';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { OrganizationReadPort } from '../../../organization/public';
import type { OrderDetailRepository, OrderDetailSummary, OrderFinanceSummary } from '../../application/port/OrderDetailRepository';

export class PgOrderDetailRepository implements OrderDetailRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly organizations: Pick<OrganizationReadPort, 'descendants'>
  ) {}

  async summary(context: ReadTransactionContext, order: string, execution: ExecutionContext<'order.detail.read'>): Promise<OrderDetailSummary | null> {
    const access = requireSession(execution.security);
    const member = access.scope.kind === 'owner' || access.scope.kind === 'self';
    const partner = access.scope.kind === 'supplier' || access.scope.kind === 'store';
    const scopes = member || partner ? [] : await this.organizations.descendants(context, organizationScope(access.scope));
    const result = await this.transactions.database(context).query<OrderDetailSummary>(
      `select orders.id,orders.order_number "orderNumber",orders.scope_id "scopeId",orders.mall_id "mallId",
      orders.currency,orders.total_minor::float8 "totalMinor",orders.payment_state "paymentState",
      orders.fulfillment_state "fulfillmentState",orders.aftersale_state "aftersaleState",orders.lifecycle_state "lifecycleState",
      orders.source_channel "sourceChannel",orders.external_reference "externalOrderNo",orders.source_state "sourceState",
      orders.verification_state "verificationState",orders.ordered_at "orderedAt",
      case when jsonb_typeof(orders.address_snapshot)='object' then jsonb_build_object(
        'recipientMasked',coalesce(orders.address_snapshot->>'recipientMasked',''),
        'mobileMasked',coalesce(orders.address_snapshot->>'mobileMasked',''),
        'addressMasked',coalesce(orders.address_snapshot->>'addressMasked',''),
        'regionCode',coalesce(orders.address_snapshot->>'regionCode','')) else null end address,
      orders.received_at "receivedAt",orders.created_at "createdAt",orders.updated_at "updatedAt",orders.version::float8 version
      from ordering.orderrecord orders where orders.id=$1 and (
        ($2::boolean and orders.member_id=$3) or
        ($4::boolean and exists(select 1 from ordering.suborder value where value.order_id=orders.id and value.partner_id=$3)) or
        (not $2::boolean and not $4::boolean and orders.scope_id=any($5::text[])))`,
      [order, member, access.scope.id, partner, scopes]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }

  async products(context: ReadTransactionContext, order: string, partner: string | null) {
    const result = await this.transactions.database(context).query<Record<string, unknown>>(
      `select line.id,line.sku_id sku,line.listing_id listing,line.title_snapshot title,line.quantity::float8 quantity,
      line.unit_minor::float8 "unitMinor",line.total_minor::float8 "totalMinor",line.discount_minor::float8 "discountMinor",
      line.payable_minor::float8 "payableMinor",coalesce(nullif(line.evidence->>'productType',''),'unknown') "productType",
      coalesce(nullif(line.evidence->>'category',''),'unknown') category,line.provider,line.partner_id partner
      from ordering.line line where line.order_id=$1 and ($2::text is null or line.partner_id=$2) order by line.id`,
      [order, partner]
    );
    if (result.rows.length === 0) throw new Error('ORDER_PRODUCT_SNAPSHOT_MISSING');
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }

  async payment(context: ReadTransactionContext, order: string) {
    const result = await this.transactions.database(context).query(
      `select payment.payment_id "paymentId",payment.version::float8 version,coalesce(payment.captured_minor,0)::float8 "capturedMinor",
      coalesce(payment.refunded_minor,0)::float8 "refundedMinor",
      greatest(coalesce(payment.captured_minor,0)-coalesce(payment.refunded_minor,0),0)::float8 "refundableMinor",
      payment.updated_at "updatedAt",coalesce((select jsonb_agg(jsonb_build_object('sequence',tender.sequence,
        'kind',tender.kind,'referenceMasked',case when tender.reference_id is null then null else '尾号 '||right(tender.reference_id,4) end,
        'amountMinor',tender.amount_minor,'state',tender.state) order by tender.sequence)
        from ordering.paymenttenderread tender where tender.order_id=$1),'[]'::jsonb) tenders
      from ordering.paymentread payment where payment.order_id=$1`,
      [order]
    );
    if (!result.rows[0]) throw new Error('ORDER_PAYMENT_PROJECTION_MISSING');
    return Object.freeze(result.rows[0]);
  }

  async fulfillment(context: ReadTransactionContext, order: string, partner: string | null) {
    const result = await this.transactions.database(context).query(
      `select value.id,value.provider,value.partner_id partner,value.kind,value.state,value.version::float8 version,
      case when value.external_reference is null then null else '尾号 '||right(value.external_reference,4) end "externalReferenceMasked",
      value.created_at "createdAt",value.updated_at "updatedAt",
      coalesce((select jsonb_agg(jsonb_build_object('id',milestone.id,'kind',milestone.kind,'state',milestone.state,
        'trackingMasked',case when milestone.tracking is null then null else '尾号 '||right(milestone.tracking,4) end,
        'occurredAt',milestone.occurred_at) order by milestone.occurred_at,milestone.id)
        from ordering.fulfillmentmilestoneread milestone where milestone.fulfillment_id=value.id),'[]'::jsonb) milestones
      from ordering.fulfillmentread value where value.order_id=$1 and ($2::text is null or value.partner_id=$2)
      order by value.created_at,value.id`,
      [order, partner]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }

  async aftersale(context: ReadTransactionContext, order: string) {
    const database = this.transactions.database(context);
    const [state, refunds] = await Promise.all([
      database.query<{ state: string }>(`select aftersale_state state from ordering.orderrecord where id=$1`, [order]),
      database.query(
        `select refund.id,refund.aftersale_id "aftersaleId",refund.provider,
        '尾号 '||right(refund.provider_reference,4) "providerReferenceMasked",refund.amount_minor::float8 "amountMinor",
        refund.currency,refund.state,refund.reason,refund.created_at "createdAt",refund.updated_at "updatedAt",
        coalesce((select jsonb_agg(jsonb_build_object('sequence',tender.sequence,'kind',tender.kind,
          'referenceMasked',case when tender.reference_id is null then null else '尾号 '||right(tender.reference_id,4) end,
          'amountMinor',tender.amount_minor,'state',tender.state) order by tender.sequence)
          from ordering.refundtenderread tender where tender.refund_id=refund.id),'[]'::jsonb) tenders
        from ordering.refundread refund where refund.order_id=$1 order by refund.created_at,refund.id`,
        [order]
      ),
    ]);
    if (!state.rows[0]) throw new Error('ORDER_AFTERSALE_PROJECTION_MISSING');
    return Object.freeze({ state: state.rows[0].state, refunds: Object.freeze(refunds.rows.map((row) => Object.freeze(row))) });
  }

  async finance(context: ReadTransactionContext, order: string) {
    const result = await this.transactions.database(context).query<OrderFinanceSummary>(
      `select orders.total_minor::float8 "grossMinor",coalesce(payment.captured_minor,0)::float8 "capturedMinor",
      coalesce(payment.refunded_minor,0)::float8 "refundedMinor",
      greatest(coalesce(payment.captured_minor,0)-coalesce(payment.refunded_minor,0),0)::float8 "netMinor",
      greatest(orders.total_minor-coalesce(payment.captured_minor,0),0)::float8 "outstandingMinor",orders.currency,
      case when orders.verification_state<>'verified' then 'attention'
        when coalesce(payment.captured_minor,0)=0 then 'pending'
        when coalesce(payment.refunded_minor,0)>=coalesce(payment.captured_minor,0) then 'refunded'
        when coalesce(payment.refunded_minor,0)>0 then 'partialrefund'
        when payment.captured_minor=orders.total_minor then 'balanced' else 'attention' end state,
      orders.verification_state "verificationState",
      greatest(payment.updated_at,coalesce((select max(refund.updated_at) from ordering.refundread refund where refund.order_id=orders.id),payment.updated_at)) watermark
      from ordering.orderrecord orders join ordering.paymentread payment on payment.order_id=orders.id where orders.id=$1`,
      [order]
    );
    if (!result.rows[0]) throw new Error('ORDER_FINANCE_PROJECTION_MISSING');
    return Object.freeze(result.rows[0]);
  }
}
