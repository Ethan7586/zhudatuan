import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { LocalHttpError, canonicalRecord } from '../../localinfra/src/Http';

const KEY_REFERENCE = /^[a-z0-9][a-z0-9/.-]{2,255}$/;
const PREFIX = 'local:v1:';

export interface LocalEnvelope {
  readonly ciphertext: string;
  readonly fingerprint: string;
  readonly keyVersion: 'local-v1';
}

export class LocalKms {
  private readonly master: Buffer;

  constructor(master: string) {
    this.master = Buffer.from(master, 'base64url');
    if (this.master.byteLength !== 32) throw new Error('LOCAL_KMS_MASTER_KEY_INVALID');
  }

  encrypt(purpose: string, keyRef: string, plaintext: string, context: Readonly<Record<string, unknown>>): LocalEnvelope {
    this.validate(keyRef, plaintext);
    this.validatePurpose(purpose);
    const associated = Buffer.from(`${purpose}\n${keyRef}\n${canonicalRecord(context)}`);
    const initialization = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.derive('encryption', purpose, keyRef), initialization);
    cipher.setAAD(associated);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authentication = cipher.getAuthTag();
    return Object.freeze({
      ciphertext: `${PREFIX}${Buffer.concat([initialization, authentication, encrypted]).toString('base64url')}`,
      fingerprint: createHmac('sha256', this.derive('fingerprint', purpose, keyRef))
        .update(plaintext)
        .digest('hex'),
      keyVersion: 'local-v1',
    });
  }

  decrypt(purpose: string, keyRef: string, ciphertext: string, context: Readonly<Record<string, unknown>>): string {
    if (!KEY_REFERENCE.test(keyRef) || !ciphertext.startsWith(PREFIX)) throw new LocalHttpError(400, 'KMS_DECRYPT_INPUT_INVALID');
    this.validatePurpose(purpose);
    const payload = Buffer.from(ciphertext.slice(PREFIX.length), 'base64url');
    if (payload.byteLength < 29) throw new LocalHttpError(400, 'KMS_CIPHERTEXT_INVALID');
    const initialization = payload.subarray(0, 12);
    const authentication = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.derive('encryption', purpose, keyRef), initialization);
      decipher.setAAD(Buffer.from(`${purpose}\n${keyRef}\n${canonicalRecord(context)}`));
      decipher.setAuthTag(authentication);
      const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
      if (!plaintext) throw new Error('empty');
      return plaintext;
    } catch {
      throw new LocalHttpError(400, 'KMS_CIPHERTEXT_INVALID');
    }
  }

  private derive(operation: string, purpose: string, keyRef: string): Buffer {
    return createHmac('sha256', this.master).update(`${operation}:${purpose}:${keyRef}`).digest();
  }

  private validatePurpose(purpose: string): void {
    if (!['cachehmac', 'evidence', 'pii', 'providerconfig'].includes(purpose)) {
      throw new LocalHttpError(400, 'KMS_PURPOSE_INVALID');
    }
  }

  private validate(keyRef: string, plaintext: string): void {
    if (!KEY_REFERENCE.test(keyRef) || !plaintext || Buffer.byteLength(plaintext) > 1024 * 1024) {
      throw new LocalHttpError(400, 'KMS_ENCRYPT_INPUT_INVALID');
    }
  }
}
