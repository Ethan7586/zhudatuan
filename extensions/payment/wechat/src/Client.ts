import type { WechatPayConfig } from './Config';
import { isWechatPayOutRefundNo, isWechatPayOutTradeNo, parseWechatPayRefund, parseWechatPayTransaction, WechatPayProtocolError, type WechatPayRefund, type WechatPayTransaction } from './Models';
import { requestWechatPayJson, type WechatPayClientOptions } from './Transport';
export type { WechatPayClientOptions } from './Transport';

export interface WechatPayPrepayInput {
  appId: string;
  description: string;
  outTradeNo: string;
  totalCents: number;
  payerOpenid: string;
  expiresAt: string;
}

export interface WechatPayPrepayResult {
  prepayId: string;
  providerRequestId: string | null;
}

export interface WechatPayTransactionResult {
  transaction: WechatPayTransaction;
  providerRequestId: string | null;
}

export interface WechatPayRefundInput {
  outRefundNo: string;
  transactionId: string;
  refundCents: number;
  totalCents: number;
  reason: string;
}

export interface WechatPayRefundResult {
  refund: WechatPayRefund;
  providerRequestId: string | null;
}

export async function createJsapiPrepay(config: WechatPayConfig, input: WechatPayPrepayInput, options: WechatPayClientOptions = {}): Promise<WechatPayPrepayResult> {
  validatePrepayInput(input);
  const body = JSON.stringify({
    appid: input.appId,
    mchid: config.mchId,
    description: input.description,
    out_trade_no: input.outTradeNo,
    notify_url: config.notifyUrl,
    time_expire: input.expiresAt,
    amount: { total: input.totalCents, currency: 'CNY' },
    payer: { openid: input.payerOpenid },
  });
  const result = await requestWechatPayJson(config, '/v3/pay/transactions/jsapi', 'POST', body, options);
  const prepayId = readRequiredString(result.value, 'prepay_id', 'WECHAT_PAY_PREPAY_RESPONSE_INVALID');
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(prepayId)) throw new WechatPayProtocolError('WECHAT_PAY_PREPAY_ID_INVALID');
  return { prepayId, providerRequestId: result.providerRequestId };
}

