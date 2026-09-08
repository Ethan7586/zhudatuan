import type { PaymentScene } from '../../public';
import type { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { systemAuthorizationEvidence } from '../../../../platform/security/AuthorizationEvidence';
import type { OrderPaymentPort } from '../../../order/public';
import type { VerifiedPaymentWebhook, WebhookInboxRepository } from '../../application/port/WebhookInboxRepository';

export class PgWebhookInboxRepository implements WebhookInboxRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly orders: Pick<OrderPaymentPort, 'payment'>
  ) {}

  async accept(context: WriteTransactionContext, input: Parameters<WebhookInboxRepository['accept']>[1]) {
    const database = this.transactions.database(context);
    const observed = input.notification;
    const resolved =
      observed.kind === 'payment'
        ? await database.query<{ order_id: string; scope_id: string }>('select order_id,scope_id from payment.intent where provider_reference=$1', [observed.providerReference])
        : await database.query<{ order_id: string; scope_id: string }>(
            `select intent.order_id,intent.scope_id from payment.refund refund join payment.payment payment on payment.id=refund.payment_id
             join payment.intent intent on intent.id=payment.intent_id where refund.provider_reference=$1`,
            [observed.providerReference]
          );
    const reference = resolved.rows[0];
    if (!reference) throw new Error('PAYMENT_WEBHOOK_TARGET_NOT_FOUND');
    const order = await this.orders.payment(context, reference.order_id);
    if (!order || order.scope !== reference.scope_id) throw new Error('PAYMENT_WEBHOOK_SCOPE_MISMATCH');
    const payload = observed.kind === 'payment' ? await paymentPayload(database, observed) : await refundPayload(database, observed, order.id);
    const accepted = await database.query<{ status: string }>(
      `select runtime.accept_provider_webhook('wechatpayment',$1,$2,$3::jsonb,$4,$5,
       'payment.provider.observed',1,$6::jsonb) status`,
      [observed.id, input.rawHash, JSON.stringify(input.headers), input.raw, input.trace, JSON.stringify({ providerEvent: observed.id, kind: observed.kind, evidence: observed.evidence })]
    );
    if (accepted.rows[0]?.status !== 'accepted') return Object.freeze({ replayed: true });
    await new PgRuntimeWriter(database).schedule({
      id: `job:webhook:${observed.id}`,
      kind: observed.kind === 'payment' ? 'paymentquery' : 'paymentrefund',
      owner: 'payment',
      scope: reference.scope_id,
      payload,
      priority: 1,
      authorization: systemAuthorizationEvidence(context, 'provider', new Date()),
    });
    return Object.freeze({ replayed: false });
  }
}

async function paymentPayload(database: ReturnType<PgTransactionAccess['database']>, observed: Extract<VerifiedPaymentWebhook, { kind: 'payment' }>) {
  const target = await database.query<PaymentTarget>(
    `select intent.id,tender.amount_minor::float8 amount_minor,intent.currency,
     attempt.payer_hash,attempt.scene,attempt.application_hash from payment.intent intent
     join payment.intenttender tender on tender.intent_id=intent.id and tender.kind='wechat'
     join lateral(select payer_hash,scene,application_hash from payment.attempt where intent_id=intent.id and provider='wechat'
       order by requested_at desc,id desc limit 1) attempt on true
     where intent.provider_reference=$1 for update of intent`,
    [observed.providerReference]
  );
  const intent = target.rows[0];
  if (
    !intent ||
    intent.amount_minor !== observed.amountMinor ||
    intent.currency !== observed.currency ||
    intent.payer_hash !== observed.payerHash ||
    intent.scene !== observed.application.scene ||
    intent.application_hash !== observed.application.applicationHash
  ) {
    throw new Error('PAYMENT_WEBHOOK_INTEGRITY_MISMATCH');
  }
  return Object.freeze({ intent: intent.id, providerEvent: `wechatpayment:${observed.id}` });
}

async function refundPayload(database: ReturnType<PgTransactionAccess['database']>, observed: Extract<VerifiedPaymentWebhook, { kind: 'refund' }>, order: string) {
  const target = await database.query<RefundTarget>(
    `select refund.id,
     coalesce((select sum(leg.amount_minor) from payment.refundtender leg where leg.refund_id=refund.id and leg.kind='wechat'),0)::float8 amount_minor,
     coalesce((select plan.amount_minor from payment.intenttender plan where plan.intent_id=intent.id and plan.kind='wechat'),0)::float8 total_minor,
     intent.order_id from payment.refund refund join payment.payment payment on payment.id=refund.payment_id
     join payment.intent intent on intent.id=payment.intent_id where refund.provider_reference=$1 for update of refund`,
    [observed.providerReference]
  );
  const refund = target.rows[0];
  if (!refund || refund.amount_minor !== observed.amountMinor || refund.total_minor !== observed.totalMinor) throw new Error('REFUND_WEBHOOK_INTEGRITY_MISMATCH');
  if (refund.order_id !== order) throw new Error('PAYMENT_WEBHOOK_SCOPE_MISMATCH');
  return Object.freeze({ refund: refund.id, providerEvent: `wechatpayment:${observed.id}` });
}

interface PaymentTarget {
  readonly id: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly payer_hash: string | null;
  readonly scene: PaymentScene;
  readonly application_hash: string;
}

interface RefundTarget {
  readonly id: string;
  readonly amount_minor: number;
  readonly total_minor: number;
  readonly order_id: string;
}
