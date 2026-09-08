import { randomUUID } from 'node:crypto';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { BenefitPort } from '../../../benefit';
import { FinancePort } from '../../../finance';
import { VoucherPort } from '../../../voucher';
import { orderPort } from '../../../order_dingdan';

const benefit = new BenefitPort(new FinancePort());
const voucher = new VoucherPort(new FinancePort());

interface RefundRow {
  readonly id: string;
  readonly payment_id: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly state: string;
  readonly aftersale_id: string | null;
  readonly order_id: string;
  readonly scope_id: string;
  readonly mall_id: string;
  readonly member_id: string;
}

interface RefundLeg {
  readonly sequence: number;
  readonly kind: 'wechat' | 'benefit' | 'voucher';
  readonly reference_id: string | null;
  readonly amount_minor: number;
}

export class RefundSettlement {
  async complete(database: OperationDatabase, mall: string, refundid: string, providerReference: string | null): Promise<void> {
    const refund = (await database.query<RefundRow>(`select refund.id,refund.payment_id,refund.amount_minor::float8 amount_minor,refund.currency,
      refund.state,refund.aftersale_id,intent.order_id,refund.mall_id scope_id,refund.mall_id,intent.member_id from payment.refund refund
      join payment.payment payment on payment.mall_id=refund.mall_id and payment.id=refund.payment_id
      join payment.intent intent on intent.mall_id=payment.mall_id and intent.id=payment.intent_id
      where refund.mall_id=$1 and refund.id=$2 for update of refund,payment,intent`, [mall, refundid])).rows[0];
    if (!refund || refund.state === 'succeeded') return;
    if (!['requested','submitted','processing'].includes(refund.state)) throw new Error('PAYMENT_REFUND_STATE_INVALID');
    const legs = (await database.query<RefundLeg>(`select sequence,kind,reference_id,amount_minor::float8 amount_minor
      from payment.refundtender where mall_id=$1 and refund_id=$2 and state in('planned','processing')
      order by sequence for update`, [mall, refundid])).rows;
    if (legs.length === 0 || legs.reduce((sum, leg) => sum + leg.amount_minor, 0) !== refund.amount_minor) throw new Error('PAYMENT_REFUND_PLAN_INTEGRITY_FAILED');
    const externalMinor = legs.reduce((sum, leg) => sum+(leg.kind === 'wechat' ? leg.amount_minor : 0), 0);
    const providerOccurredAt = await refundProviderOccurredAt(database, refund, providerReference, externalMinor);
    for (const leg of legs) {
      if (leg.kind === 'benefit') await restoreBenefit(database, refund, leg);
      if (leg.kind === 'voucher') await restoreVoucher(database, refund, leg);
    }
    const payment = await database.query<{ refunded_minor: number; captured_minor: number }>(`update payment.payment
      set refunded_minor=refunded_minor+$2,state=case when refunded_minor+$2=captured_minor then 'refunded' else 'partially_refunded' end,
        version=version+1 where mall_id=$1 and id=$3 and refunded_minor+$2<=captured_minor
      returning refunded_minor::float8 refunded_minor,captured_minor::float8 captured_minor`,
    [mall, refund.amount_minor, refund.payment_id]);
    const totals = payment.rows[0];
    if (!totals) throw new Error('PAYMENT_REFUND_EXCEEDS_AVAILABLE');
    await database.query(`update payment.refundtender set state='succeeded',provider_reference=case when kind='wechat' then $2 else provider_reference end
      where mall_id=$1 and refund_id=$3 and state in('planned','processing')`, [mall, providerReference, refundid]);
    await database.query(`update payment.refund set state='succeeded',external_transaction=$3,version=version+1
      where mall_id=$1 and id=$2`, [mall, refundid, providerReference]);
    await database.query(`update payment.recoverycase set state='resolved',resolved_at=clock_timestamp()
      where mall_id=$1 and state='open' and evidence->>'refund'=$2`, [mall, refundid]);
    await orderPort.markRefunded(database, { order: refund.order_id, refundedMinor: totals.refunded_minor,
      capturedMinor: totals.captured_minor, aftersale: refund.aftersale_id });
    await database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
      values($1,'payment.refunded',1,'refund',$2,$3,jsonb_build_object('refund',$2::text,'payment',$4::text,'amountMinor',$5::bigint,'currency',$6::text,
        'member',$7::text,'order',$8::text,'mall',$9::text,'tenders',$10::jsonb,'scopes',(select jsonb_agg(ancestor_id order by depth)
          from organization.unitclosure where descendant_id=$3),'timezone',(select timezone from organization.organization where id=$9)),
        $1,coalesce($11::timestamptz,clock_timestamp()),clock_timestamp())`, [`event:${randomUUID()}`, refundid, refund.scope_id, refund.payment_id,
      refund.amount_minor, refund.currency, refund.member_id, refund.order_id, refund.mall_id, JSON.stringify(legs), providerOccurredAt]);
  }
}

async function refundProviderOccurredAt(database: OperationDatabase, refund: RefundRow, providerReference: string | null,
  externalMinor: number): Promise<string | null> {
  if (externalMinor === 0) {
    if (providerReference !== null) throw new Error('PAYMENT_INTERNAL_REFUND_PROVIDER_REFERENCE_FORBIDDEN');
    return null;
  }
  if (!providerReference) throw new Error('PAYMENT_REFUND_PROVIDER_REFERENCE_REQUIRED');
  const authoritative = await database.query<{ occurred_at: string }>(`select attempt.provider_occurred_at::text occurred_at
    from payment.providerattempt attempt where attempt.mall_id=$1 and attempt.refund_id=$2
      and attempt.outcome='succeeded' and attempt.provider_state='succeeded'
      and attempt.provider_reference=$3 and attempt.provider_occurred_at is not null
      and attempt.provider_effect_hash=encode(public.digest(attempt.provider_effect::text,'sha256'),'hex')
      and attempt.provider_effect->>'kind'='payment.refund' and attempt.provider_effect->>'refund'=$2
      and attempt.provider_effect->>'reference'=$3 and attempt.provider_effect->>'amountMinor'=$4::text
      and attempt.provider_effect->>'currency'=$5
      and (attempt.provider_effect->>'occurredAt')::timestamptz=attempt.provider_occurred_at
    order by attempt.provider_occurred_at,attempt.id limit 1`, [refund.mall_id, refund.id, providerReference, externalMinor, refund.currency]);
  const occurredAt = authoritative.rows[0]?.occurred_at;
  if (!occurredAt) throw new Error('PAYMENT_REFUND_PROVIDER_EFFECT_REQUIRED');
  return occurredAt;
}

async function restoreBenefit(database: OperationDatabase, refund: RefundRow, leg: RefundLeg): Promise<void> {
  if (!leg.reference_id) throw new Error('BENEFIT_REFUND_ACCOUNT_MISSING');
  await benefit.refund(database, { id: refund.id, order: refund.order_id, member: refund.member_id, scope: refund.scope_id,
    account: leg.reference_id, amountMinor: leg.amount_minor });
}

async function restoreVoucher(database: OperationDatabase, refund: RefundRow, leg: RefundLeg): Promise<void> {
  if (!leg.reference_id) throw new Error('VOUCHER_REFUND_REFERENCE_MISSING');
  await voucher.refund(database, { refund: refund.id, order: refund.order_id, member: refund.member_id,
    voucher: leg.reference_id, amountMinor: leg.amount_minor });
}
