import type { WechatPayConfig } from './wechatPayConfig';

const RSA_ALGORITHM = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } as const;

export interface MerchantAuthorizationInput {
  method: string;
  canonicalUrl: string;
  body: string;
  timestamp: string;
  nonce: string;
}

export interface MiniappPaymentParameters {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA';
  paySign: string;
}

export function merchantSignatureMessage(input: MerchantAuthorizationInput): string {
  return `${input.method.toUpperCase()}\n${input.canonicalUrl}\n${input.timestamp}\n${input.nonce}\n${input.body}\n`;
}

export function notificationSignatureMessage(timestamp: string, nonce: string, body: string): string {
  return `${timestamp}\n${nonce}\n${body}\n`;
}

export function miniappSignatureMessage(appId: string, timeStamp: string, nonceStr: string, packageValue: string): string {
  return `${appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;
}

export async function createMerchantAuthorization(config: WechatPayConfig, input: MerchantAuthorizationInput): Promise<string> {
  const signature = await signRsaSha256(config.merchantPrivateKeyPem, merchantSignatureMessage(input));
  return 'WECHATPAY2-SHA256-RSA2048 ' + `mchid="${config.mchId}",nonce_str="${input.nonce}",signature="${signature}",` + `timestamp="${input.timestamp}",serial_no="${config.merchantSerialNo}"`;
}

export async function createMiniappPaymentParameters(config: WechatPayConfig, prepayId: string, options: { nowMs?: number; nonce?: string } = {}): Promise<MiniappPaymentParameters> {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(prepayId)) throw new Error('WECHAT_PAY_PREPAY_ID_INVALID');
  const timeStamp = epochSeconds(options.nowMs).toString();
  const nonceStr = options.nonce ?? createWechatPayNonce();
  if (!/^[A-Za-z0-9]{8,32}$/.test(nonceStr)) throw new Error('WECHAT_PAY_NONCE_INVALID');
  const packageValue = `prepay_id=${prepayId}`;
  const paySign = await signRsaSha256(config.merchantPrivateKeyPem, miniappSignatureMessage(config.appId, timeStamp, nonceStr, packageValue));
  return { timeStamp, nonceStr, package: packageValue, signType: 'RSA', paySign };
}

export async function signRsaSha256(privateKeyPem: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('pkcs8', pemToArrayBuffer(privateKeyPem, 'PRIVATE KEY'), RSA_ALGORITHM, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, toArrayBuffer(encode(message)));
  return bytesToBase64(new Uint8Array(signature));
}

export async function verifyRsaSha256(publicKeyPem: string, message: string, signatureBase64: string): Promise<boolean> {
  let signature: Uint8Array;
  try {
    signature = base64ToBytes(signatureBase64);
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey('spki', pemToArrayBuffer(publicKeyPem, 'PUBLIC KEY'), RSA_ALGORITHM, false, ['verify']);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, toArrayBuffer(signature), toArrayBuffer(encode(message)));
}

export async function decryptWechatPayResource(apiV3Key: string, ciphertextBase64: string, nonce: string, associatedData: string): Promise<string> {
  const keyBytes = encode(apiV3Key);
  if (keyBytes.byteLength !== 32) throw new Error('WECHAT_PAY_API_V3_KEY_INVALID');
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(keyBytes), 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(encode(nonce)),
      additionalData: toArrayBuffer(encode(associatedData)),
      tagLength: 128,
    },
    key,
    toArrayBuffer(base64ToBytes(ciphertextBase64))
  );
  return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(encode(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createWechatPayNonce(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export function epochSeconds(nowMs = Date.now()): number {
  if (!Number.isFinite(nowMs) || nowMs < 0) throw new Error('WECHAT_PAY_CLOCK_INVALID');
  return Math.floor(nowMs / 1000);
}

function pemToArrayBuffer(pem: string, label: 'PRIVATE KEY' | 'PUBLIC KEY'): ArrayBuffer {
  const begin = `-----BEGIN ${label}-----`;
  const end = `-----END ${label}-----`;
  if (!pem.startsWith(begin) || !pem.endsWith(end)) throw new Error(`WECHAT_PAY_${label.replace(' ', '_')}_INVALID`);
  const base64 = pem.slice(begin.length, -end.length).replace(/\s/g, '');
  return toArrayBuffer(base64ToBytes(base64));
}

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) throw new Error('WECHAT_PAY_BASE64_INVALID');
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}
