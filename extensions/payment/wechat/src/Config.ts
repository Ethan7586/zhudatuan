import { isPrivateIpv4Host } from '@shop/config/server';

export interface WechatPayPlatformKeySource {
  readonly id?: string;
  readonly publicKeyPem?: string;
  readonly active?: boolean;
}

export interface WechatPayConfigSource {
  readonly mchId?: string;
  readonly merchantSerialNo?: string;
  readonly merchantPrivateKeyPem?: string;
  readonly apiV3Key?: string;
  readonly notifyUrl?: string;
  readonly platformKeys?: readonly WechatPayPlatformKeySource[];
}

export interface WechatPayPlatformKey {
  readonly id: string;
  readonly publicKeyPem: string;
  readonly active: boolean;
}

export interface WechatPayConfig {
  readonly mchId: string;
  readonly merchantSerialNo: string;
  readonly merchantPrivateKeyPem: string;
  readonly apiV3Key: string;
  readonly notifyUrl: string;
  readonly platformKeys: readonly WechatPayPlatformKey[];
}

export class WechatPayConfigurationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super('WeChat Pay is not safely configured');
    this.name = 'WechatPayConfigurationError';
    this.code = code;
  }
}

export function loadWechatPayConfig(source: WechatPayConfigSource): WechatPayConfig {
  exactKeys(source, ['apiV3Key', 'mchId', 'merchantPrivateKeyPem', 'merchantSerialNo', 'notifyUrl', 'platformKeys']);
  const mchId = required(source.mchId, 'WECHAT_PAY_MCH_ID_MISSING');
  const merchantSerialNo = required(source.merchantSerialNo, 'WECHAT_PAY_MERCHANT_SERIAL_NO_MISSING');
  const merchantPrivateKeyPem = normalizePem(required(source.merchantPrivateKeyPem, 'WECHAT_PAY_MERCHANT_PRIVATE_KEY_MISSING'));
  const apiV3Key = source.apiV3Key;
  const notifyUrl = required(source.notifyUrl, 'WECHAT_PAY_NOTIFY_URL_MISSING');
  if (!/^\d{6,32}$/.test(mchId)) fail('WECHAT_PAY_MCH_ID_INVALID');
  if (!/^[A-Fa-f0-9]{16,64}$/.test(merchantSerialNo)) fail('WECHAT_PAY_MERCHANT_SERIAL_NO_INVALID');
  if (!isPkcs8PrivateKey(merchantPrivateKeyPem)) fail('WECHAT_PAY_MERCHANT_PRIVATE_KEY_FORMAT_UNSUPPORTED');
  if (typeof apiV3Key !== 'string' || new TextEncoder().encode(apiV3Key).byteLength !== 32) fail('WECHAT_PAY_API_V3_KEY_INVALID');
  if (!Array.isArray(source.platformKeys) || source.platformKeys.length < 1 || source.platformKeys.length > 8) {
    fail('WECHAT_PAY_PLATFORM_KEYS_INVALID');
  }
  const platformKeys = source.platformKeys.map(parsePlatformKey);
  if (new Set(platformKeys.map((key) => key.id)).size !== platformKeys.length || platformKeys.filter((key) => key.active).length !== 1) {
    fail('WECHAT_PAY_PLATFORM_KEYS_INVALID');
  }
  return Object.freeze({
    mchId,
    merchantSerialNo,
    merchantPrivateKeyPem,
    apiV3Key,
    notifyUrl: validateNotifyUrl(notifyUrl),
    platformKeys: Object.freeze(platformKeys),
  });
}

export function activeWechatPayPlatformKey(config: WechatPayConfig): WechatPayPlatformKey {
  const key = config.platformKeys.find((candidate) => candidate.active);
  if (!key) fail('WECHAT_PAY_PLATFORM_KEYS_INVALID');
  return key;
}

export function findWechatPayPlatformKey(config: WechatPayConfig, id: string): WechatPayPlatformKey | undefined {
  return config.platformKeys.find((candidate) => candidate.id === id);
}

function parsePlatformKey(source: WechatPayPlatformKeySource): WechatPayPlatformKey {
  exactKeys(source, ['active', 'id', 'publicKeyPem']);
  const id = required(source.id, 'WECHAT_PAY_PLATFORM_KEY_ID_MISSING');
  const publicKeyPem = normalizePem(required(source.publicKeyPem, 'WECHAT_PAY_PLATFORM_PUBLIC_KEY_MISSING'));
  if (!isPlatformKeyId(id)) fail('WECHAT_PAY_PLATFORM_KEY_ID_INVALID');
  if (!isSpkiPublicKey(publicKeyPem)) fail('WECHAT_PAY_PLATFORM_PUBLIC_KEY_FORMAT_UNSUPPORTED');
  if (typeof source.active !== 'boolean') fail('WECHAT_PAY_PLATFORM_KEYS_INVALID');
  return Object.freeze({ id, publicKeyPem, active: source.active });
}

function required(value: string | undefined, code: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(code);
  return value.trim();
}

function exactKeys(source: object, expected: readonly string[]): void {
  if (Object.keys(source).sort().join(',') !== [...expected].sort().join(',')) fail('WECHAT_PAY_CONFIGURATION_SHAPE_INVALID');
}

function normalizePem(value: string): string {
  return value.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
}

function isPkcs8PrivateKey(value: string): boolean {
  return /^-----BEGIN PRIVATE KEY-----\n[A-Za-z0-9+/=\n]+\n-----END PRIVATE KEY-----$/.test(value);
}

function isSpkiPublicKey(value: string): boolean {
  return /^-----BEGIN PUBLIC KEY-----\n[A-Za-z0-9+/=\n]+\n-----END PUBLIC KEY-----$/.test(value);
}

function isPlatformKeyId(value: string): boolean {
  return /^[A-Fa-f0-9]{16,64}$/.test(value) || /^PUB_KEY_ID_[A-Za-z0-9_-]{8,80}$/.test(value);
}

function validateNotifyUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { fail('WECHAT_PAY_NOTIFY_URL_INVALID'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
    || url.pathname !== '/api/v1/webhooks/wechat/payment') fail('WECHAT_PAY_NOTIFY_URL_INVALID');
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || isPrivateIpv4Host(url.hostname)) fail('WECHAT_PAY_NOTIFY_URL_NOT_PUBLIC');
  return url.toString();
}

function fail(code: string): never {
  throw new WechatPayConfigurationError(code);
}
