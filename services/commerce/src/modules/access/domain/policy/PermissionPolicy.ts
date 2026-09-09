import { DomainError } from '../../../../platform/error/DomainError';
import { canDelegatePermissions } from '@shop/authz';

export class PermissionPolicy {
  assertSubset(issuer: ReadonlySet<string>, denied: ReadonlySet<string>, target: readonly string[]): void {
    if (!canDelegatePermissions(issuer, denied, target)) throw new DomainError('DELEGATION_DENIED');
  }
}
