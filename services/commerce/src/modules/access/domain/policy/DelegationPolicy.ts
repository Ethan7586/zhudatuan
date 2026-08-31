import { DomainError } from '../../../../foundation/domain/DomainError';
import { OwnerPolicy } from './OwnerPolicy';
import { PermissionPolicy } from './PermissionPolicy';
import { ScopePolicy } from './ScopePolicy';

export class DelegationPolicy {
  constructor(
    private readonly owner = new OwnerPolicy(),
    private readonly permissions = new PermissionPolicy(),
    private readonly scopes = new ScopePolicy()
  ) {}
  assert(input: Readonly<{ roleKinds: readonly string[]; issuerPermissions: ReadonlySet<string>; issuerDenies: ReadonlySet<string>; targetPermissions: readonly string[]; scopeAllowed: boolean }>): void {
    this.owner.assertDelegatable(input.roleKinds);
    this.permissions.assertSubset(input.issuerPermissions, input.issuerDenies, ['access.role.delegate', 'access.scope.delegate']);
    this.permissions.assertSubset(input.issuerPermissions, input.issuerDenies, input.targetPermissions);
    this.scopes.assertAllowed(input.scopeAllowed);
  }
  assertCampaign(input: Readonly<{ roleKinds: readonly string[]; issuerPermissions: ReadonlySet<string>; issuerDenies: ReadonlySet<string>; targetPermissions: readonly string[]; scopeAllowed: boolean }>): void {
    this.permissions.assertSubset(input.issuerPermissions, input.issuerDenies, ['access.role.delegate', 'access.scope.delegate']);
    if (input.roleKinds.length === 0 || input.roleKinds.some((kind) => kind !== 'system')) throw new DomainError('DELEGATION_DENIED');
    this.permissions.assertSubset(input.issuerPermissions, input.issuerDenies, input.targetPermissions);
    this.scopes.assertAllowed(input.scopeAllowed);
  }
}
