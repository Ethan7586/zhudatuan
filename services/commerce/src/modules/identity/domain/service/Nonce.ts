import { createHash, randomBytes } from 'node:crypto';
export class Nonce {
  issue(bytes = 32): string {
    if (!Number.isSafeInteger(bytes) || bytes < 16 || bytes > 64) throw new Error('NONCE_SIZE_INVALID');
    return randomBytes(bytes).toString('base64url');
  }
  hash(value: string): Buffer {
    if (!/^[A-Za-z0-9_-]{20,256}$/.test(value)) throw new Error('NONCE_INVALID');
    return createHash('sha256').update(value).digest();
  }
}
