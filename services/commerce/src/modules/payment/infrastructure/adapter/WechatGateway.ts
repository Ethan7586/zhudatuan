import { applyWechatPayRefund, closeWechatPayTransaction, createJsapiPrepay, createMiniappPaymentParameters, loadWechatPayConfig, queryWechatPayRefund, queryWechatPayTransaction,
  readWechatPayNotificationKind, verifyAndDecryptWechatPayNotification, verifyAndDecryptWechatRefundNotification, WechatPayProtocolError,
  type WechatPayClientOptions, type WechatPayConfigSource } from '@shop/wechatpayment';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import { providerOccurredAt, type PaymentGateway, type PrepayInput, type ProviderReceiptEvidence } from '../../application/port/PaymentGateway';
=======
import type { PaymentGateway, PrepayInput } from '../../application/port/PaymentGateway';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { providerOccurredAt, type PaymentGateway, type PrepayInput, type ProviderReceiptEvidence } from '../../application/port/PaymentGateway';
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
import type { PaymentGateway, PrepayInput } from '../../application/port/PaymentGateway';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
import { Executor } from '../../../../foundation/performance/Executor';
import { createHash } from 'node:crypto';
import { WechatApplicationCatalog, type WechatScene } from '@shop/config/server';

export class WechatGateway implements PaymentGateway {
  private readonly configuration;
  private readonly executor = new Executor();

  constructor(private readonly applications: WechatApplicationCatalog, source: WechatPayConfigSource) {
    this.configuration = loadWechatPayConfig(source);
  }

  application(scene: WechatScene) {
    const application = this.applications.get(scene);
    return Object.freeze({ scene, applicationHash: digest(application.appId) });
  }

  async prepay(input: PrepayInput): Promise<Readonly<Record<string, string>>> {
    const application = this.resolve(input.application);
    const response = await this.execute((options) => createJsapiPrepay(this.configuration, {
      appId: application.appId,
      description: input.description,
      outTradeNo: input.orderNumber,
      totalCents: input.amountMinor,
      payerOpenid: input.payer,
      expiresAt: input.expiresAt,
    }, options), 'none');
    const parameters = await createMiniappPaymentParameters(this.configuration, application.appId, response.prepayId);
    return Object.freeze({ ...parameters, appId: application.appId, providerRequestId: response.providerRequestId ?? '' });
  }

