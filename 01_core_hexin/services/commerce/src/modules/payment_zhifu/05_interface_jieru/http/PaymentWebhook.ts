import { createHash } from 'node:crypto';
import type { WechatScene } from '@shop/config/server';
import { appendOperationAudit, operationRequestHash } from '../../../../foundation/application/ModuleOperations';
import type { AuditSink } from '../../../../foundation/application/AuditSink';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { PaymentGateway } from '../../01_public_gongkai/ports_jiekou/PaymentGateway';
import { paymentProviderHeaders, paymentTransaction } from '../../03_application_yingyong/services_fuwu/PaymentOperationSupport';
import { applyApiDatabaseContext } from '../../../../foundation/infrastructure/DatabaseContext';

export class PaymentWebhook {
  constructor(private readonly pool: DatabasePool, private readonly gateway: PaymentGateway, private readonly audit: AuditSink) {}

  async handle(request: OperationRequest): Promise<OperationResult> {
    if (!request.input.rawBody) throw new Error('WECHAT_PAY_NOTIFICATION_BODY_MISSING');
    const observed = await this.gateway.verifyNotification(request.input.headers, request.input.rawBody);
    const hash = createHash('sha256').update(request.input.rawBody).digest('hex');
    const trace = request.input.headers['request-id'] ?? `wechat:${observed.id}`;
    await paymentTransaction(this.pool, request, async (database) => {
      const applicationHash = observed.kind === 'payment' ? observed.application.applicationHash : null;
      const resolved = await database.query<{ scope: string | null }>('select payment.webhook_scope($1,$2,$3) scope',
        [observed.kind, observed.providerReference, applicationHash]);
      let scope = resolved.rows[0]?.scope;
      if (!scope) throw new Error('PAYMENT_WEBHOOK_TARGET_NOT_FOUND');
      await applyApiDatabaseContext(database, { tenant: '', membership: '', scope, actor: 'provider:wechat', trace });
      let payload: Record<string, string>;
      if (observed.kind === 'payment') {
        const target = await database.query<PaymentTarget>(`select intent.id,tender.amount_minor::float8 amount_minor,intent.currency,
          intent.mall_id scope_id,
          attempt.payer_hash,attempt.scene,attempt.application_hash from payment.intent intent
          join payment.intenttender tender on tender.mall_id=intent.mall_id and tender.intent_id=intent.id and tender.kind='wechat'
          join lateral(select payer_hash,scene,application_hash from payment.attempt where mall_id=intent.mall_id
            and intent_id=intent.id and provider='wechat'
            order by requested_at desc,id desc limit 1) attempt on true
          where intent.mall_id=$1 and intent.provider_reference=$2`, [scope, observed.providerReference]);
        const intent = target.rows[0];
        if (!intent || intent.amount_minor !== observed.amountMinor || intent.currency !== observed.currency || intent.payer_hash !== observed.payerHash
          || intent.scene !== observed.application.scene || intent.application_hash !== observed.application.applicationHash) {
          throw new Error('PAYMENT_WEBHOOK_INTEGRITY_MISMATCH');
        }
        if (scope !== intent.scope_id) throw new Error('PAYMENT_WEBHOOK_SCOPE_MISMATCH');
        payload = { intent: intent.id, providerEvent: `wechatpayment:${observed.id}` };
      } else {
        const target = await database.query<RefundTarget>(`select refund.id,
          coalesce((select sum(leg.amount_minor) from payment.refundtender leg where leg.mall_id=refund.mall_id
            and leg.refund_id=refund.id and leg.kind='wechat'),0)::float8 amount_minor,
          coalesce((select plan.amount_minor from payment.intenttender plan where plan.mall_id=intent.mall_id
            and plan.intent_id=intent.id and plan.kind='wechat'),0)::float8 total_minor,
          refund.mall_id scope_id from payment.refund refund
          join payment.payment payment on payment.mall_id=refund.mall_id and payment.id=refund.payment_id
          join payment.intent intent on intent.mall_id=payment.mall_id and intent.id=payment.intent_id
          where refund.mall_id=$1 and refund.provider_reference=$2`, [scope, observed.providerReference]);
        const refund = target.rows[0];
        if (!refund || refund.amount_minor !== observed.amountMinor || refund.total_minor !== observed.totalMinor) {
          throw new Error('REFUND_WEBHOOK_INTEGRITY_MISMATCH');
        }
        if (scope !== refund.scope_id) throw new Error('PAYMENT_WEBHOOK_SCOPE_MISMATCH');
        payload = { refund: refund.id, providerEvent: `wechatpayment:${observed.id}` };
      }
      const accepted = await database.query<{ status: string }>(`select runtime.accept_provider_webhook('wechatpayment',$1,$2,$3::jsonb,$4,$5,
        'payment.provider.observed',1,$6::jsonb) status`, [observed.id, hash, JSON.stringify(paymentProviderHeaders(request.input.headers)),
        request.input.rawBody, trace, JSON.stringify(observed.evidence)]);
      if (accepted.rows[0]?.status !== 'accepted') return;
      await database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
        values($1,$2,'payment',$3,$4::jsonb,'queued',1,clock_timestamp(),clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
      [`job:webhook:${observed.id}`, observed.kind === 'payment' ? 'paymentquery' : 'paymentrefund', scope, JSON.stringify(payload)]);
      await appendOperationAudit(this.audit, database, request, 'payment', { status: 204 }, 'provider:wechat', scope, operationRequestHash(request));
    });
    return { status: 204 };
  }
}

interface PaymentTarget {
  readonly id: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly scope_id: string;
  readonly payer_hash: string | null;
  readonly scene: WechatScene;
  readonly application_hash: string;
}

interface RefundTarget { readonly id: string; readonly amount_minor: number; readonly total_minor: number; readonly scope_id: string }
