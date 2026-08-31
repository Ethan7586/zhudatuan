import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { AccessOrganizationPort } from '../../../organization/public';
import type { AccessPartnerPort } from '../../../partner/public';
import { GrantPlan, type GrantPermission, type GrantRole, type GrantScope } from '../../domain/model/GrantPlan';
import type { AccessRepository, DelegationPermission, DelegationRole, DelegationScope, DelegationTarget } from '../port/AccessRepository';
import type { AuthorizationRepository } from '../port/AuthorizationRepository';

export interface InvitationPlanInput {
  readonly issuer: string;
  readonly membership: string | null;
  readonly organization: string | null;
  readonly target: 'console' | 'storefront';
  readonly kind: 'signin' | 'enrollment' | 'campaign';
  readonly policy: string | null;
  readonly termsHash: string | null;
  readonly expectedVersion?: number;
  readonly expiresAt?: Date;
}
export interface BuiltGrant {
  readonly plan: GrantPlan;
  readonly issuerVersion: number;
  readonly issuerAllows: readonly string[];
  readonly issuerDenies: readonly string[];
  readonly scopeAllowed: boolean;
}

export class CreateInvitationGrant {
  constructor(
    private readonly organizations: AccessOrganizationPort,
    private readonly partners: AccessPartnerPort,
    private readonly repository: AccessRepository,
    private readonly authorization: AuthorizationRepository
  ) {}

  async execute(database: OperationDatabase, input: InvitationPlanInput): Promise<BuiltGrant> {
    const issuer = await this.repository.lockDelegationIssuer(database, input.issuer);
    if (!issuer) throw new DomainError('MEMBERSHIP_INACTIVE');
    if (input.membership === input.issuer) throw new DomainError('DELEGATION_DENIED');
    const target = input.membership === null ? null : await this.repository.delegationTarget(database, input.membership);
    const organization = input.organization ?? target?.organization ?? null;
    if (!organization || (target && target.organization !== organization)) throw new DomainError('MEMBERSHIP_NOT_INVITED');
    const organizationScope = await this.organizations.invitationScope(database, organization);
    const partnerScope = organizationScope ? null : await this.partners.invitationScope(database, organization);
    if ((!organizationScope && !partnerScope) || (input.kind === 'campaign' && organizationScope?.kind !== 'mall')) {
      throw new DomainError('DELEGATION_DENIED');
    }
    assertTarget(input, target);

    const roles = await this.roles(database, input, target);
    if (roles.length === 0) throw new DomainError('DELEGATION_DENIED');
    assertExpiry(
      roles.map((role) => role.expiresAt),
      input.expiresAt
    );
    const permissionsRead = this.repository.delegationPermissions(
      database,
      roles.map((role) => role.id)
    );
    const grantsRead = input.membership === null ? Promise.resolve(Object.freeze([])) : this.repository.delegationScopes(database, input.membership);
    const permissionsReadForIssuer = this.authorization.permissions(database, input.issuer);
    const scopesReadForIssuer = this.authorization.scopes(database, input.issuer);
    const [permissions, grants, effectivePermissions, effectiveScopes] = await Promise.all([permissionsRead, grantsRead, permissionsReadForIssuer, scopesReadForIssuer]);
    assertExpiry(
      grants.map((grant) => grant.expiresAt),
      input.expiresAt
    );
    const allows = effectivePermissions.filter(({ effect }) => effect === 'allow').map(({ permission }) => permission);
    const denies = effectivePermissions.filter(({ effect }) => effect === 'deny').map(({ permission }) => permission);
    const scopeAllowed = await this.organizations.delegationAllowed(database, {
      organization: organizationScope?.id ?? partnerScope!.organization,
      allows: effectiveScopes.filter(({ effect }) => effect === 'allow').map(({ scope }) => scope),
      denies: effectiveScopes.filter(({ effect }) => effect === 'deny').map(({ scope }) => scope),
    });
    const plan = new GrantPlan(
      input.target,
      organization,
      target?.id ?? null,
      target?.principal ?? null,
      roles.map(roleView),
      permissions.map(permissionView),
      input.membership === null ? [campaignScope(organization)] : grants.map(scopeView),
      input.target === 'console' ? 2 : 1,
      input.policy,
      input.termsHash
    );
    return Object.freeze({ plan, issuerVersion: issuer.accessVersion, issuerAllows: Object.freeze(allows), issuerDenies: Object.freeze(denies), scopeAllowed });
  }

  private roles(database: OperationDatabase, input: InvitationPlanInput, target: DelegationTarget | null): Promise<readonly DelegationRole[]> {
    if (input.kind === 'campaign') return this.repository.campaignRoles(database);
    if (!target) throw new DomainError('MEMBERSHIP_NOT_INVITED');
    return this.repository.delegationRoles(database, target.id);
  }
}

function canonicalClient(value: string): 'console' | 'storefront' {
  return value === 'storefront' ? 'storefront' : 'console';
}
function assertTarget(input: InvitationPlanInput, target: DelegationTarget | null): void {
  if (input.kind === 'campaign') {
    if (target !== null || input.target !== 'storefront') throw new DomainError('DELEGATION_DENIED');
    return;
  }
  if (!target || !target.principal || canonicalClient(target.client) !== input.target) throw new DomainError('MEMBERSHIP_NOT_INVITED');
  if ((input.kind === 'signin' && target.status !== 'active') || (input.kind === 'enrollment' && target.status !== 'invited')) {
    throw new DomainError('MEMBERSHIP_NOT_INVITED');
  }
}
function assertExpiry(values: readonly (Date | null)[], expiresAt: Date | undefined): void {
  if (expiresAt && values.some((value) => value !== null && value.getTime() < expiresAt.getTime())) throw new DomainError('DELEGATION_DENIED');
}
function roleView(row: DelegationRole): GrantRole {
  return Object.freeze({ id: row.id, version: row.version, kind: row.kind, expiresAt: row.expiresAt?.toISOString() ?? null });
}
function permissionView(row: DelegationPermission): GrantPermission {
  return Object.freeze({ code: row.code, effect: row.effect, role: row.role, roleVersion: row.roleVersion });
}
function scopeView(row: DelegationScope): GrantScope {
  return Object.freeze({ id: row.id, kind: row.kind, scope: row.scope, path: row.path, effect: row.effect, version: row.accessVersion, effectiveAt: row.effectiveAt.toISOString(), expiresAt: row.expiresAt?.toISOString() ?? null });
}
function campaignScope(organization: string): GrantScope {
  return Object.freeze({ id: 'campaign', kind: 'mall', scope: organization, path: organization, effect: 'allow', version: 1, effectiveAt: 'campaign', expiresAt: null });
}
