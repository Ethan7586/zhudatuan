import { createHash } from 'node:crypto';

import { WechatApplicationCatalog } from '@shop/config/server';
import type { PaymentExecutionContext, PaymentGateway, PaymentPrepayInput, PaymentScene } from '@shop/contract';
import { Executor } from '@shop/kernel';

import {
  applyWechatPayRefund,
  createJsapiPrepay,
  queryWechatPayRefund,
  queryWechatPayTransaction,
} from './Client';
import { closeWechatPayTransaction } from './Close';
import { type WechatPayConfig, type WechatPayConfigSource, loadWechatPayConfig } from './Config';
import { WechatPaymentExecutionPolicy, WechatPaymentManifest } from './Manifest';
import { WechatPayProtocolError } from './Models';
import {
  readWechatPayNotificationKind,
  verifyAndDecryptWechatPayNotification,
  verifyAndDecryptWechatRefundNotification,
} from './Notification';
import { createMiniappPaymentParameters } from './Crypto';
import type { WechatPayClientOptions } from './Transport';

export class WechatGateway implements PaymentGateway {
  readonly manifest = WechatPaymentManifest;
  private readonly configuration: WechatPayConfig;
  private readonly executor = new Executor(WechatPaymentExecutionPolicy);

  constructor(
    private readonly applications: WechatApplicationCatalog,
    source: WechatPayConfigSource
  ) {
    this.configuration = loadWechatPayConfig(source);
  }

  application(scene: PaymentScene) {
    const application = this.applications.get(scene);
    return Object.freeze({ scene, applicationHash: digest(application.appId) });
  }

  async prepay(input: PaymentPrepayInput, execution?: PaymentExecutionContext): Promise<Readonly<Record<string, string>>> {
    const application = this.resolve(input.application);
    const response = await this.execute(
      (options) =>
        createJsapiPrepay(
          this.configuration,
          {
            appId: application.appId,
            description: input.description,
            outTradeNo: input.orderNumber,
            totalCents: input.amountMinor,
            payerOpenid: input.payer,
            expiresAt: input.expiresAt,
          },
          options
        ),
      'none',
      execution
    );
    const parameters = await createMiniappPaymentParameters(this.configuration, application.appId, response.prepayId);
    return Object.freeze({ ...parameters, appId: application.appId, providerRequestId: response.providerRequestId ?? '' });
  }

  async query(orderNumber: string, context: Readonly<{ scene: PaymentScene; applicationHash: string }>, execution?: PaymentExecutionContext) {
    const application = this.resolve(context);
    let transaction;
    try {
      ({ transaction } = await this.execute((options) => queryWechatPayTransaction(this.configuration, application.appId, orderNumber, options), 'read', execution));
    } catch (cause) {
      if (cause instanceof WechatPayProtocolError && cause.code === 'WECHAT_PAY_PROVIDER_ORDER_NOT_EXIST') {
        return Object.freeze({ state: 'absent' as const, amountMinor: 0 });
      }
      throw cause;
    }
    const state =
      transaction.tradeState === 'SUCCESS'
        ? 'succeeded'
        : transaction.tradeState === 'REFUND'
          ? 'refunded'
          : transaction.tradeState === 'CLOSED' || transaction.tradeState === 'REVOKED'
            ? 'closed'
            : transaction.tradeState === 'PAYERROR'
              ? 'failed'
              : 'pending';
    return Object.freeze({ state, ...(transaction.transactionId ? { transaction: transaction.transactionId } : {}), amountMinor: transaction.amount.total });
  }

  async close(orderNumber: string, context: Readonly<{ scene: PaymentScene; applicationHash: string }>, execution?: PaymentExecutionContext): Promise<void> {
    this.resolve(context);
    await this.execute((options) => closeWechatPayTransaction(this.configuration, orderNumber, options), 'none', execution);
  }

