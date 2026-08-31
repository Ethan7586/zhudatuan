import { DomainError } from '../../../../foundation/domain/DomainError';

export function cartConflict(): never {
  throw new DomainError('VERSION_CONFLICT');
}

export function cartInvalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}

export function listingUnavailable(): never {
  throw new DomainError('LISTING_NOT_PURCHASABLE');
}
