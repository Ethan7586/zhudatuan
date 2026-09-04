import { activeWechatPayPlatformKey, type WechatPayConfig } from './Config';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { createMerchantAuthorization, createWechatPayNonce, epochSeconds } from './Crypto';
import { WechatPayProtocolError } from './Models';
import { verifyWechatPaySignedBody } from './Signature';

const API_ORIGIN = 'https://api.mch.weixin.qq.com';
const MAX_RESPONSE_BYTES = 64 * 1024;

export interface WechatPayClientOptions {
  fetcher?: typeof fetch;
  nowMs?: number;
  nonce?: string;
  signal?: AbortSignal;
  deadline?: number;
}

export async function requestWechatPayJson(config: WechatPayConfig, canonicalUrl: string, method: 'GET' | 'POST', body: string, options: WechatPayClientOptions): Promise<{ value: unknown; providerRequestId: string | null }> {
  const result = await send(config, canonicalUrl, method, body, options);
  const value = parseProviderJson(result.body);
  if (!result.ok) throw providerResponseError(result.status, value, result.providerRequestId);
  return { value, providerRequestId: result.providerRequestId };
}

export async function requestWechatPayNoContent(config: WechatPayConfig, canonicalUrl: string, body: string, options: WechatPayClientOptions): Promise<{ providerRequestId: string | null }> {
  const result = await send(config, canonicalUrl, 'POST', body, options);
  if (!result.ok) {
    throw providerResponseError(result.status, parseProviderJson(result.body), result.providerRequestId);
  }
  if (result.status !== 204 || result.body !== '') {
    throw new WechatPayProtocolError('WECHAT_PAY_NO_CONTENT_RESPONSE_INVALID', {
      retryable: true,
      providerRequestId: result.providerRequestId,
    });
  }
  return { providerRequestId: result.providerRequestId };
}

async function send(
  config: WechatPayConfig,
  canonicalUrl: string,
  method: 'GET' | 'POST',
  body: string,
  options: WechatPayClientOptions
): Promise<{
  ok: boolean;
  status: number;
  body: string;
  providerRequestId: string | null;
}> {
  const timestamp = epochSeconds(options.nowMs).toString();
  const nonce = options.nonce ?? createWechatPayNonce();
  if (!/^[A-Za-z0-9]{8,32}$/.test(nonce)) {
    throw new WechatPayProtocolError('WECHAT_PAY_NONCE_INVALID');
  }
  const authorization = await createMerchantAuthorization(config, {
    method,
    canonicalUrl,
    body,
    timestamp,
    nonce,
  });
  const platformKey = activeWechatPayPlatformKey(config);
  let response: Response;
  const expires = Math.min(options.deadline ?? Number.MAX_SAFE_INTEGER, Date.now() + RUNTIME_LIMITS.external.totalDeadlineMilliseconds);
  const timeout = AbortSignal.timeout(Math.max(1, expires - Date.now()));
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    response = await (options.fetcher ?? fetch)(`${API_ORIGIN}${canonicalUrl}`, {
      method,
      headers: {
        accept: 'application/json',
        authorization,
        'wechatpay-serial': platformKey.id,
        ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body } : {}),
      redirect: 'error',
      signal,
    });
  } catch (cause) {
    if (signal.aborted && (options.signal?.aborted || Date.now() >= expires)) {
      throw new WechatPayProtocolError('WECHAT_PAY_DEADLINE_EXCEEDED', { retryable: true });
    }
    throw new WechatPayProtocolError('WECHAT_PAY_NETWORK_ERROR', { retryable: true });
  }
  const rawBody = await readBoundedBody(response);
  await verifyWechatPaySignedBody(config, response.headers, rawBody, options.nowMs === undefined ? {} : { nowMs: options.nowMs });
  return {
    ok: response.ok,
    status: response.status,
    body: rawBody,
    providerRequestId: boundedHeader(response.headers.get('request-id')),
  };
}

async function readBoundedBody(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new WechatPayProtocolError('WECHAT_PAY_RESPONSE_TOO_LARGE', { retryable: true });
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
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

function boundedHeader(value: string | null): string | null {
  return value && value.length <= 128 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
