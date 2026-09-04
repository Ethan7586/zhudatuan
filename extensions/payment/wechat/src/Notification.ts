import type { WechatPayConfig } from './Config';
import { decryptWechatPayResource, sha256Hex } from './Crypto';
import { isWechatPayOutRefundNo, isWechatPayOutTradeNo, parseWechatPayTransaction, WechatPayProtocolError, type WechatPayTransaction } from './Models';
import type {
  ExpectedWechatPayment,
  VerifiedWechatPayNotification,
  VerifiedWechatRefundNotification,
  WechatPayNotificationKind,
  WechatPayNotificationSummary,
  WechatRefundNotificationResource,
  WechatRefundNotificationSummary,
} from './NotificationModels';
import { verifyWechatPaySignedBody, type WechatPaySignatureHeaders } from './Signature';
export function readWechatPayNotificationKind(body: string): WechatPayNotificationKind {
  if (new TextEncoder().encode(body).byteLength > 64 * 1024) {
    throw new WechatPayProtocolError('WECHAT_PAY_NOTIFICATION_TOO_LARGE');
  }
  return parseEnvelope(parseJson(body)).resource.originalType as WechatPayNotificationKind;
}

export async function verifyAndDecryptWechatPayNotification(
  config: WechatPayConfig,
  input: { headers: Headers | WechatPaySignatureHeaders; body: string },
  options: { nowMs?: number; toleranceSeconds?: number } = {}
): Promise<VerifiedWechatPayNotification> {
  if (new TextEncoder().encode(input.body).byteLength > 64 * 1024) {
    throw new WechatPayProtocolError('WECHAT_PAY_NOTIFICATION_TOO_LARGE');
  }
  await verifyWechatPaySignedBody(config, input.headers, input.body, options);
  const envelope = parseEnvelope(parseJson(input.body));
  if (envelope.eventType !== 'TRANSACTION.SUCCESS' || envelope.resource.originalType !== 'transaction') {
    throw new WechatPayProtocolError('WECHAT_PAY_NOTIFICATION_EVENT_UNSUPPORTED');
  }
  let plaintext: string;
  try {
    plaintext = await decryptWechatPayResource(config.apiV3Key, envelope.resource.ciphertext, envelope.resource.nonce, envelope.resource.associatedData);
  } catch {
    throw new WechatPayProtocolError('WECHAT_PAY_NOTIFICATION_DECRYPTION_FAILED');
  }
  const transaction = parseWechatPayTransaction(parseJson(plaintext));
  if (transaction.mchId !== config.mchId) {
    throw new WechatPayProtocolError('WECHAT_PAY_PROVIDER_IDENTITY_MISMATCH');
  }
  if (transaction.tradeState !== 'SUCCESS' || !transaction.transactionId || !transaction.successTime || !transaction.payerOpenid) {
    throw new WechatPayProtocolError('WECHAT_PAY_NOTIFICATION_TRANSACTION_INVALID');
  }
  const payerOpenidHash = await sha256Hex(transaction.payerOpenid);
  const summary: WechatPayNotificationSummary = {
    notificationId: envelope.id,
    eventType: 'TRANSACTION.SUCCESS',
    createTime: envelope.createTime,
    resourceType: envelope.resourceType,
    transactionId: transaction.transactionId,
    outTradeNo: transaction.outTradeNo,
    tradeState: 'SUCCESS',
    successTime: transaction.successTime,
    totalCents: transaction.amount.total,
    currency: 'CNY',
  };
  return {
    notificationId: envelope.id,
    eventType: 'TRANSACTION.SUCCESS',
    createTime: envelope.createTime,
    resourceType: envelope.resourceType,
    transaction,
    payerOpenidHash,
    summary,
  };
}

