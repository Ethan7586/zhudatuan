import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { PgTransactionAccess, type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { Allocation } from '../../domain/model/Allocation';

export interface SettlementBenefit {
  consume(context: WriteTransactionContext, order: string, account: string, amountMinor: number): Promise<void>;
}

export interface SettlementVoucher {
  consume(context: WriteTransactionContext, order: string, member: string, voucher: string, amountMinor: number): Promise<void>;
}

export interface SettlementInventory {
  commit(context: WriteTransactionContext, order: string): Promise<void>;
}

export interface SettlementMarketing {
  commit(context: WriteTransactionContext, order: string): Promise<void>;
}

export interface SettlementOrders {
  paymentState(context: ReadTransactionContext, order: string): Promise<string>;
  markPaid(context: WriteTransactionContext, order: string): Promise<void>;
  recordPayment(
    context: WriteTransactionContext,
    input: Readonly<{
      order: string;
      payment: string;
      currency: string;
      capturedMinor: number;
      refundedMinor: number;
      state: string;
      version: number;
      tenders: readonly Readonly<{ sequence: number; kind: 'wechat' | 'benefit' | 'voucher'; reference: string | null; amountMinor: number; state: string }>[];
    }>
  ): Promise<void>;
}

export interface SettlementTarget {
  readonly intent: string;
  readonly order: string;
  readonly scope: string;
  readonly mall: string;
  readonly member: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly snapshot?: unknown;
}

interface PlanRow {
  readonly sequence: number;
  readonly kind: 'wechat' | 'benefit' | 'voucher';
  readonly reference_id: string | null;
  readonly amount_minor: number;
  readonly state: string;
}

/** Canonical capture orchestration with every side-effect boundary injected. */
export class PaymentSettlementCore {
  private readonly transactions = new PgTransactionAccess();
  constructor(
    private readonly benefit: SettlementBenefit,
    private readonly voucher: SettlementVoucher,
    private readonly inventory: SettlementInventory,
    private readonly marketing: SettlementMarketing,
    private readonly orders: SettlementOrders
  ) {}

  async capture(context: WriteTransactionContext, target: SettlementTarget, source: 'wechat' | 'internal' | 'mixed'): Promise<string> {
    const database = this.transactions.database(context);
    const locked = await database.query<{ state: string }>(`select state from payment.intent where id=$1 and order_id=$2 for update`, [target.intent, target.order]);
    const intentState = locked.rows[0]?.state;
    if (!intentState) throw new Error('PAYMENT_INTENT_NOT_FOUND');
    const paymentState = await this.orders.paymentState(context, target.order);
    const existing = await database.query<{ id: string }>('select id from payment.payment where intent_id=$1', [target.intent]);
    if (existing.rows[0]) return existing.rows[0].id;
    if (!['created', 'preparing', 'pending'].includes(intentState) || !['unpaid', 'authorizing'].includes(paymentState)) {
      throw new Error('PAYMENT_CAPTURE_STATE_INVALID');
    }
    const tenderPlans = (
      await database.query<PlanRow>(
        `select sequence,kind,reference_id,amount_minor::float8 amount_minor,state
      from payment.intenttender where intent_id=$1 order by sequence for update`,
        [target.intent]
      )
    ).rows;
    new Allocation(
      tenderPlans.map((plan) => Object.freeze({ sequence: plan.sequence, kind: plan.kind, reference: plan.reference_id, amountMinor: plan.amount_minor })),
      target.amountMinor
    );
    for (const plan of tenderPlans) {
      if (plan.kind === 'benefit') await this.consumeBenefit(context, target.order, plan);
      if (plan.kind === 'voucher') await this.consumeVoucher(context, target.order, target.member, plan);
      if (plan.kind === 'wechat' && source === 'internal') throw new Error('PAYMENT_EXTERNAL_TENDER_NOT_CAPTURED');
    }
    await this.inventory.commit(context, target.order);
    await this.marketing.commit(context, target.order);
    await database.query(`update payment.intenttender set state='captured' where intent_id=$1 and state in('planned','held')`, [target.intent]);
    await database.query(`update payment.intent set state='captured',version=version+1 where id=$1`, [target.intent]);
    await database.query("update payment.action set state='consumed',consumed_at=clock_timestamp(),version=version+1 where intent_id=$1 and state='active'", [target.intent]);
    const payment = `payment:${target.intent}`;
    await database.query(
      `insert into payment.payment(id,intent_id,amount_minor,currency,captured_minor,refunded_minor,state,version)
      values($1,$2,$3,$4,$3,0,'captured',0)`,
      [payment, target.intent, target.amountMinor, target.currency]
    );
    if (target.amountMinor > 0) {
      await database.query(
        `insert into payment.capture(id,scope_id,mall_id,member_id,order_id,source,currency,amount_minor,state,idempotency_key,
        completed_at,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,'succeeded',$9,clock_timestamp(),clock_timestamp())`,
        [`capture:${target.intent}`, target.scope, target.mall, target.member, target.order, source, target.currency, target.amountMinor, target.intent]
      );
      await database.query(
        `insert into payment.allocation(payment_id,target_type,target_id,amount_minor,currency)
        values($1,'order',$2,$3,$4)`,
        [payment, target.order, target.amountMinor, target.currency]
      );
    }
    await this.orders.markPaid(context, target.order);
    await this.orders.recordPayment(context, {
      order: target.order,
      payment,
      currency: target.currency,
      capturedMinor: target.amountMinor,
      refundedMinor: 0,
      state: 'captured',
      version: 0,
      tenders: tenderPlans.map((plan) => Object.freeze({ sequence: plan.sequence, kind: plan.kind, reference: plan.reference_id, amountMinor: plan.amount_minor, state: 'captured' })),
    });
    await events(database, target, payment);
    return payment;
  }

  private async consumeBenefit(context: WriteTransactionContext, order: string, plan: PlanRow): Promise<void> {
    if (!plan.reference_id) throw new Error('BENEFIT_ACCOUNT_REQUIRED');
    await this.benefit.consume(context, order, plan.reference_id, plan.amount_minor);
  }

  private async consumeVoucher(context: WriteTransactionContext, order: string, member: string, plan: PlanRow): Promise<void> {
    if (!plan.reference_id) throw new Error('VOUCHER_REFERENCE_REQUIRED');
    await this.voucher.consume(context, order, member, plan.reference_id, plan.amount_minor);
  }
}

async function events(database: SqlExecutor, target: SettlementTarget, payment: string): Promise<void> {
  const runtime = new PgRuntimeWriter(database);
  const snapshot = target.snapshot ?? (await runtime.latestEventPayload('order.placed', target.order));
  for (const [type, aggregate, payload] of [
    ['payment.captured', payment, { payment, order: target.order, amountMinor: target.amountMinor, currency: target.currency, member: target.member, snapshot }],
    ['order.paid', target.order, { payment, order: target.order, amountMinor: target.amountMinor, currency: target.currency, member: target.member, snapshot }],
  ] as const)
    await runtime.append({ id: `event:${randomUUID()}`, type, aggregateType: type.split('.')[0]!, aggregate, scope: target.scope, payload, trace: `payment:${target.intent}` });
}