  async query(orderNumber: string, context: Readonly<{ scene: WechatScene; applicationHash: string }>) {
    const application = this.resolve(context);
    let transaction;
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    let providerRequestId: string | null = null;
    try {
      ({ transaction, providerRequestId } = await this.execute((options) => queryWechatPayTransaction(this.configuration, application.appId, orderNumber, options), 'read'));
    } catch (cause) {
      if (cause instanceof WechatPayProtocolError && cause.code === 'WECHAT_PAY_PROVIDER_ORDER_NOT_EXIST') {
        return Object.freeze({ state: 'absent' as const, amountMinor: 0,
          evidence: receipt('wechat.transaction.query', cause.providerRequestId, { outTradeNo: orderNumber, tradeState: 'NOT_EXIST' }) });
=======
=======
    let providerRequestId: string | null = null;
>>>>>>> 018b2a71 (chore(release): capture current production source)
    try {
      ({ transaction, providerRequestId } = await this.execute((options) => queryWechatPayTransaction(this.configuration, application.appId, orderNumber, options), 'read'));
    } catch (cause) {
      if (cause instanceof WechatPayProtocolError && cause.code === 'WECHAT_PAY_PROVIDER_ORDER_NOT_EXIST') {
<<<<<<< HEAD
        return Object.freeze({ state: 'absent' as const, amountMinor: 0 });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
        return Object.freeze({ state: 'absent' as const, amountMinor: 0,
          evidence: receipt('wechat.transaction.query', cause.providerRequestId, { outTradeNo: orderNumber, tradeState: 'NOT_EXIST' }) });
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
    try {
      ({ transaction } = await this.execute((options) => queryWechatPayTransaction(this.configuration, application.appId, orderNumber, options), 'read'));
    } catch (cause) {
      if (cause instanceof WechatPayProtocolError && cause.code === 'WECHAT_PAY_PROVIDER_ORDER_NOT_EXIST') {
        return Object.freeze({ state: 'absent' as const, amountMinor: 0 });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      }
      throw cause;
    }
    const state = transaction.tradeState === 'SUCCESS' ? 'succeeded' : transaction.tradeState === 'REFUND' ? 'refunded'
      : transaction.tradeState === 'CLOSED' || transaction.tradeState === 'REVOKED' ? 'closed'
        : transaction.tradeState === 'PAYERROR' ? 'failed' : 'pending';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    const occurredAt = transaction.successTime === null ? undefined : providerOccurredAt(transaction.successTime);
    if (state === 'succeeded' && occurredAt === undefined) throw new WechatPayProtocolError('WECHAT_PAY_SUCCESS_TIME_REQUIRED');
    return Object.freeze({ state, ...(transaction.transactionId ? { transaction: transaction.transactionId } : {}), amountMinor: transaction.amount.total,
      ...(occurredAt ? { occurredAt } : {}), evidence: receipt('wechat.transaction.query', providerRequestId, {
        outTradeNo: transaction.outTradeNo, transaction: transaction.transactionId, tradeState: transaction.tradeState,
        occurredAt: occurredAt ?? null, amountMinor: transaction.amount.total, currency: transaction.amount.currency }) });
<<<<<<< HEAD
=======
    return Object.freeze({ state, ...(transaction.transactionId ? { transaction: transaction.transactionId } : {}), amountMinor: transaction.amount.total });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
    return Object.freeze({ state, ...(transaction.transactionId ? { transaction: transaction.transactionId } : {}), amountMinor: transaction.amount.total });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  }

  async close(orderNumber: string, context: Readonly<{ scene: WechatScene; applicationHash: string }>): Promise<void> {
    this.resolve(context);
    await this.execute((options) => closeWechatPayTransaction(this.configuration, orderNumber, options), 'none');
  }

  async refund(input: Readonly<{ refundNumber: string; transaction: string; refundMinor: number; totalMinor: number; reason: string }>) {
    let refund;
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    let providerRequestId: string | null = null;
    let source = 'wechat.refund.apply';
    try {
      ({ refund, providerRequestId } = await this.execute((options) => applyWechatPayRefund(this.configuration, { outRefundNo: input.refundNumber,
        transactionId: input.transaction, refundCents: input.refundMinor, totalCents: input.totalMinor, reason: input.reason }, options), 'none'));
    } catch (cause) {
      if (!(cause instanceof WechatPayProtocolError) || !cause.retryable) throw cause;
      source = 'wechat.refund.query-after-apply';
      ({ refund, providerRequestId } = await this.execute((options) => queryWechatPayRefund(this.configuration, input.refundNumber, options), 'read'));
    }
    return refundObservation(source, providerRequestId, refund);
  }

  async queryRefund(refundNumber: string) {
    const { refund, providerRequestId } = await this.execute((options) => queryWechatPayRefund(this.configuration, refundNumber, options), 'read');
    return refundObservation('wechat.refund.query', providerRequestId, refund);
=======
=======
    let providerRequestId: string | null = null;
    let source = 'wechat.refund.apply';
>>>>>>> 018b2a71 (chore(release): capture current production source)
    try {
      ({ refund, providerRequestId } = await this.execute((options) => applyWechatPayRefund(this.configuration, { outRefundNo: input.refundNumber,
        transactionId: input.transaction, refundCents: input.refundMinor, totalCents: input.totalMinor, reason: input.reason }, options), 'none'));
    } catch (cause) {
      if (!(cause instanceof WechatPayProtocolError) || !cause.retryable) throw cause;
      source = 'wechat.refund.query-after-apply';
      ({ refund, providerRequestId } = await this.execute((options) => queryWechatPayRefund(this.configuration, input.refundNumber, options), 'read'));
    }
    return refundObservation(source, providerRequestId, refund);
  }

  async queryRefund(refundNumber: string) {
<<<<<<< HEAD
    const { refund } = await this.execute((options) => queryWechatPayRefund(this.configuration, refundNumber, options), 'read');
    return Object.freeze({ state: refund.status === 'SUCCESS' ? 'succeeded' : refund.status === 'PROCESSING' ? 'processing' : 'failed', reference: refund.refundId });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    const { refund, providerRequestId } = await this.execute((options) => queryWechatPayRefund(this.configuration, refundNumber, options), 'read');
    return refundObservation('wechat.refund.query', providerRequestId, refund);
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
    try {
      ({ refund } = await this.execute((options) => applyWechatPayRefund(this.configuration, { outRefundNo: input.refundNumber,
        transactionId: input.transaction, refundCents: input.refundMinor, totalCents: input.totalMinor, reason: input.reason }, options), 'none'));
    } catch (cause) {
      if (!(cause instanceof WechatPayProtocolError) || !cause.retryable) throw cause;
      ({ refund } = await this.execute((options) => queryWechatPayRefund(this.configuration, input.refundNumber, options), 'read'));
    }
    return Object.freeze({ state: refund.status === 'SUCCESS' ? 'succeeded' : refund.status === 'PROCESSING' ? 'processing' : 'failed', reference: refund.refundId });
  }

  async queryRefund(refundNumber: string) {
    const { refund } = await this.execute((options) => queryWechatPayRefund(this.configuration, refundNumber, options), 'read');
    return Object.freeze({ state: refund.status === 'SUCCESS' ? 'succeeded' : refund.status === 'PROCESSING' ? 'processing' : 'failed', reference: refund.refundId });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  }

  async verifyNotification(headers: Readonly<Record<string, string>>, body: string) {
    const normalized = new Headers(headers);
    if (readWechatPayNotificationKind(body) === 'transaction') {
      const event = await verifyAndDecryptWechatPayNotification(this.configuration, { headers: normalized, body });
      const application = this.applications.find(event.transaction.appId);
      if (!application) throw new WechatPayProtocolError('WECHAT_PAY_APPLICATION_UNKNOWN');
      return Object.freeze({ kind: 'payment' as const, id: event.notificationId, providerReference: event.transaction.outTradeNo,
        transaction: event.transaction.transactionId!, amountMinor: event.transaction.amount.total, currency: 'CNY' as const,
        payerHash: event.payerOpenidHash, application: Object.freeze({ scene: application.scene, applicationHash: digest(application.appId) }),
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
        occurredAt: providerOccurredAt(event.transaction.successTime), evidence: event.summary });
=======
        occurredAt: event.transaction.successTime!, evidence: event.summary });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
        occurredAt: providerOccurredAt(event.transaction.successTime), evidence: event.summary });
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
        occurredAt: event.transaction.successTime!, evidence: event.summary });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    }
    const event = await verifyAndDecryptWechatRefundNotification(this.configuration, { headers: normalized, body });
    return Object.freeze({ kind: 'refund' as const, id: event.notificationId, providerReference: event.refund.outRefundNo,
      transaction: event.refund.transactionId, amountMinor: event.refund.amount.refund, totalMinor: event.refund.amount.total,
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
      state: event.refund.status === 'SUCCESS' ? 'succeeded' as const : 'failed' as const,
      occurredAt: providerOccurredAt(event.refund.successTime ?? event.createTime),
=======
      state: event.refund.status === 'SUCCESS' ? 'succeeded' as const : 'failed' as const, occurredAt: event.refund.successTime ?? event.createTime,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      state: event.refund.status === 'SUCCESS' ? 'succeeded' as const : 'failed' as const,
      occurredAt: providerOccurredAt(event.refund.successTime ?? event.createTime),
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
      state: event.refund.status === 'SUCCESS' ? 'succeeded' as const : 'failed' as const, occurredAt: event.refund.successTime ?? event.createTime,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      evidence: event.summary });
  }

  private execute<T>(operation: (options: WechatPayClientOptions) => Promise<T>, mode: 'none' | 'read'): Promise<T> {
    return this.executor.run((deadline) => operation({ signal: deadline.signal, deadline: deadline.expiresAt }), {
      mode, retryable: (cause) => cause instanceof WechatPayProtocolError && cause.retryable,
    });
  }

  private resolve(context: Readonly<{ scene: WechatScene; applicationHash: string }>) {
    const application = this.applications.get(context.scene);
    if (digest(application.appId) !== context.applicationHash) throw new WechatPayProtocolError('WECHAT_PAY_APPLICATION_CONTEXT_MISMATCH');
    return application;
  }
}

