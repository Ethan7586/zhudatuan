import { createHmac, createPrivateKey, sign } from 'node:crypto';

import type { VendorAuthInput, VendorAuthenticator } from './Auth';

function canonical(input: VendorAuthInput): string {
  return [input.method.toUpperCase(), input.path, input.timestamp, input.nonce, input.body].join('\n');
}

export class HmacAuthenticator implements VendorAuthenticator {
  constructor(private readonly keyId: string, private readonly secret: string, private readonly algorithm: 'sha256' | 'sha512' = 'sha256') {
    if (!keyId.trim() || !secret.trim()) throw new Error('VENDOR_HMAC_SECRET_INVALID');
  }

  authenticate(input: VendorAuthInput): Promise<Readonly<Record<string, string>>> {
    const signature = createHmac(this.algorithm, this.secret).update(canonical(input)).digest('base64');
    return Promise.resolve(Object.freeze({
      'x-key-id': this.keyId,
      'x-signature': signature,
      'x-timestamp': input.timestamp,
      'x-nonce': input.nonce,
    }));
  }
}

export class RsaAuthenticator implements VendorAuthenticator {
  private readonly key;

  constructor(private readonly keyId: string, privateKey: string) {
    if (!keyId.trim() || !privateKey.trim()) throw new Error('VENDOR_RSA_SECRET_INVALID');
    this.key = createPrivateKey(privateKey);
  }

  authenticate(input: VendorAuthInput): Promise<Readonly<Record<string, string>>> {
    const signature = sign('RSA-SHA256', Buffer.from(canonical(input)), this.key).toString('base64');
    return Promise.resolve(Object.freeze({
      'x-key-id': this.keyId,
      'x-signature': signature,
      'x-timestamp': input.timestamp,
      'x-nonce': input.nonce,
    }));
  }
}
