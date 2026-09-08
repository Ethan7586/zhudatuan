import { DomainError } from '../../../../platform/error/DomainError';
export class ScopePolicy {
  assertAllowed(value: boolean): void {
    if (!value) throw new DomainError('DELEGATION_DENIED');
  }
}