  async refund(input: Readonly<{ refundNumber: string; transaction: string; refundMinor: number; totalMinor: number; reason: string }>, execution?: PaymentExecutionContext) {
    let refund;
    try {
      ({ refund } = await this.execute(
        (options) => applyWechatPayRefund(this.configuration, { outRefundNo: input.refundNumber, transactionId: input.transaction, refundCents: input.refundMinor, totalCents: input.totalMinor, reason: input.reason }, options),
        'none',
        execution
      ));
    } catch (cause) {
      if (!(cause instanceof WechatPayProtocolError) || !cause.retryable) throw cause;
      ({ refund } = await this.execute((options) => queryWechatPayRefund(this.configuration, input.refundNumber, options), 'read', execution));
    }
    return Object.freeze({ state: refund.status === 'SUCCESS' ? 'succeeded' : refund.status === 'PROCESSING' ? 'processing' : 'failed', reference: refund.refundId });
  }

  async queryRefund(refundNumber: string, execution?: PaymentExecutionContext) {
    const { refund } = await this.execute((options) => queryWechatPayRefund(this.configuration, refundNumber, options), 'read', execution);
    return Object.freeze({ state: refund.status === 'SUCCESS' ? 'succeeded' : refund.status === 'PROCESSING' ? 'processing' : 'failed', reference: refund.refundId });
  }

  async verifyNotification(headers: Readonly<Record<string, string>>, body: string, execution?: PaymentExecutionContext) {
    assertExecution(execution);
    const normalized = new Headers(headers);
    if (readWechatPayNotificationKind(body) === 'transaction') {
      const event = await verifyAndDecryptWechatPayNotification(this.configuration, { headers: normalized, body });
      const application = this.applications.find(event.transaction.appId);
      if (!application) throw new WechatPayProtocolError('WECHAT_PAY_APPLICATION_UNKNOWN');
      return Object.freeze({
        kind: 'payment' as const,
        id: event.notificationId,
        providerReference: event.transaction.outTradeNo,
        transaction: event.transaction.transactionId!,
        amountMinor: event.transaction.amount.total,
        currency: 'CNY' as const,
        payerHash: event.payerOpenidHash,
        application: Object.freeze({ scene: application.scene, applicationHash: digest(application.appId) }),
        occurredAt: event.transaction.successTime!,
        evidence: event.summary,
      });
    }
    const event = await verifyAndDecryptWechatRefundNotification(this.configuration, { headers: normalized, body });
    return Object.freeze({
      kind: 'refund' as const,
      id: event.notificationId,
      providerReference: event.refund.outRefundNo,
      transaction: event.refund.transactionId,
      amountMinor: event.refund.amount.refund,
      totalMinor: event.refund.amount.total,
      state: event.refund.status === 'SUCCESS' ? ('succeeded' as const) : ('failed' as const),
      occurredAt: event.refund.successTime ?? event.createTime,
      evidence: event.summary,
    });
  }

  health(): Promise<Readonly<{ state: 'healthy' | 'degraded'; provider: 'wechat'; reason?: string }>> {
    const state = this.executor.circuitState();
    return Promise.resolve(Object.freeze({ state: state === 'open' ? 'degraded' : 'healthy', provider: 'wechat', ...(state === 'open' ? { reason: 'WECHAT_PAY_CIRCUIT_OPEN' } : {}) }));
  }

  private execute<T>(operation: (options: WechatPayClientOptions) => Promise<T>, mode: 'none' | 'read', execution?: PaymentExecutionContext): Promise<T> {
    return this.executor.run((deadline) => operation({ signal: deadline.signal, deadline: deadline.expiresAt,
      ...(execution ? { requestId: execution.requestId, traceId: execution.traceId } : {}) }), {
      mode,
      ...(execution ? { signal: execution.signal, deadline: execution.deadline } : {}),
      retryable: (cause) => cause instanceof WechatPayProtocolError && cause.retryable,
    });
  }

  private resolve(context: Readonly<{ scene: PaymentScene; applicationHash: string }>) {
    const application = this.applications.get(context.scene);
    if (digest(application.appId) !== context.applicationHash) throw new WechatPayProtocolError('WECHAT_PAY_APPLICATION_CONTEXT_MISMATCH');
    return application;
  }
}

function assertExecution(execution: PaymentExecutionContext | undefined): void {
  if (!execution) return;
  if (execution.signal.aborted) throw new WechatPayProtocolError('WECHAT_PAY_REQUEST_CANCELLED');
  if (Date.now() >= execution.deadline) throw new WechatPayProtocolError('WECHAT_PAY_DEADLINE_EXCEEDED', { retryable: true });
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