export async function verifyAndDecryptWechatRefundNotification(
  config: WechatPayConfig,
  input: { headers: Headers | WechatPaySignatureHeaders; body: string },
  options: { nowMs?: number; toleranceSeconds?: number } = {}
): Promise<VerifiedWechatRefundNotification> {
  if (new TextEncoder().encode(input.body).byteLength > 64 * 1024) {
    throw new WechatPayProtocolError('WECHAT_PAY_NOTIFICATION_TOO_LARGE');
  }
  await verifyWechatPaySignedBody(config, input.headers, input.body, options);
  const envelope = parseEnvelope(parseJson(input.body));
  if (!['REFUND.SUCCESS', 'REFUND.ABNORMAL', 'REFUND.CLOSED'].includes(envelope.eventType) || envelope.resource.originalType !== 'refund') {
    throw new WechatPayProtocolError('WECHAT_PAY_REFUND_NOTIFICATION_EVENT_UNSUPPORTED');
  }
  let plaintext: string;
  try {
    plaintext = await decryptWechatPayResource(config.apiV3Key, envelope.resource.ciphertext, envelope.resource.nonce, envelope.resource.associatedData);
  } catch {
    throw new WechatPayProtocolError('WECHAT_PAY_NOTIFICATION_DECRYPTION_FAILED');
  }
  const decrypted = asRecord(parseJson(plaintext), 'WECHAT_PAY_REFUND_NOTIFICATION_INVALID');
  const mchId = requiredString(decrypted.mchid, 64, 'WECHAT_PAY_MCH_ID_INVALID');
  if (mchId !== config.mchId) throw new WechatPayProtocolError('WECHAT_PAY_PROVIDER_IDENTITY_MISMATCH');
  const refund = parseWechatRefundNotificationResource(decrypted);
  const expectedStatus = envelope.eventType.slice('REFUND.'.length);
  if (refund.status !== expectedStatus) {
    throw new WechatPayProtocolError('WECHAT_PAY_REFUND_NOTIFICATION_STATUS_MISMATCH');
  }
  const eventType = envelope.eventType as VerifiedWechatRefundNotification['eventType'];
  const summary: WechatRefundNotificationSummary = {
    notificationId: envelope.id,
    eventType,
    createTime: envelope.createTime,
    resourceType: envelope.resourceType,
    mchId,
    refundId: refund.refundId,
    outRefundNo: refund.outRefundNo,
    transactionId: refund.transactionId,
    outTradeNo: refund.outTradeNo,
    refundStatus: refund.status,
    successTime: refund.successTime,
    refundCents: refund.amount.refund,
    totalCents: refund.amount.total,
    payerRefundCents: refund.amount.payerRefund,
    payerTotalCents: refund.amount.payerTotal,
  };
  return { notificationId: envelope.id, eventType, createTime: envelope.createTime, resourceType: envelope.resourceType, mchId, refund, summary };
}

export function assertWechatPayTransactionMatchesExpected(transaction: WechatPayTransaction, expected: ExpectedWechatPayment): void {
  if (transaction.outTradeNo !== expected.outTradeNo) {
    throw new WechatPayProtocolError('WECHAT_PAY_OUT_TRADE_NO_MISMATCH');
  }
  if (transaction.amount.total !== expected.totalCents) {
    throw new WechatPayProtocolError('WECHAT_PAY_AMOUNT_MISMATCH');
  }
  if (!transaction.payerOpenid || transaction.payerOpenid !== expected.payerOpenid) {
    throw new WechatPayProtocolError('WECHAT_PAY_PAYER_MISMATCH');
  }
}

interface NotificationEnvelope {
  id: string;
  eventType: string;
  createTime: string;
  resourceType: string;
  resource: {
    algorithm: 'AEAD_AES_256_GCM';
    originalType: string;
    ciphertext: string;
    associatedData: string;
    nonce: string;
  };
}

function parseEnvelope(value: unknown): NotificationEnvelope {
  const record = asRecord(value, 'WECHAT_PAY_NOTIFICATION_INVALID');
  const resource = asRecord(record.resource, 'WECHAT_PAY_NOTIFICATION_RESOURCE_INVALID');
  const eventType = requiredString(record.event_type, 80, 'WECHAT_PAY_NOTIFICATION_EVENT_TYPE_INVALID');
  const resourceType = requiredString(record.resource_type, 80, 'WECHAT_PAY_NOTIFICATION_RESOURCE_TYPE_INVALID');
  const originalType = requiredString(resource.original_type, 80, 'WECHAT_PAY_NOTIFICATION_ORIGINAL_TYPE_INVALID');
  const algorithm = requiredString(resource.algorithm, 40, 'WECHAT_PAY_NOTIFICATION_ALGORITHM_INVALID');
  const supported = (eventType === 'TRANSACTION.SUCCESS' && originalType === 'transaction') || (['REFUND.SUCCESS', 'REFUND.ABNORMAL', 'REFUND.CLOSED'].includes(eventType) && originalType === 'refund');
  if (resourceType !== 'encrypt-resource' || !supported) {
    throw new WechatPayProtocolError('WECHAT_PAY_NOTIFICATION_RESOURCE_TYPE_UNSUPPORTED');
  }
  if (algorithm !== 'AEAD_AES_256_GCM') throw new WechatPayProtocolError('WECHAT_PAY_NOTIFICATION_ALGORITHM_UNSUPPORTED');
  const ciphertext = requiredString(resource.ciphertext, 60_000, 'WECHAT_PAY_NOTIFICATION_CIPHERTEXT_INVALID');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(ciphertext)) {
    throw new WechatPayProtocolError('WECHAT_PAY_NOTIFICATION_CIPHERTEXT_INVALID');
  }
  return {
    id: requiredPrintable(record.id, 128, 'WECHAT_PAY_NOTIFICATION_ID_INVALID'),
    eventType,
    createTime: requiredString(record.create_time, 64, 'WECHAT_PAY_NOTIFICATION_CREATE_TIME_INVALID'),
    resourceType,
    resource: {
      algorithm: 'AEAD_AES_256_GCM',
      originalType,
      ciphertext,
      associatedData: printableString(resource.associated_data, 256, 'WECHAT_PAY_NOTIFICATION_ASSOCIATED_DATA_INVALID'),
      nonce: requiredPrintable(resource.nonce, 32, 'WECHAT_PAY_NOTIFICATION_NONCE_INVALID'),
    },
  };
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new WechatPayProtocolError('WECHAT_PAY_NOTIFICATION_JSON_INVALID');
  }
}

