import { createHash } from 'node:crypto';
import type { WechatScene } from '@shop/config/server';
import { appendOperationAudit } from '../../foundation/application/ModuleOperations';
import { operationRequestHash } from '../../foundation/application/OperationHash';
import type { AuditSink } from '../../foundation/application/AuditSink';
import type { OperationRequest, OperationResult } from '../../foundation/application/OperationHandler';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import type { PaymentGateway } from './application/port/PaymentGateway';
import { paymentProviderHeaders, paymentTransaction } from './PaymentOperationSupport';
import { applyApiDatabaseContext } from '../../foundation/infrastructure/DatabaseContext';
import type { PaymentOrderPort } from '../order/public';

export class PaymentWebhook {
  constructor(
    private readonly pool: DatabasePool,
    private readonly gateway: PaymentGateway,
    private readonly audit: AuditSink,
    private readonly orders: Pick<PaymentOrderPort, 'payment'>
  ) {}

  async handle(request: OperationRequest): Promise<OperationResult> {
    if (!request.input.rawBody) throw new Error('WECHAT_PAY_NOTIFICATION_BODY_MISSING');
    const observed = await this.gateway.verifyNotification(request.input.headers, request.input.rawBody);
    const hash = createHash('sha256').update(request.input.rawBody).digest('hex');
    const trace = request.input.headers['request-id'] ?? `wechat:${observed.id}`;
    await paymentTransaction(this.pool, request, async (database) => {
      await applyApiDatabaseContext(database, {
        tenant: '',
        membership: '',
        scope: 'public:payment',
        actor: 'provider:wechat',
        trace,
        operation: observed.providerReference,
      });
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
      const scope = reference.scope_id;
      await applyApiDatabaseContext(database, { tenant: '', membership: '', scope, actor: 'provider:wechat', trace });
      const order = await this.orders.payment(database, reference.order_id);
      if (!order) throw new Error('PAYMENT_WEBHOOK_TARGET_NOT_FOUND');
      if (order.scope !== scope) throw new Error('PAYMENT_WEBHOOK_SCOPE_MISMATCH');
      let payload: Record<string, string>;
      if (observed.kind === 'payment') {
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
        payload = { intent: intent.id, providerEvent: `wechatpayment:${observed.id}` };
      } else {
        const target = await database.query<RefundTarget>(
          `select refund.id,
          coalesce((select sum(leg.amount_minor) from payment.refundtender leg where leg.refund_id=refund.id and leg.kind='wechat'),0)::float8 amount_minor,
          coalesce((select plan.amount_minor from payment.intenttender plan where plan.intent_id=intent.id and plan.kind='wechat'),0)::float8 total_minor,
          intent.order_id from payment.refund refund join payment.payment payment on payment.id=refund.payment_id
          join payment.intent intent on intent.id=payment.intent_id
          where refund.provider_reference=$1 for update of refund`,
          [observed.providerReference]
        );
        const refund = target.rows[0];
        if (!refund || refund.amount_minor !== observed.amountMinor || refund.total_minor !== observed.totalMinor) {
          throw new Error('REFUND_WEBHOOK_INTEGRITY_MISMATCH');
        }
        if (refund.order_id !== order.id) throw new Error('PAYMENT_WEBHOOK_SCOPE_MISMATCH');
        payload = { refund: refund.id, providerEvent: `wechatpayment:${observed.id}` };
      }
      const accepted = await database.query<{ status: string }>(
        `select runtime.accept_provider_webhook('wechatpayment',$1,$2,$3::jsonb,$4,$5,
        'payment.provider.observed',1,$6::jsonb) status`,
        [observed.id, hash, JSON.stringify(paymentProviderHeaders(request.input.headers)), request.input.rawBody, trace, JSON.stringify({ providerEvent: observed.id, kind: observed.kind, evidence: observed.evidence })]
      );
      if (accepted.rows[0]?.status !== 'accepted') return;
      await database.query(
        `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
        values($1,$2,'payment',$3,$4::jsonb,'queued',1,clock_timestamp(),clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
        [`job:webhook:${observed.id}`, observed.kind === 'payment' ? 'paymentquery' : 'paymentrefund', scope, JSON.stringify(payload)]
      );
      await appendOperationAudit(this.audit, database, request, 'payment', { status: 204 }, 'provider:wechat', scope, operationRequestHash(request));
    });
    return { status: 204, body: {} };
  }
}

interface PaymentTarget {
  readonly id: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly payer_hash: string | null;
  readonly scene: WechatScene;
  readonly application_hash: string;
}

interface RefundTarget {
  readonly id: string;
  readonly amount_minor: number;
  readonly total_minor: number;
  readonly order_id: string;
}
