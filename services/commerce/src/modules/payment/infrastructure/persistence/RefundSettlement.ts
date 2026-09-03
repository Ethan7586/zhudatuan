import { DomainError } from '../../../../foundation/domain/DomainError';
import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { PaymentOrderPort } from '../../../order/public';
import type { OrganizationReadPort } from '../../../organization/public';

interface RefundBenefit {
  refund(context: WriteTransactionContext, input: Readonly<{ id: string; order: string; member: string; scope: string; account: string; amountMinor: number }>): Promise<void>;
}
interface RefundVoucher {
  refund(context: WriteTransactionContext, input: Readonly<{ refund: string; order: string; member: string; voucher: string; amountMinor: number }>): Promise<void>;
}
type RefundOrders = Pick<PaymentOrderPort, 'lockPayment' | 'aftersale' | 'markRefunded' | 'recordPaymentRefund' | 'recordRefund'>;

interface RefundRow {
  readonly id: string;
  readonly payment_id: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly state: string;
  readonly provider: string;
  readonly provider_reference: string;
  readonly reason: string;
  readonly aftersale_id: string | null;
  readonly order_id: string;
  readonly scope_id: string;
  readonly mall_id: string;
  readonly member_id: string;
  readonly line_id: string | null;
}

interface RefundLeg {
  readonly sequence: number;
  readonly kind: 'wechat' | 'benefit' | 'voucher';
  readonly reference_id: string | null;
  readonly amount_minor: number;
}

export class RefundSettlement {
  private readonly transactions = new PgTransactionAccess();
  constructor(
    private readonly benefit: RefundBenefit,
    private readonly voucher: RefundVoucher,
    private readonly orders: RefundOrders,
    private readonly organizations: Pick<OrganizationReadPort, 'scope'>
  ) {}

