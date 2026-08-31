import { DomainError } from '../../../../foundation/domain/DomainError';
import { permissionDefinition } from '@shop/authz';

export class PermissionPolicy {
  assertSubset(issuer: ReadonlySet<string>, denied: ReadonlySet<string>, target: readonly string[]): void {
    for (const code of target) {
      let delegatable = false;
      try {
        delegatable = permissionDefinition(code).delegatable;
      } catch {
        throw new DomainError('DELEGATION_DENIED');
      }
      if (!delegatable || denied.has(code) || !issuer.has(code)) throw new DomainError('DELEGATION_DENIED');
    }
  }
}