export async function queryWechatPayTransaction(config: WechatPayConfig, appId: string, outTradeNo: string, options: WechatPayClientOptions = {}): Promise<WechatPayTransactionResult> {
  validateAppId(appId);
  if (!isWechatPayOutTradeNo(outTradeNo)) throw new WechatPayProtocolError('WECHAT_PAY_OUT_TRADE_NO_INVALID');
  const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(config.mchId)}`;
  const result = await requestWechatPayJson(config, path, 'GET', '', options);
  const transaction = parseWechatPayTransaction(result.value);
  assertProviderIdentity(config, appId, transaction);
  return { transaction, providerRequestId: result.providerRequestId };
}

export async function applyWechatPayRefund(config: WechatPayConfig, input: WechatPayRefundInput, options: WechatPayClientOptions = {}): Promise<WechatPayRefundResult> {
  validateRefundInput(input);
  const body = JSON.stringify({
    transaction_id: input.transactionId,
    out_refund_no: input.outRefundNo,
    reason: normalizeRefundReason(input.reason),
    notify_url: config.notifyUrl,
    amount: { refund: input.refundCents, total: input.totalCents, currency: 'CNY' },
  });
  const result = await requestWechatPayJson(config, '/v3/refund/domestic/refunds', 'POST', body, options);
  const refund = parseWechatPayRefund(result.value);
  assertRefundMatches(input, refund);
  return { refund, providerRequestId: result.providerRequestId };
}

export async function queryWechatPayRefund(config: WechatPayConfig, outRefundNo: string, options: WechatPayClientOptions = {}): Promise<WechatPayRefundResult> {
  if (!isWechatPayOutRefundNo(outRefundNo)) throw new WechatPayProtocolError('WECHAT_PAY_OUT_REFUND_NO_INVALID');
  const result = await requestWechatPayJson(config, `/v3/refund/domestic/refunds/${encodeURIComponent(outRefundNo)}`, 'GET', '', options);
  const refund = parseWechatPayRefund(result.value);
  if (refund.outRefundNo !== outRefundNo) throw new WechatPayProtocolError('WECHAT_PAY_OUT_REFUND_NO_MISMATCH');
  return { refund, providerRequestId: result.providerRequestId };
}

function validatePrepayInput(input: WechatPayPrepayInput): void {
  validateAppId(input.appId);
  const descriptionLength = Array.from(input.description).length;
  if (descriptionLength < 1 || descriptionLength > 127 || /[\u0000-\u001f\u007f]/.test(input.description)) {
    throw new WechatPayProtocolError('WECHAT_PAY_DESCRIPTION_INVALID');
  }
  if (!isWechatPayOutTradeNo(input.outTradeNo)) throw new WechatPayProtocolError('WECHAT_PAY_OUT_TRADE_NO_INVALID');
  if (!Number.isSafeInteger(input.totalCents) || input.totalCents <= 0) {
    throw new WechatPayProtocolError('WECHAT_PAY_TOTAL_INVALID');
  }
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(input.payerOpenid)) {
    throw new WechatPayProtocolError('WECHAT_PAY_PAYER_OPENID_INVALID');
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?[+-]\d{2}:\d{2}$/.test(input.expiresAt)
    || !Number.isFinite(Date.parse(input.expiresAt))) throw new WechatPayProtocolError('WECHAT_PAY_EXPIRES_AT_INVALID');
}

function validateRefundInput(input: WechatPayRefundInput): void {
  if (!isWechatPayOutRefundNo(input.outRefundNo)) throw new WechatPayProtocolError('WECHAT_PAY_OUT_REFUND_NO_INVALID');
  if (!/^[0-9A-Za-z_-]{6,64}$/.test(input.transactionId)) throw new WechatPayProtocolError('WECHAT_PAY_TRANSACTION_ID_INVALID');
  if (!Number.isSafeInteger(input.refundCents) || input.refundCents <= 0) throw new WechatPayProtocolError('WECHAT_PAY_REFUND_AMOUNT_INVALID');
  if (!Number.isSafeInteger(input.totalCents) || input.totalCents <= 0 || input.refundCents > input.totalCents) {
    throw new WechatPayProtocolError('WECHAT_PAY_REFUND_TOTAL_INVALID');
  }
  normalizeRefundReason(input.reason);
}

function normalizeRefundReason(value: string): string {
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const bounded = truncateUtf8(normalized, 80);
  if (!bounded) throw new WechatPayProtocolError('WECHAT_PAY_REFUND_REASON_INVALID');
  return bounded;
}

function truncateUtf8(value: string, maximumBytes: number): string {
  const encoder = new TextEncoder();
  let result = '';
  for (const codePoint of value) {
    if (encoder.encode(result + codePoint).byteLength > maximumBytes) break;
    result += codePoint;
  }
  return result;
}

function assertRefundMatches(input: WechatPayRefundInput, refund: WechatPayRefund): void {
  if (refund.outRefundNo !== input.outRefundNo) throw new WechatPayProtocolError('WECHAT_PAY_OUT_REFUND_NO_MISMATCH');
  if (refund.transactionId !== input.transactionId) throw new WechatPayProtocolError('WECHAT_PAY_TRANSACTION_ID_MISMATCH');
  if (refund.amount.refund !== input.refundCents || refund.amount.total !== input.totalCents) {
    throw new WechatPayProtocolError('WECHAT_PAY_REFUND_AMOUNT_MISMATCH');
  }
}

function assertProviderIdentity(config: WechatPayConfig, appId: string, transaction: WechatPayTransaction): void {
  if (transaction.appId !== appId || transaction.mchId !== config.mchId) {
    throw new WechatPayProtocolError('WECHAT_PAY_PROVIDER_IDENTITY_MISMATCH');
  }
}

function validateAppId(value: string): void {
  if (!/^wx[A-Za-z0-9]{16}$/.test(value)) throw new WechatPayProtocolError('WECHAT_APP_ID_INVALID');
}

function readRequiredString(value: unknown, key: string, code: string): string {
  if (!isRecord(value) || typeof value[key] !== 'string' || value[key].length === 0) {
    throw new WechatPayProtocolError(code);
  }
  return value[key];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