  async complete(context: WriteTransactionContext, refundid: string, providerReference: string | null): Promise<void> {
    const database = this.transactions.database(context);
    const reference = (
      await database.query<{ order_id: string }>(
        `select intent.order_id from payment.refund refund join payment.payment payment on payment.id=refund.payment_id
        join payment.intent intent on intent.id=payment.intent_id where refund.id=$1`,
        [refundid]
      )
    ).rows[0];
    if (!reference) return;
    const order = await this.orders.lockPayment(context, reference.order_id);
    if (!order) throw new Error('ORDER_NOT_FOUND');
    const paymentRefund = (
      await database.query<Omit<RefundRow, 'scope_id' | 'mall_id' | 'member_id' | 'line_id'>>(
        `select refund.id,refund.payment_id,refund.amount_minor::float8 amount_minor,refund.currency,
      refund.state,refund.provider,refund.provider_reference,refund.reason,refund.aftersale_id,intent.order_id from payment.refund refund
      join payment.payment payment on payment.id=refund.payment_id join payment.intent intent on intent.id=payment.intent_id
      where refund.id=$1 for update of refund,payment`,
        [refundid]
      )
    ).rows[0];
    if (!paymentRefund || paymentRefund.state === 'succeeded') return;
    const sale = paymentRefund.aftersale_id ? await this.orders.aftersale(context, paymentRefund.aftersale_id) : null;
    const refund: RefundRow = Object.freeze({
      ...paymentRefund,
      scope_id: order.scope,
      mall_id: order.mall,
      member_id: order.member,
      line_id: sale?.line ?? null,
    });
    if (!['requested', 'submitted', 'processing'].includes(refund.state)) throw new Error('PAYMENT_REFUND_STATE_INVALID');
    const legs = (
      await database.query<RefundLeg>(
        `select sequence,kind,reference_id,amount_minor::float8 amount_minor
      from payment.refundtender where refund_id=$1 and state in('planned','processing') order by sequence for update`,
        [refundid]
      )
    ).rows;
    if (legs.length === 0 || legs.reduce((sum, leg) => sum + leg.amount_minor, 0) !== refund.amount_minor) throw new Error('PAYMENT_REFUND_PLAN_INTEGRITY_FAILED');
    for (const leg of legs) {
      if (leg.kind === 'benefit') await this.restoreBenefit(context, refund, leg);
      if (leg.kind === 'voucher') await this.restoreVoucher(context, refund, leg);
    }
    const payment = await database.query<{ refunded_minor: number; captured_minor: number }>(
      `update payment.payment
      set refunded_minor=refunded_minor+$2,state=case when refunded_minor+$2=captured_minor then 'refunded' else 'partiallyrefunded' end,
        version=version+1 where id=$1 and refunded_minor+$2<=captured_minor returning refunded_minor::float8 refunded_minor,captured_minor::float8 captured_minor`,
      [refund.payment_id, refund.amount_minor]
    );
    const totals = payment.rows[0];
    if (!totals) throw new DomainError('PAYMENT_REFUND_EXCEEDS_AVAILABLE');
    await database.query(
      `update payment.refundtender set state='succeeded',provider_reference=case when kind='wechat' then $2 else provider_reference end
      where refund_id=$1 and state in('planned','processing')`,
      [refundid, providerReference]
    );
    await database.query(`update payment.refund set state='succeeded',external_transaction=$2,version=version+1 where id=$1`, [refundid, providerReference]);
    await database.query(
      `update payment.recoverycase set state='resolved',resolved_at=clock_timestamp()
      where state='open' and evidence->>'refund'=$1`,
      [refundid]
    );
    await this.orders.markRefunded(context, { order: refund.order_id, refundedMinor: totals.refunded_minor, capturedMinor: totals.captured_minor, aftersale: refund.aftersale_id });
    await this.orders.recordPaymentRefund(context, refund.order_id, totals.refunded_minor, totals.captured_minor);
    await this.orders.recordRefund(context, {
      id: refund.id,
      order: refund.order_id,
      aftersale: refund.aftersale_id,
      provider: refund.provider,
      providerReference: providerReference ?? refund.provider_reference,
      amountMinor: refund.amount_minor,
      currency: refund.currency,
      state: 'succeeded',
      reason: refund.reason,
      tenders: legs.map((leg) => Object.freeze({ sequence: leg.sequence, kind: leg.kind, reference: leg.reference_id, amountMinor: leg.amount_minor, state: 'succeeded' })),
    });
    const scope = await this.organizations.scope(context, refund.scope_id);
    await new PgRuntimeWriter(database).append({
      id: `event:${randomUUID()}`,
      type: 'refund.completed',
      aggregateType: 'refund',
      aggregate: refundid,
      scope: refund.scope_id,
      payload: {
        refund: refundid,
        payment: refund.payment_id,
        amountMinor: refund.amount_minor,
        currency: refund.currency,
        member: refund.member_id,
        order: refund.order_id,
        mall: refund.mall_id,
        tenders: legs,
        lineId: refund.line_id,
        scopes: [scope.id, ...scope.ancestors],
        timezone: scope.timezone,
      },
      trace: `refund:${refundid}`,
    });
  }

  private async restoreBenefit(context: WriteTransactionContext, refund: RefundRow, leg: RefundLeg): Promise<void> {
    if (!leg.reference_id) throw new Error('BENEFIT_REFUND_ACCOUNT_MISSING');
    await this.benefit.refund(context, { id: refund.id, order: refund.order_id, member: refund.member_id, scope: refund.scope_id, account: leg.reference_id, amountMinor: leg.amount_minor });
  }

  private async restoreVoucher(context: WriteTransactionContext, refund: RefundRow, leg: RefundLeg): Promise<void> {
    if (!leg.reference_id) throw new Error('VOUCHER_REFUND_REFERENCE_MISSING');
    await this.voucher.refund(context, { refund: refund.id, order: refund.order_id, member: refund.member_id, voucher: leg.reference_id, amountMinor: leg.amount_minor });
  }
}
