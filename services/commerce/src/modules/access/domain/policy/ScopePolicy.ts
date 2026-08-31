import { DomainError } from '../../../../foundation/domain/DomainError';
export class ScopePolicy {
  assertAllowed(value: boolean): void {
    if (!value) throw new DomainError('DELEGATION_DENIED');
  }
}
