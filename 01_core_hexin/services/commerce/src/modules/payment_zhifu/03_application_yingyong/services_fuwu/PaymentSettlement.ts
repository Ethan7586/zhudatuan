import { randomUUID } from 'node:crypto';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { BenefitPort } from '../../../benefit';
import { FinancePort } from '../../../finance';
import { VoucherPort } from '../../../voucher/VoucherModule';
import { inventoryPort } from '../../../inventory';
import { marketingPort } from '../../../marketing/MarketingModule';
import { fulfillmentPort } from '../../../fulfillment/FulfillmentModule';
import { orderPort } from '../../../order_dingdan';
import { providerOccurredAt as requireProviderOccurredAt } from '../../01_public_gongkai/ports_jiekou/PaymentGateway';

const benefit = new BenefitPort(new FinancePort());
const voucher = new VoucherPort();

export interface SettlementTarget {
  readonly intent: string;
  readonly order: string;
  readonly scope: string;
  readonly mall: string;
  readonly member: string;
  readonly amountMinor: number;
  readonly currency: string;
}

interface PlanRow { readonly sequence: number; readonly kind: 'wechat' | 'benefit' | 'voucher'; readonly reference_id: string | null; readonly amount_minor: number; readonly state: string }

export class PaymentSettlement {
  async capture(database: OperationDatabase, target: SettlementTarget, source: 'wechat' | 'internal' | 'mixed', providerCompletion?: string): Promise<string> {
    const accountingOccurredAt = source === 'internal' ? null
      : requireProviderOccurredAt(providerCompletion, 'PAYMENT_CAPTURE_PROVIDER_OCCURRED_AT_REQUIRED');
    if (source === 'internal' && providerCompletion !== undefined) throw new Error('PAYMENT_INTERNAL_CAPTURE_PROVIDER_OCCURRED_AT_FORBIDDEN');
    const locked = await database.query<{ state: string }>(`select state from payment.intent
      where id=$1 and order_id=$2 and mall_id=$3 for update`, [target.intent, target.order, target.mall]);
    const intentState = locked.rows[0]?.state;
    if (!intentState) throw new Error('PAYMENT_INTENT_NOT_FOUND');
    const paymentState = await orderPort.paymentState(database, target.order);
    const existing = await database.query<{ id: string }>('select id from payment.payment where mall_id=$1 and intent_id=$2',
    [target.mall, target.intent]);
    if (existing.rows[0]) return existing.rows[0].id;
    if (!['created','authorizing','authorized'].includes(intentState) || !['unpaid','authorizing'].includes(paymentState)) throw new Error('PAYMENT_CAPTURE_STATE_INVALID');
    const plans = (await database.query<PlanRow>(`select sequence,kind,reference_id,amount_minor::float8 amount_minor,state
      from payment.intenttender where mall_id=$1 and intent_id=$2 order by sequence for update`, [target.mall, target.intent])).rows;
    if (plans.reduce((sum, plan) => sum + plan.amount_minor, 0) !== target.amountMinor) throw new Error('PAYMENT_TENDER_SUM_MISMATCH');
    for (const plan of plans) {
      if (plan.kind === 'benefit') await consumeBenefit(database, target.order, plan);
      if (plan.kind === 'voucher') await consumeVoucher(database, target.order, target.member, plan);
      if (plan.kind === 'wechat' && source === 'internal') throw new Error('PAYMENT_EXTERNAL_TENDER_NOT_CAPTURED');
    }
    await inventoryPort.commit(database, target.mall, target.order);
    await marketingPort.commit(database, target.order);
    await database.query(`update payment.intenttender set state='captured' where mall_id=$1 and intent_id=$2
      and state in('planned','held')`, [target.mall, target.intent]);
    await database.query(`update payment.intent set state='captured',version=version+1 where mall_id=$1 and id=$2`, [target.mall, target.intent]);
    const payment = `payment:${target.intent}`;
    await database.query(`insert into payment.payment(id,mall_id,intent_id,amount_minor,currency,captured_minor,refunded_minor,state,version)
      values($1,$2,$3,$4,$5,$4,0,'captured',0)`, [payment, target.mall, target.intent, target.amountMinor, target.currency]);
    if (target.amountMinor > 0) {
      await database.query(`insert into payment.capture(id,scope_id,mall_id,member_id,order_id,source,currency,amount_minor,state,idempotency_key,
        completed_at,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,'succeeded',$9,clock_timestamp(),clock_timestamp())`,
      [`capture:${target.intent}`, target.scope, target.mall, target.member, target.order, source, target.currency, target.amountMinor, target.intent]);
      await database.query(`insert into payment.allocation(mall_id,payment_id,target_type,target_id,amount_minor,currency)
        values($1,$2,'order',$3,$4,$5)`, [target.mall, payment, target.order, target.amountMinor, target.currency]);
    }
    await orderPort.markPaid(database, target.order);
    const fulfillments = await fulfillmentPort.create(database, {
      mall: target.mall, member: target.member, order: target.order, payment,
    });
    for (const fulfillment of fulfillments) await enqueue(database, target.mall, fulfillment);
    await events(database, target, payment, accountingOccurredAt);
    return payment;
  }
}

export async function releaseOrderHolds(database: OperationDatabase, mall: string, order: string): Promise<void> {
  await inventoryPort.release(database, mall, order);
  await benefit.release(database, order);
  await voucher.release(database, order);
  await marketingPort.release(database, order);
  await database.query(`update payment.intenttender set state='released' where mall_id=$1 and intent_id in(
    select id from payment.intent where mall_id=$1 and order_id=$2) and state in('planned','held')`, [mall, order]);
}

async function consumeBenefit(database: OperationDatabase, order: string, plan: PlanRow): Promise<void> {
  if (!plan.reference_id) throw new Error('BENEFIT_ACCOUNT_REQUIRED');
  await benefit.consume(database, order, plan.reference_id, plan.amount_minor);
}

async function consumeVoucher(database: OperationDatabase, order: string, member: string, plan: PlanRow): Promise<void> {
  if (!plan.reference_id) throw new Error('VOUCHER_REFERENCE_REQUIRED');
  await voucher.consume(database, order, member, plan.reference_id, plan.amount_minor);
}

async function enqueue(database: OperationDatabase, scope: string, fulfillment: string): Promise<void> {
  await database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
    values($1,'fulfillment','fulfillment',$2,jsonb_build_object('fulfillment',$3::text),'queued',10,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
  [`job:${randomUUID()}`, scope, fulfillment]);
}

async function events(database: OperationDatabase, target: SettlementTarget, payment: string, providerOccurredAt: string | null): Promise<void> {
  const snapshot = (await database.query<{ payload: unknown }>(`select payload from runtime.outbox where event_type='order.placed'
    and aggregate_id=$1 order by occurred_at desc,id desc limit 1`, [target.order])).rows[0]?.payload ?? null;
  for (const [type, aggregate, payload, occurredAt] of [
    ['payment.succeeded', payment, { payment, order: target.order, amountMinor: target.amountMinor, currency: target.currency, member: target.member, snapshot }, providerOccurredAt],
    ['order.paid', target.order, { payment, order: target.order, amountMinor: target.amountMinor, currency: target.currency, member: target.member, snapshot }, null],
  ] as const) await database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
    occurred_at,available_at) values($1,$2,1,$3,$4,$5,$6::jsonb,$1,coalesce($7::timestamptz,clock_timestamp()),clock_timestamp())`,
  [`event:${randomUUID()}`, type, type.split('.')[0], aggregate, target.scope, JSON.stringify(payload), occurredAt]);
}
