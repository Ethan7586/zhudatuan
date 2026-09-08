import { createHash } from 'node:crypto';
import { DomainError } from '../../../../platform/error/DomainError';

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export class CartToken {
  readonly digest: string;

  private constructor(value: string) {
    this.digest = createHash('sha256').update(value, 'utf8').digest('hex');
    Object.freeze(this);
  }

  static optional(value: string | undefined): CartToken | null {
    if (value === undefined) return null;
    if (!TOKEN.test(value)) throw new DomainError('VALIDATION_FAILED', { field: 'x-cart-token' });
    return new CartToken(value);
  }

  static required(value: string | undefined): CartToken {
    return CartToken.optional(value) ?? fail();
  }
}

function fail(): never {
  throw new DomainError('VALIDATION_FAILED', { field: 'x-cart-token' });
}
