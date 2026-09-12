import { Money } from '@shop/kernel';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { PaymentReference } from '../../02_domain_yewu/models_moxing/PaymentReference';
import { AllocationPolicy } from '../../02_domain_yewu/policies_guize/AllocationPolicy';

export interface RefundRequest {
  readonly id: string;
  readonly payment: string;
  readonly amountMinor: number;
  readonly idempotency: string;
  readonly reason: string;
  readonly mall: string;
  readonly aftersale?: string;
  readonly supplier?: Readonly<{ orderLine: string; supplierLeg: string; transaction: string; correlation: string; route: string;
    routeVersion: number; supplier: string; linePayableMinor: number }>;
}

export interface PlannedRefund {
  readonly id: string;
  readonly payment_id: string;
  readonly provider: string;
  readonly provider_reference: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly state: string;
  readonly reason: string;
  readonly aftersale_id: string | null;
}

interface PaymentRow {
  readonly intent_id: string;
  readonly currency: string;
  readonly captured_minor: number;
}

interface TenderRow {
  readonly sequence: number;
  readonly kind: 'wechat' | 'benefit' | 'voucher';
  readonly reference_id: string | null;
  readonly amount_minor: number;
  readonly refunded_minor: number;
}

interface RefundedRow { readonly kind: TenderRow['kind']; readonly reference_id: string | null; readonly amount_minor: number }

export class RefundPlanner {
  constructor(private readonly allocation = new AllocationPolicy()) {}

  async create(database: OperationDatabase, request: RefundRequest): Promise<PlannedRefund> {
    const payment = (await database.query<PaymentRow>(`select payment.intent_id,payment.currency,
      payment.captured_minor::float8 captured_minor from payment.payment payment
      where payment.mall_id=$1 and payment.id=$2 for update of payment`, [request.mall, request.payment])).rows[0];
    if (!payment) throw new Error('PAYMENT_NOT_REFUNDABLE');
    if (payment.currency !== 'CNY') throw new Error('PAYMENT_CURRENCY_UNSUPPORTED');
    const existing = (await database.query<PlannedRefund>(`select id,payment_id,provider,provider_reference,amount_minor::float8 amount_minor,
      currency,state,reason,aftersale_id from payment.refund where mall_id=$1 and payment_id=$2 and idempotency_key=$3`,
    [request.mall, request.payment, request.idempotency])).rows[0];
    if (existing) {
      if (existing.amount_minor !== request.amountMinor || existing.reason !== request.reason || existing.aftersale_id !== (request.aftersale ?? null)) {
        throw new Error('PAYMENT_REFUND_IDEMPOTENCY_CONFLICT');
      }
      return existing;
    }
    const plans = (await database.query<Omit<TenderRow, 'refunded_minor'>>(`select sequence,kind,reference_id,amount_minor::float8 amount_minor
      from payment.intenttender where mall_id=$1 and intent_id=$2 and state='captured' order by sequence for update`,
    [request.mall, payment.intent_id])).rows;
    const refunded = (await database.query<RefundedRow>(`select leg.kind,leg.reference_id,sum(leg.amount_minor)::float8 amount_minor
      from payment.refund refund join payment.refundtender leg on leg.mall_id=refund.mall_id and leg.refund_id=refund.id
      where refund.mall_id=$1 and refund.payment_id=$2 and refund.state not in('failed','cancelled')
      group by leg.kind,leg.reference_id`, [request.mall, request.payment])).rows;
    const claimed = new Map(refunded.map((row) => [key(row.kind, row.reference_id), row.amount_minor]));
    const tenders: readonly TenderRow[] = plans.map((plan) => ({ ...plan, refunded_minor: claimed.get(key(plan.kind, plan.reference_id)) ?? 0 }));
    if (tenders.length === 0 || tenders.reduce((sum, tender) => sum + tender.amount_minor, 0) !== payment.captured_minor) {
      throw new Error('PAYMENT_TENDER_CAPTURE_INTEGRITY_FAILED');
    }
    const keyed = new Map(tenders.map((tender) => [key(tender.kind, tender.reference_id), tender]));
    const allocation = this.allocation.allocateRefund(tenders.map((tender) => ({ tender: key(tender.kind, tender.reference_id),
      amount: Money.of(tender.amount_minor, 'CNY'), refundable: Money.of(tender.amount_minor - tender.refunded_minor, 'CNY') })),
    Money.of(request.amountMinor, 'CNY'));
    const legs = allocation.map(({ tender, amount }, index) => {
      const source = keyed.get(tender);
      if (!source) throw new Error('PAYMENT_TENDER_PLAN_INVALID');
      return Object.freeze({ sequence: index + 1, kind: source.kind, reference: source.reference_id, amount: amount.minor });
    });
    const external = legs.some(({ kind }) => kind === 'wechat');
    const internal = legs.some(({ kind }) => kind !== 'wechat');
    const provider = external && internal ? 'mixed' : external ? 'wechat' : 'internal';
    const inserted = await database.query<PlannedRefund>(`insert into payment.refund(id,mall_id,payment_id,provider,provider_reference,idempotency_key,
      amount_minor,currency,state,reason,aftersale_id,version) values($1,$2,$3,$4,$5,$6,$7,$8,'requested',$9,$10,0)
      returning id,payment_id,provider,provider_reference,amount_minor::float8 amount_minor,currency,state,reason,aftersale_id`,
    [request.id, request.mall, request.payment, provider, PaymentReference.refund(request.id).text, request.idempotency,
      request.amountMinor, payment.currency, request.reason, request.aftersale ?? null]);
    for (const leg of legs) await database.query(`insert into payment.refundtender(mall_id,refund_id,sequence,kind,reference_id,amount_minor,state)
      values($1,$2,$3,$4,$5,$6,'planned')`, [request.mall, request.id, leg.sequence, leg.kind, leg.reference, leg.amount]);
    if (request.aftersale && request.supplier) await this.allocateSupplierRefund(database, request, payment.currency, request.supplier);
    return inserted.rows[0]!;
  }

  private async allocateSupplierRefund(database: OperationDatabase, request: RefundRequest, currency: string,
    target: NonNullable<RefundRequest['supplier']>): Promise<void> {
    const already = (await database.query<{ amount_minor: number }>(`select coalesce(sum(amount_minor),0)::float8 amount_minor
      from payment.supplierrefundallocation where order_line_id=$1 and state<>'failed'`, [target.orderLine])).rows[0]?.amount_minor ?? 0;
    if (already+request.amountMinor>target.linePayableMinor) throw new Error('SUPPLIER_AFTERSALE_AMOUNT_EXCEEDS_LINE');
    await database.query(`insert into payment.supplierrefundallocation(id,refund_id,aftersale_id,order_line_id,supplier_leg_id,
      transaction_id,correlation_id,route_id,route_version,supplier_id,amount_minor,currency,state,created_at)
      values('supplier-refund-allocation:'||$1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'planned',clock_timestamp())
      on conflict(refund_id,order_line_id) do nothing`, [request.id,request.aftersale,target.orderLine,target.supplierLeg,
      target.transaction,target.correlation,target.route,target.routeVersion,target.supplier,request.amountMinor,currency]);
  }
}

function key(kind: string, reference: string | null): string { return `${kind}:${reference ?? ''}`; }
