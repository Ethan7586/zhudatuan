import type { WechatPayConfig } from './wechatPayConfig';
import { decryptWechatPayResource, sha256Hex } from './wechatPayCrypto';
import { parseWechatPayTransaction, WechatPayProtocolError, type WechatPayTransaction } from './wechatPayModels';
import { verifyWechatPaySignedBody, type WechatPaySignatureHeaders } from './wechatPaySignature';

export interface VerifiedWechatPayNotification {
  notificationId: string;
  eventType: 'TRANSACTION.SUCCESS';
  createTime: string;
  resourceType: string;
  transaction: WechatPayTransaction;
  payerOpenidHash: string;
  summary: WechatPayNotificationSummary;
}

export interface WechatPayNotificationSummary {
  notificationId: string;
  eventType: 'TRANSACTION.SUCCESS';
  createTime: string;
  resourceType: string;
  transactionId: string;
  outTradeNo: string;
  tradeState: 'SUCCESS';
  successTime: string;
  totalCents: number;
  currency: 'CNY';
}

export interface ExpectedWechatPayment {
  outTradeNo: string;
  totalCents: number;
  payerOpenid: string;
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
  let plaintext: string;
  try {
    plaintext = await decryptWechatPayResource(config.apiV3Key, envelope.resource.ciphertext, envelope.resource.nonce, envelope.resource.associatedData);
  } catch {
    throw new WechatPayProtocolError('WECHAT_PAY_NOTIFICATION_DECRYPTION_FAILED');
  }
  const transaction = parseWechatPayTransaction(parseJson(plaintext));
  if (transaction.appId !== config.appId || transaction.mchId !== config.mchId) {
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
  eventType: 'TRANSACTION.SUCCESS';
  createTime: string;
  resourceType: string;
  resource: {
    algorithm: 'AEAD_AES_256_GCM';
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
  if (eventType !== 'TRANSACTION.SUCCESS') throw new WechatPayProtocolError('WECHAT_PAY_NOTIFICATION_EVENT_UNSUPPORTED');
  if (resourceType !== 'encrypt-resource' || originalType !== 'transaction') {
    throw new WechatPayProtocolError('WECHAT_PAY_NOTIFICATION_RESOURCE_TYPE_UNSUPPORTED');
  }
  if (algorithm !== 'AEAD_AES_256_GCM') throw new WechatPayProtocolError('WECHAT_PAY_NOTIFICATION_ALGORITHM_UNSUPPORTED');
  const ciphertext = requiredString(resource.ciphertext, 60_000, 'WECHAT_PAY_NOTIFICATION_CIPHERTEXT_INVALID');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(ciphertext)) {
    throw new WechatPayProtocolError('WECHAT_PAY_NOTIFICATION_CIPHERTEXT_INVALID');
  }
  return {
    id: requiredPrintable(record.id, 128, 'WECHAT_PAY_NOTIFICATION_ID_INVALID'),
    eventType: 'TRANSACTION.SUCCESS',
    createTime: requiredString(record.create_time, 64, 'WECHAT_PAY_NOTIFICATION_CREATE_TIME_INVALID'),
    resourceType,
    resource: {
      algorithm: 'AEAD_AES_256_GCM',
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

function asRecord(value: unknown, code: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new WechatPayProtocolError(code);
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, maximum: number, code: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) throw new WechatPayProtocolError(code);
  return value;
}

function requiredPrintable(value: unknown, maximum: number, code: string): string {
  const text = requiredString(value, maximum, code);
  if (!/^[\x20-\x7e]+$/.test(text)) throw new WechatPayProtocolError(code);
  return text;
}

function printableString(value: unknown, maximum: number, code: string): string {
  if (typeof value !== 'string' || value.length > maximum || (value.length > 0 && !/^[\x20-\x7e]+$/.test(value))) {
    throw new WechatPayProtocolError(code);
  }
  return value;
}
