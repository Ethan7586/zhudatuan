import { DomainError } from '../../../../foundation/domain/DomainError';
import { createHmac } from 'node:crypto';
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const NORMALIZED = /^[0-9A-HJKMNP-TV-Z]{33}$/;

export class InvitationCode {
  readonly #value: string;
  private constructor(value: string) {
    this.#value = value;
    Object.freeze(this);
  }

  static parse(input: unknown): InvitationCode {
    if (typeof input !== 'string') throw new DomainError('INVITATION_INVALID');
    const value = input.toUpperCase().replaceAll('-', '');
    if (!NORMALIZED.test(value) || checksum(value.slice(0, -1)) !== value.at(-1)) throw new DomainError('INVITATION_INVALID');
    return new InvitationCode(value);
  }

  static issue(entropy: Uint8Array): InvitationCode {
    if (entropy.byteLength < 20) throw new Error('INVITATION_ENTROPY_INSUFFICIENT');
    const payload = base32(entropy).slice(0, 32);
    return new InvitationCode(`${payload}${checksum(payload)}`);
  }

  display(): string {
    return this.#value.match(/.{1,4}/g)!.join('-');
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

function base32(bytes: Uint8Array): string {
  let bits = 0;
  let buffer = 0;
  let result = '';
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += ALPHABET[(buffer >>> bits) & 31];
    }
  }
  if (bits > 0) result += ALPHABET[(buffer << (5 - bits)) & 31];
  return result;
}

function checksum(value: string): string {
  let sum = 0;
  for (const character of value) sum = (sum * 33 + ALPHABET.indexOf(character)) % ALPHABET.length;
  return ALPHABET[sum]!;
}
