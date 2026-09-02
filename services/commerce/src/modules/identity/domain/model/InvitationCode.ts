import { createHmac } from 'node:crypto';
import { DomainError } from '../../../../foundation/domain/DomainError';

const NORMALIZED = /^[A-Za-z0-9_-]{32}$/;

export class InvitationCode {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
    Object.freeze(this);
  }

  static parse(input: unknown): InvitationCode {
    if (typeof input !== 'string') throw new DomainError('INVITATION_INVALID');
    const value = input.replaceAll(/\s/g, '');
    if (!NORMALIZED.test(value)) throw new DomainError('INVITATION_INVALID');
    return new InvitationCode(value);
  }

  static issue(entropy: Uint8Array): InvitationCode {
    if (entropy.byteLength !== 24) throw new Error('INVITATION_ENTROPY_INVALID');
    return new InvitationCode(Buffer.from(entropy).toString('base64url'));
  }

  display(): string {
    return this.#value.match(/.{1,4}/g)!.join(' ');
  }

  hmac(key: string): Buffer {
    return createHmac('sha256', key).update(this.#value).digest();
  }

  toString(): string {
    return '[REDACTED]';
  }

  toJSON(): string {
    return '[REDACTED]';
  }
}