function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)

function receipt(source: string, providerRequestId: string | null, effect: Readonly<Record<string, unknown>>): ProviderReceiptEvidence {
  return Object.freeze({ version: 1, provider: 'wechat', source, providerRequestId, effect: Object.freeze({ ...effect }) });
}

function refundObservation(source: string, providerRequestId: string | null, refund: Readonly<{
  refundId: string; outRefundNo: string; transactionId: string; status: 'SUCCESS' | 'CLOSED' | 'PROCESSING' | 'ABNORMAL'; successTime: string | null;
  amount: Readonly<{ total: number; refund: number; currency: 'CNY' }>;
}>) {
  const state = refund.status === 'SUCCESS' ? 'succeeded' as const : refund.status === 'PROCESSING' ? 'processing' as const : 'failed' as const;
  const occurredAt = refund.successTime === null ? undefined : providerOccurredAt(refund.successTime);
  if (state === 'succeeded' && occurredAt === undefined) throw new WechatPayProtocolError('WECHAT_PAY_REFUND_SUCCESS_TIME_REQUIRED');
  return Object.freeze({ state, reference: refund.refundId, ...(occurredAt ? { occurredAt } : {}),
    evidence: receipt(source, providerRequestId, { outRefundNo: refund.outRefundNo, transaction: refund.transactionId, refund: refund.refundId,
      refundState: refund.status, occurredAt: occurredAt ?? null, amountMinor: refund.amount.refund, totalMinor: refund.amount.total,
      currency: refund.amount.currency }) });
}
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
