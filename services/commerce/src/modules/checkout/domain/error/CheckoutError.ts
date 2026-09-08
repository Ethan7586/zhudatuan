import { DomainError } from '../../../../platform/error/DomainError';

export function quoteConflict(): never {
  throw new DomainError('VERSION_CONFLICT');
}

export function quoteExpired(): never {
  throw new DomainError('PRICE_QUOTE_EXPIRED');
}
