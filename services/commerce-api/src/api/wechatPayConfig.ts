export interface WechatPayConfigSource {
  WECHAT_MINIAPP_APP_ID?: string;
  WECHAT_PAY_MCH_ID?: string;
  WECHAT_PAY_MERCHANT_SERIAL_NO?: string;
  WECHAT_PAY_MERCHANT_PRIVATE_KEY?: string;
  WECHAT_PAY_API_V3_KEY?: string;
  WECHAT_PAY_PLATFORM_PUBLIC_KEY?: string;
  WECHAT_PAY_PLATFORM_KEY_ID?: string;
  WECHAT_PAY_NOTIFY_URL?: string;
}

export interface WechatPayConfig {
  appId: string;
  mchId: string;
  merchantSerialNo: string;
  merchantPrivateKeyPem: string;
  apiV3Key: string;
  platformPublicKeyPem: string;
  platformKeyId: string;
  notifyUrl: string;
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
  const appId = required(source.WECHAT_MINIAPP_APP_ID, 'WECHAT_MINIAPP_APP_ID_MISSING');
  const mchId = required(source.WECHAT_PAY_MCH_ID, 'WECHAT_PAY_MCH_ID_MISSING');
  const merchantSerialNo = required(source.WECHAT_PAY_MERCHANT_SERIAL_NO, 'WECHAT_PAY_MERCHANT_SERIAL_NO_MISSING');
  const merchantPrivateKeyPem = normalizePem(required(source.WECHAT_PAY_MERCHANT_PRIVATE_KEY, 'WECHAT_PAY_MERCHANT_PRIVATE_KEY_MISSING'));
  const apiV3Key = source.WECHAT_PAY_API_V3_KEY;
  const platformPublicKeyPem = normalizePem(required(source.WECHAT_PAY_PLATFORM_PUBLIC_KEY, 'WECHAT_PAY_PLATFORM_PUBLIC_KEY_MISSING'));
  const platformKeyId = required(source.WECHAT_PAY_PLATFORM_KEY_ID, 'WECHAT_PAY_PLATFORM_KEY_ID_MISSING');
  const notifyUrl = required(source.WECHAT_PAY_NOTIFY_URL, 'WECHAT_PAY_NOTIFY_URL_MISSING');

  if (!/^wx[A-Za-z0-9]{16}$/.test(appId)) fail('WECHAT_MINIAPP_APP_ID_INVALID');
  if (!/^\d{6,32}$/.test(mchId)) fail('WECHAT_PAY_MCH_ID_INVALID');
  if (!/^[A-Fa-f0-9]{16,64}$/.test(merchantSerialNo)) fail('WECHAT_PAY_MERCHANT_SERIAL_NO_INVALID');
  if (!isPkcs8PrivateKey(merchantPrivateKeyPem)) fail('WECHAT_PAY_MERCHANT_PRIVATE_KEY_FORMAT_UNSUPPORTED');
  if (typeof apiV3Key !== 'string' || new TextEncoder().encode(apiV3Key).byteLength !== 32) {
    fail('WECHAT_PAY_API_V3_KEY_INVALID');
  }
  if (!isSpkiPublicKey(platformPublicKeyPem)) fail('WECHAT_PAY_PLATFORM_PUBLIC_KEY_FORMAT_UNSUPPORTED');
  if (!isPlatformKeyId(platformKeyId)) fail('WECHAT_PAY_PLATFORM_KEY_ID_INVALID');

  return {
    appId,
    mchId,
    merchantSerialNo,
    merchantPrivateKeyPem,
    apiV3Key,
    platformPublicKeyPem,
    platformKeyId,
    notifyUrl: validateNotifyUrl(notifyUrl),
  };
}

function required(value: string | undefined, code: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(code);
  return value.trim();
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
  try {
    url = new URL(value);
  } catch {
    fail('WECHAT_PAY_NOTIFY_URL_INVALID');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) fail('WECHAT_PAY_NOTIFY_URL_INVALID');
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || isPrivateIpv4(url.hostname)) {
    fail('WECHAT_PAY_NOTIFY_URL_NOT_PUBLIC');
  }
  return url.toString();
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
}

function fail(code: string): never {
  throw new WechatPayConfigurationError(code);
}
