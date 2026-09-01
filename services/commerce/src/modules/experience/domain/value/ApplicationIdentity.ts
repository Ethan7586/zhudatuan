import { DomainError } from '../../../../foundation/domain/DomainError';
import { parseStorefrontHandle } from '@shop/contract';

export class ApplicationIdentity {
  readonly code: string;
  readonly publicSlug: string;

  constructor(code: string, publicSlug: string) {
    if (!/^[A-Z][A-Z0-9_]{2,31}$/.test(code)) throw new DomainError('VALIDATION_FAILED', { field: 'code' });
    try {
      parseStorefrontHandle(publicSlug);
    } catch {
      throw new DomainError('VALIDATION_FAILED', { field: 'publicSlug' });
    }
    this.code = code;
    this.publicSlug = publicSlug;
    Object.freeze(this);
  }
}
