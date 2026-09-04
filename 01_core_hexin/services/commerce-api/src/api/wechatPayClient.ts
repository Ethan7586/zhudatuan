import type { WechatPayConfig } from './wechatPayConfig';
import { createMerchantAuthorization, createWechatPayNonce, epochSeconds } from './wechatPayCrypto';
import { isWechatPayOutTradeNo, parseWechatPayTransaction, WechatPayProtocolError, type WechatPayTransaction } from './wechatPayModels';
import { verifyWechatPaySignedBody } from './wechatPaySignature';

const WECHAT_PAY_API_ORIGIN = 'https://api.mch.weixin.qq.com';
const MAX_PROVIDER_RESPONSE_BYTES = 64 * 1024;

export interface WechatPayPrepayInput {
  description: string;
  outTradeNo: string;
  totalCents: number;
  payerOpenid: string;
}

export interface WechatPayPrepayResult {
  prepayId: string;
  providerRequestId: string | null;
}

export interface WechatPayTransactionResult {
  transaction: WechatPayTransaction;
  providerRequestId: string | null;
}

export interface WechatPayClientOptions {
  fetcher?: typeof fetch;
  nowMs?: number;
  nonce?: string;
}

export async function createJsapiPrepay(config: WechatPayConfig, input: WechatPayPrepayInput, options: WechatPayClientOptions = {}): Promise<WechatPayPrepayResult> {
  validatePrepayInput(input);
  const body = JSON.stringify({
    appid: config.appId,
    mchid: config.mchId,
    description: input.description,
    out_trade_no: input.outTradeNo,
    notify_url: config.notifyUrl,
    amount: { total: input.totalCents, currency: 'CNY' },
    payer: { openid: input.payerOpenid },
  });
  const result = await requestWechatPay(config, '/v3/pay/transactions/jsapi', 'POST', body, options);
  const prepayId = readRequiredString(result.value, 'prepay_id', 'WECHAT_PAY_PREPAY_RESPONSE_INVALID');
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(prepayId)) throw new WechatPayProtocolError('WECHAT_PAY_PREPAY_ID_INVALID');
  return { prepayId, providerRequestId: result.providerRequestId };
}

export async function queryWechatPayTransaction(config: WechatPayConfig, outTradeNo: string, options: WechatPayClientOptions = {}): Promise<WechatPayTransactionResult> {
  if (!isWechatPayOutTradeNo(outTradeNo)) throw new WechatPayProtocolError('WECHAT_PAY_OUT_TRADE_NO_INVALID');
  const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(config.mchId)}`;
  const result = await requestWechatPay(config, path, 'GET', '', options);
  const transaction = parseWechatPayTransaction(result.value);
  assertProviderIdentity(config, transaction);
  return { transaction, providerRequestId: result.providerRequestId };
}

async function requestWechatPay(config: WechatPayConfig, canonicalUrl: string, method: 'GET' | 'POST', body: string, options: WechatPayClientOptions): Promise<{ value: unknown; providerRequestId: string | null }> {
  const timestamp = epochSeconds(options.nowMs).toString();
  const nonce = options.nonce ?? createWechatPayNonce();
  validateNonce(nonce);
  const authorization = await createMerchantAuthorization(config, { method, canonicalUrl, body, timestamp, nonce });
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(`${WECHAT_PAY_API_ORIGIN}${canonicalUrl}`, {
      method,
      headers: {
        accept: 'application/json',
        authorization,
        'wechatpay-serial': config.platformKeyId,
        ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
      },
      body: method === 'POST' ? body : undefined,
      redirect: 'error',
    });
  } catch {
    throw new WechatPayProtocolError('WECHAT_PAY_NETWORK_ERROR', { retryable: true });
  }
  const rawBody = await readBoundedBody(response);
  await verifyWechatPaySignedBody(config, response.headers, rawBody, { nowMs: options.nowMs });
  const providerRequestId = boundedHeader(response.headers.get('request-id'));
  const value = parseProviderJson(rawBody);
  if (!response.ok) throw providerResponseError(response.status, value, providerRequestId);
  return { value, providerRequestId };
}

async function readBoundedBody(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_RESPONSE_BYTES) {
    throw new WechatPayProtocolError('WECHAT_PAY_RESPONSE_TOO_LARGE', { retryable: true });
  }
  if (!response.body) throw new WechatPayProtocolError('WECHAT_PAY_EMPTY_RESPONSE', { retryable: true });
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > MAX_PROVIDER_RESPONSE_BYTES) {
        await reader.cancel('provider response exceeded safe limit');
        throw new WechatPayProtocolError('WECHAT_PAY_RESPONSE_TOO_LARGE', { retryable: true });
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new WechatPayProtocolError('WECHAT_PAY_RESPONSE_ENCODING_INVALID', { retryable: true });
  }
}

function validatePrepayInput(input: WechatPayPrepayInput): void {
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
}

function providerResponseError(status: number, value: unknown, providerRequestId: string | null): WechatPayProtocolError {
  const record = isRecord(value) ? value : null;
  const providerCode = record && typeof record.code === 'string' ? record.code : 'UNKNOWN';
  const safeCode = providerCode.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 64) || 'UNKNOWN';
  return new WechatPayProtocolError(`WECHAT_PAY_PROVIDER_${safeCode}`, {
    retryable: status === 408 || status === 429 || status >= 500,
    providerRequestId,
  });
}

function parseProviderJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new WechatPayProtocolError('WECHAT_PAY_RESPONSE_JSON_INVALID', { retryable: true });
  }
}

function assertProviderIdentity(config: WechatPayConfig, transaction: WechatPayTransaction): void {
  if (transaction.appId !== config.appId || transaction.mchId !== config.mchId) {
    throw new WechatPayProtocolError('WECHAT_PAY_PROVIDER_IDENTITY_MISMATCH');
  }
}

function readRequiredString(value: unknown, key: string, code: string): string {
  if (!isRecord(value) || typeof value[key] !== 'string' || value[key].length === 0) {
    throw new WechatPayProtocolError(code);
  }
  return value[key];
}

function validateNonce(value: string): void {
  if (!/^[A-Za-z0-9]{8,32}$/.test(value)) throw new WechatPayProtocolError('WECHAT_PAY_NONCE_INVALID');
}

function boundedHeader(value: string | null): string | null {
  return value && value.length <= 128 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