function parseWechatRefundNotificationResource(value: Record<string, unknown>): WechatRefundNotificationResource {
  const amount = asRecord(value.amount, 'WECHAT_PAY_REFUND_NOTIFICATION_AMOUNT_INVALID');
  const status = requiredString(value.refund_status, 32, 'WECHAT_PAY_REFUND_STATUS_INVALID');
  if (!['SUCCESS', 'ABNORMAL', 'CLOSED'].includes(status)) {
    throw new WechatPayProtocolError('WECHAT_PAY_REFUND_STATUS_UNSUPPORTED');
  }
  const outRefundNo = requiredString(value.out_refund_no, 64, 'WECHAT_PAY_OUT_REFUND_NO_INVALID');
  const outTradeNo = requiredString(value.out_trade_no, 32, 'WECHAT_PAY_OUT_TRADE_NO_INVALID');
  if (!isWechatPayOutRefundNo(outRefundNo) || !isWechatPayOutTradeNo(outTradeNo)) {
    throw new WechatPayProtocolError('WECHAT_PAY_REFUND_REFERENCE_INVALID');
  }
  const refund = requiredNonNegativeInteger(amount.refund, 'WECHAT_PAY_REFUND_AMOUNT_INVALID');
  const total = requiredNonNegativeInteger(amount.total, 'WECHAT_PAY_REFUND_TOTAL_INVALID');
  const payerRefund = requiredNonNegativeInteger(amount.payer_refund, 'WECHAT_PAY_REFUND_PAYER_AMOUNT_INVALID');
  const payerTotal = requiredNonNegativeInteger(amount.payer_total, 'WECHAT_PAY_REFUND_PAYER_TOTAL_INVALID');
  if (refund <= 0 || total <= 0 || refund > total || payerRefund > refund || payerTotal > total) {
    throw new WechatPayProtocolError('WECHAT_PAY_REFUND_AMOUNT_INVALID');
  }
  const successTime = optionalString(value.success_time, 'WECHAT_PAY_REFUND_SUCCESS_TIME_INVALID');
  if ((status === 'SUCCESS') !== (successTime !== null)) {
    throw new WechatPayProtocolError('WECHAT_PAY_REFUND_SUCCESS_INCOMPLETE');
  }
  return {
    refundId: requiredString(value.refund_id, 32, 'WECHAT_PAY_REFUND_ID_INVALID'),
    outRefundNo,
    transactionId: requiredString(value.transaction_id, 64, 'WECHAT_PAY_TRANSACTION_ID_INVALID'),
    outTradeNo,
    status: status as WechatRefundNotificationResource['status'],
    successTime,
    amount: { total, refund, payerTotal, payerRefund },
  };
}

function asRecord(value: unknown, code: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new WechatPayProtocolError(code);
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, maximum: number, code: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) throw new WechatPayProtocolError(code);
  return value;
}

function optionalString(value: unknown, code: string): string | null {
  if (value === undefined || value === null) return null;
  return requiredString(value, 128, code);
}

function requiredNonNegativeInteger(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new WechatPayProtocolError(code);
  return value as number;
}

function requiredPrintable(value: unknown, maximum: number, code: string): string {
  const text = requiredString(value, maximum, code);
  if (!/^[\x20-\x7e]+$/.test(text)) throw new WechatPayProtocolError(code);
  return text;
}

function printableString(value: unknown, maximum: number, code: string): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > maximum || (value.length > 0 && !/^[\x20-\x7e]+$/.test(value))) {
    throw new WechatPayProtocolError(code);
  }
  return value;
}
