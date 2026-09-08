import { DomainError } from '../../../../platform/error/DomainError';

export function mallPersistenceError(cause: unknown): unknown {
  if (cause instanceof DomainError) return cause;
  const constraint = cause !== null && typeof cause === 'object' && Reflect.get(cause, 'code') === '23505' ? String(Reflect.get(cause, 'constraint') ?? '') : '';
  if (constraint === 'organization_mall_code_unique') return new DomainError('VALIDATION_FAILED', { field: 'code' });
  if (constraint === 'organization_mall_slug_unique') return new DomainError('VALIDATION_FAILED', { field: 'publicSlug' });
  if (constraint === 'organization_mall_domain_unique') return new DomainError('VALIDATION_FAILED', { field: 'customDomain' });
  return cause;
}
