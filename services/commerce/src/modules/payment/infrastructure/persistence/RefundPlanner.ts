import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { Money } from '@shop/kernel';
import { PaymentReference } from '../../domain/model/PaymentReference';
import { AllocationPolicy } from '../../domain/policy/AllocationPolicy';
import type { OrderPaymentPort } from '../../../order/public';
import { Refund } from '../../domain/model/Refund';
import { DomainError } from '../../../../foundation/domain/DomainError';
export interface RefundRequest {
  readonly id: string;
  readonly payment: string;
  readonly amountMinor: number;
  readonly idempotency: string;
  readonly reason: string;
  readonly scope: string;
  readonly scopes?: readonly string[];
  readonly aftersale?: string;
  readonly expectedVersion?: number;
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
  readonly order_id: string;
  readonly currency: string;
  readonly captured_minor: number;
  readonly version: number;
}
interface TenderRow {
  readonly sequence: number;
  readonly kind: 'wechat' | 'benefit' | 'voucher';
  readonly reference_id: string | null;
  readonly amount_minor: number;
  readonly refunded_minor: number;
}
interface RefundedRow {
  readonly kind: TenderRow['kind'];
  readonly reference_id: string | null;
  readonly amount_minor: number;
}
export class RefundPlanner {
  private readonly transactions = new PgTransactionAccess();
  constructor(
    private readonly orders: Pick<OrderPaymentPort, 'payment' | 'recordRefund'>,
    private readonly allocation = new AllocationPolicy()
  ) {}
  async create(context: WriteTransactionContext, request: RefundRequest): Promise<PlannedRefund> {
    const database = this.transactions.database(context);
    const payment = (
      await database.query<PaymentRow>(
        `select payment.intent_id,intent.order_id,payment.currency,
      payment.captured_minor::float8 captured_minor,payment.version::float8 version from payment.payment payment
      join payment.intent intent on intent.id=payment.intent_id where payment.id=$1 for update of payment`,
        [request.payment]
      )
    ).rows[0];
    if (!payment) throw new Error('PAYMENT_NOT_REFUNDABLE');
    const order = await this.orders.payment(context, payment.order_id);
    const scopes = request.scopes ?? Object.freeze([request.scope]);
    if (!order || !scopes.includes(order.scope)) throw new Error('PAYMENT_NOT_REFUNDABLE');
    if (payment.currency !== 'CNY') throw new Error('PAYMENT_CURRENCY_UNSUPPORTED');
    const existing = (
      await database.query<PlannedRefund>(
        `select id,payment_id,provider,provider_reference,amount_minor::float8 amount_minor,
      currency,state,reason,aftersale_id from payment.refund where payment_id=$1 and idempotency_key=$2`,
        [request.payment, request.idempotency]
      )
    ).rows[0];
    if (existing) {
      if (existing.amount_minor !== request.amountMinor || existing.reason !== request.reason || existing.aftersale_id !== (request.aftersale ?? null)) {
        throw new Error('PAYMENT_REFUND_IDEMPOTENCY_CONFLICT');
      }
      return existing;
    }
    if (request.expectedVersion !== undefined && request.expectedVersion !== payment.version) throw new DomainError('VERSION_CONFLICT');
    const plans = (
      await database.query<Omit<TenderRow, 'refunded_minor'>>(
        `select sequence,kind,reference_id,amount_minor::float8 amount_minor
      from payment.intenttender where intent_id=$1 and state='captured' order by sequence for update`,
        [payment.intent_id]
      )
    ).rows;
    const refunded = (
      await database.query<RefundedRow>(
        `select leg.kind,leg.reference_id,sum(leg.amount_minor)::float8 amount_minor
      from payment.refund refund join payment.refundtender leg on leg.refund_id=refund.id
      where refund.payment_id=$1 and refund.state not in('failed','cancelled') group by leg.kind,leg.reference_id`,
        [request.payment]
      )
    ).rows;
    const claimed = new Map(refunded.map((row) => [key(row.kind, row.reference_id), row.amount_minor]));
    const tenders: readonly TenderRow[] = plans.map((plan) => ({ ...plan, refunded_minor: claimed.get(key(plan.kind, plan.reference_id)) ?? 0 }));
    if (tenders.length === 0 || tenders.reduce((sum, tender) => sum + tender.amount_minor, 0) !== payment.captured_minor) {
      throw new Error('PAYMENT_TENDER_CAPTURE_INTEGRITY_FAILED');
    }
    const keyed = new Map(tenders.map((tender) => [key(tender.kind, tender.reference_id), tender]));
    const allocation = this.allocation.allocateRefund(
      tenders.map((tender) => ({ tender: key(tender.kind, tender.reference_id), amount: Money.of(tender.amount_minor, 'CNY'), refundable: Money.of(tender.amount_minor - tender.refunded_minor, 'CNY') })),
      Money.of(request.amountMinor, 'CNY')
    );
    const legs = allocation.map(({ tender, amount }, index) => {
      const source = keyed.get(tender);
      if (!source) throw new Error('PAYMENT_TENDER_PLAN_INVALID');
      return Object.freeze({ sequence: index + 1, kind: source.kind, reference: source.reference_id, amount: amount.minor });
    });
    const external = legs.some(({ kind }) => kind === 'wechat');
    const internal = legs.some(({ kind }) => kind !== 'wechat');
    const provider = external && internal ? 'mixed' : external ? 'wechat' : 'internal';
    new Refund({ id: request.id, payment: request.payment, amountMinor: request.amountMinor, currency: payment.currency,
      state: 'requested', reason: request.reason, version: 0 });
    const inserted = await database.query<PlannedRefund>(
      `insert into payment.refund(id,payment_id,provider,provider_reference,idempotency_key,
      amount_minor,currency,state,reason,aftersale_id,requested_at,completed_at,version)
      values($1,$2,$3,$4,$5,$6,$7,'requested',$8,$9,clock_timestamp(),null,0)
      returning id,payment_id,provider,provider_reference,amount_minor::float8 amount_minor,currency,state,reason,aftersale_id`,
      [request.id, request.payment, provider, PaymentReference.refund(request.id).text, request.idempotency, request.amountMinor, payment.currency, request.reason, request.aftersale ?? null]
    );
    for (const leg of legs)
      await database.query(
        `insert into payment.refundtender(refund_id,sequence,kind,reference_id,amount_minor,state)
      values($1,$2,$3,$4,$5,'planned')`,
        [request.id, leg.sequence, leg.kind, leg.reference, leg.amount]
      );
    const created = inserted.rows[0]!;
    await this.orders.recordRefund(context, {
      id: created.id,
      order: payment.order_id,
      aftersale: created.aftersale_id,
      provider: created.provider,
      providerReference: created.provider_reference,
      amountMinor: created.amount_minor,
      currency: created.currency,
      state: created.state,
      reason: created.reason,
      tenders: legs.map((leg) => Object.freeze({ sequence: leg.sequence, kind: leg.kind, reference: leg.reference, amountMinor: leg.amount, state: 'planned' })),
    });
    return created;
  }
}
function key(kind: string, reference: string | null): string {
  return `${kind}:${reference ?? ''}`;
}
