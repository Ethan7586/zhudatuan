import type { Decision, DecisionEvidence, DenialReason } from './Decision';
import { permissionDefinition } from './PermissionCatalog';
import type { Scope, ScopeGrant } from './Scope';
import type { ScopeKind } from './ScopeKind';

// 平台与分销层挂在租户边界之上，其 scope_object 投影不带 tenant；这两类授权由层级锚点判定，
// 其余授权必须租户双向精确匹配，缺失即拒绝。
const TENANT_SPANNING_KINDS: readonly ScopeKind[] = Object.freeze(['platform', 'distributor']);

export interface MembershipAccess {
  readonly id: string;
  readonly active: boolean;
  readonly accessVersion: number;
  readonly denies: readonly string[];
  readonly grants: readonly ScopeGrant[];
}

export interface DecisionContext {
  readonly expectedAccessVersion: number;
  readonly now: Date;
  readonly stepupAt?: Date;
  readonly stepupSeconds?: number;
}

export function decide(membership: MembershipAccess, permission: string, resource: Scope, context: DecisionContext): Decision {
  const permissionFailure = precheck(membership, permission, context);
  if (permissionFailure !== null) return { allowed: false, reason: permissionFailure };
  const scoped = checkScope(membership, permission, resource, context.now);
  if ('reason' in scoped) return { allowed: false, reason: scoped.reason };
  const assuranceFailure = checkAssurance(permission, context);
  if (assuranceFailure !== null) return { allowed: false, reason: assuranceFailure };
  return { allowed: true, evidence: scoped.evidence };
}

export function precheck(membership: MembershipAccess, permission: string, context: Pick<DecisionContext, 'expectedAccessVersion' | 'now'>): DenialReason | null {
  if (!membership.active) return 'MEMBERSHIP_INACTIVE';
  if (membership.accessVersion !== context.expectedAccessVersion) return 'ACCESS_VERSION_STALE';
  if (membership.denies.includes(permission)) return 'EXPLICIT_DENY';
  permissionDefinition(permission);
  return membership.grants.some((grant) => hasPermission(grant, permission) && isEffective(grant, context.now)) ? null : 'PERMISSION_MISSING';
}

export function checkScope(membership: MembershipAccess, permission: string, resource: Scope, now: Date): Readonly<{ evidence: DecisionEvidence }> | Readonly<{ reason: DenialReason }> {
  const definition = permissionDefinition(permission);
  if (!definition.scopes.includes(resource.kind)) return { reason: 'SCOPE_KIND_DENIED' };
  const grant = membership.grants.find((candidate) => hasPermission(candidate, permission) && isEffective(candidate, now) && contains(candidate.scope, resource));
  if (!grant) return { reason: 'SCOPE_DENIED' };
  return { evidence: { membership: membership.id, permission, scope: grant.scope, accessVersion: membership.accessVersion } };
}

export function checkAssurance(permission: string, context: Pick<DecisionContext, 'now' | 'stepupAt' | 'stepupSeconds'>): DenialReason | null {
  return permissionDefinition(permission).stepup && !freshStepup(context) ? 'STEPUP_REQUIRED' : null;
}

function hasPermission(grant: ScopeGrant, permission: string): boolean {
  return grant.permissions.includes(permission);
}

function isEffective(grant: ScopeGrant, now: Date): boolean {
  const time = now.getTime();
  return new Date(grant.effective).getTime() <= time && (grant.expires === null || new Date(grant.expires).getTime() > time);
}

function contains(grant: Scope, resource: Scope): boolean {
  if (grant.kind === 'self') return resource.kind === 'self' && grant.id === resource.id;
  if (grant.kind === 'owner') return resource.kind === 'owner' && grant.id === resource.id;
  if (!TENANT_SPANNING_KINDS.includes(grant.kind)
    && (grant.tenant === undefined || resource.tenant === undefined || resource.tenant !== grant.tenant)) return false;
  return (grant.kind === resource.kind && grant.id === resource.id)
    || resource.path.some((ancestor) => ancestor.kind === grant.kind && ancestor.id === grant.id);
}

function freshStepup(context: Pick<DecisionContext, 'now' | 'stepupAt' | 'stepupSeconds'>): boolean {
  if (context.stepupAt === undefined) return false;
  const age = context.now.getTime() - context.stepupAt.getTime();
  return age >= 0 && age <= (context.stepupSeconds ?? 900) * 1_000;
}
