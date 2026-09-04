import type { WechatPayConfig } from './wechatPayConfig';
import { epochSeconds, notificationSignatureMessage, verifyRsaSha256 } from './wechatPayCrypto';
import { WechatPayProtocolError } from './wechatPayModels';

const DEFAULT_SIGNATURE_TOLERANCE_SECONDS = 300;

export interface WechatPaySignatureHeaders {
  timestamp: string;
  nonce: string;
  signature: string;
  serial: string;
}

export function readWechatPaySignatureHeaders(headers: Headers): WechatPaySignatureHeaders {
  return {
    timestamp: requiredHeader(headers, 'wechatpay-timestamp'),
    nonce: requiredHeader(headers, 'wechatpay-nonce'),
    signature: requiredHeader(headers, 'wechatpay-signature'),
    serial: requiredHeader(headers, 'wechatpay-serial'),
  };
}

export async function verifyWechatPaySignedBody(config: WechatPayConfig, headers: Headers | WechatPaySignatureHeaders, body: string, options: { nowMs?: number; toleranceSeconds?: number } = {}): Promise<WechatPaySignatureHeaders> {
  const values = headers instanceof Headers ? readWechatPaySignatureHeaders(headers) : headers;
  if (values.serial !== config.platformKeyId) {
    throw new WechatPayProtocolError('WECHAT_PAY_PLATFORM_KEY_ID_MISMATCH');
  }
  const timestamp = parseTimestamp(values.timestamp);
  const tolerance = options.toleranceSeconds ?? DEFAULT_SIGNATURE_TOLERANCE_SECONDS;
  if (!Number.isSafeInteger(tolerance) || tolerance < 0 || tolerance > 3600) {
    throw new WechatPayProtocolError('WECHAT_PAY_SIGNATURE_TOLERANCE_INVALID');
  }
  if (Math.abs(epochSeconds(options.nowMs) - timestamp) > tolerance) {
    throw new WechatPayProtocolError('WECHAT_PAY_SIGNATURE_TIMESTAMP_STALE');
  }
  if (!/^[\x21-\x7e]{1,128}$/.test(values.nonce)) {
    throw new WechatPayProtocolError('WECHAT_PAY_SIGNATURE_NONCE_INVALID');
  }
  const valid = await verifyRsaSha256(config.platformPublicKeyPem, notificationSignatureMessage(values.timestamp, values.nonce, body), values.signature);
  if (!valid) throw new WechatPayProtocolError('WECHAT_PAY_SIGNATURE_INVALID');
  return values;
}

function requiredHeader(headers: Headers, name: string): string {
  const value = headers.get(name);
  if (!value || value.length > 1024) throw new WechatPayProtocolError('WECHAT_PAY_SIGNATURE_HEADERS_MISSING');
  return value;
}

function parseTimestamp(value: string): number {
  if (!/^\d{10}$/.test(value)) throw new WechatPayProtocolError('WECHAT_PAY_SIGNATURE_TIMESTAMP_INVALID');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new WechatPayProtocolError('WECHAT_PAY_SIGNATURE_TIMESTAMP_INVALID');
  return parsed;
}
