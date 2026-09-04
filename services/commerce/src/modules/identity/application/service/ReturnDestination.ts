import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ReturnTargetPort, SignedReturnTarget } from '../port/ReturnTargetPort';

export function returnDestination(returns: ReturnTargetPort, target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier', value: unknown): SignedReturnTarget {
  if (typeof value !== 'string') throw new DomainError('VALIDATION_FAILED', { field: 'returnTarget' });
  let destination: SignedReturnTarget;
  try {
    destination = returns.verify(value);
  } catch {
    throw new DomainError('VALIDATION_FAILED', { field: 'returnTarget' });
  }
  if (destination.target !== target) throw new DomainError('VALIDATION_FAILED', { field: 'returnTarget' });
  return destination;
}
