import type { WechatPayConfig } from './wechatPayConfig';
import { notificationSignatureMessage, signRsaSha256 } from './wechatPayCrypto';

export interface WechatPayTestKeys {
  config: WechatPayConfig;
  merchantPublicKeyPem: string;
  platformPrivateKeyPem: string;
}

export async function createWechatPayTestKeys(): Promise<WechatPayTestKeys> {
  const [merchant, platform] = await Promise.all([createRsaPemPair(), createRsaPemPair()]);
  return {
    config: {
      appId: 'wx4df4137881a1d2bc',
      mchId: '1900000109',
      merchantSerialNo: '0123456789ABCDEF0123456789ABCDEF',
      merchantPrivateKeyPem: merchant.privateKeyPem,
      apiV3Key: '0123456789abcdef0123456789abcdef',
      platformPublicKeyPem: platform.publicKeyPem,
      platformKeyId: 'PUB_KEY_ID_TEST_PLATFORM_2026',
      notifyUrl: 'https://hbbtzn.com/api/v1/payments/wechat/notify',
    },
    merchantPublicKeyPem: merchant.publicKeyPem,
    platformPrivateKeyPem: platform.privateKeyPem,
  };
}

export async function signedProviderHeaders(keys: WechatPayTestKeys, body: string, timestamp = '1786665600', nonce = 'providerNonce1234'): Promise<Headers> {
  const signature = await signRsaSha256(keys.platformPrivateKeyPem, notificationSignatureMessage(timestamp, nonce, body));
  return new Headers({
    'content-type': 'application/json',
    'wechatpay-timestamp': timestamp,
    'wechatpay-nonce': nonce,
    'wechatpay-signature': signature,
    'wechatpay-serial': keys.config.platformKeyId,
    'request-id': 'wechat-provider-request-test',
  });
}

export async function encryptNotificationResource(apiV3Key: string, value: unknown, nonce = '0123456789ab', associatedData = 'transaction'): Promise<{ ciphertext: string; nonce: string; associated_data: string }> {
  const key = await crypto.subtle.importKey('raw', buffer(new TextEncoder().encode(apiV3Key)), 'AES-GCM', false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: buffer(new TextEncoder().encode(nonce)), additionalData: buffer(new TextEncoder().encode(associatedData)) },
    key,
    buffer(new TextEncoder().encode(JSON.stringify(value)))
  );
  return { ciphertext: toBase64(new Uint8Array(encrypted)), nonce, associated_data: associatedData };
}

async function createRsaPemPair(): Promise<{ privateKeyPem: string; publicKeyPem: string }> {
  const result = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
    },
    true,
    ['sign', 'verify']
  );
  if (!('privateKey' in result)) throw new Error('TEST_RSA_KEYPAIR_REQUIRED');
  const [privateBytes, publicBytes] = await Promise.all([crypto.subtle.exportKey('pkcs8', result.privateKey), crypto.subtle.exportKey('spki', result.publicKey)]);
  return {
    privateKeyPem: toPem('PRIVATE KEY', new Uint8Array(privateBytes)),
    publicKeyPem: toPem('PUBLIC KEY', new Uint8Array(publicBytes)),
  };
}

function toPem(label: string, bytes: Uint8Array): string {
  const base64 = toBase64(bytes);
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

function toBase64(bytes: Uint8Array): string {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function buffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}
