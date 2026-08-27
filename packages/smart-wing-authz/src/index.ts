import { PERMISSION_CATALOG, type AuthorizationDecision, type Membership, type Permission, type ResourceScope, type ScopeBinding } from '@smart-wing/api-contract';

/** Critical actions always require a recent identity verification. */
export const HIGH_RISK_PERMISSIONS = new Set<Permission>(PERMISSION_CATALOG.filter((permission) => permission.risk === 'critical').map((permission) => permission.code));

export function isActiveMembership(membership: Membership, now = new Date()): boolean {
  return membership.status === 'active' && (!membership.expiresAt || new Date(membership.expiresAt) > now);
}

export function requiresStepUp(permission: Permission): boolean {
  return HIGH_RISK_PERMISSIONS.has(permission);
}

/**
 * Pure authorization decision. commerce-api must load resourceScope from its
 * own database row before calling this function; it must never use request
 * parameters as a scope source.
 */
export function decide(membership: Membership, permission: Permission, resourceScope: ResourceScope, options: { stepUpAt?: string | null; now?: Date; stepUpMaxAgeSeconds?: number } = {}): AuthorizationDecision {
  const now = options.now ?? new Date();
  if (!isActiveMembership(membership, now)) return { allowed: false, reason: 'MEMBERSHIP_INACTIVE' };
  if (membership.deniedPermissions?.includes(permission)) return { allowed: false, reason: 'PERMISSION_DENIED' };
  if (!membership.permissions.includes(permission)) return { allowed: false, reason: 'PERMISSION_MISSING' };
  const tenantMismatch = membership.context.tenantId !== resourceScope.tenantId;
  const binding = membership.scopeBindings.find((candidate) => scopeMatches(candidate, membership, resourceScope) && (!tenantMismatch || isCrossTenantHierarchyBinding(candidate)));
  // A cross-tenant decision is only possible through a server-validated global
  // hierarchy binding. Tenant and lower-level bindings remain hard isolated.
  if (tenantMismatch && !isCrossTenantHierarchyBinding(binding)) return { allowed: false, reason: 'TENANT_MISMATCH' };
  if (requiresStepUp(permission) && !hasFreshStepUp(options.stepUpAt, now, options.stepUpMaxAgeSeconds ?? 15 * 60)) {
    return { allowed: false, reason: 'STEP_UP_REQUIRED' };
  }
  if (!binding) return { allowed: false, reason: 'SCOPE_MISMATCH' };

  return {
    allowed: true,
    reason: 'ALLOWED',
    evidence: { membershipId: membership.id, roleIds: membership.roleIds, permission, scope: binding },
  };
}

export function can(membership: Membership, permission: Permission, resourceScope: ResourceScope, options?: { stepUpAt?: string | null; now?: Date; stepUpMaxAgeSeconds?: number }): boolean {
  return decide(membership, permission, resourceScope, options).allowed;
}

function hasFreshStepUp(stepUpAt: string | null | undefined, now: Date, maximumAgeSeconds: number): boolean {
  if (!stepUpAt) return false;
  const timestamp = new Date(stepUpAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= now.getTime() && now.getTime() - timestamp <= maximumAgeSeconds * 1_000;
}

function scopeMatches(binding: ScopeBinding, membership: Membership, resource: ResourceScope): boolean {
  if (isHierarchicalScopeKind(binding.kind) && resource.orgUnitPath?.some((ancestor) => ancestor.kind === binding.kind && ancestor.resourceId === binding.resourceId)) return true;
  switch (binding.kind) {
    case 'platform':
      return false;
    case 'tenant':
      return resource.tenantId === binding.resourceId;
    case 'enterprise':
      return resource.enterpriseId === binding.resourceId;
    case 'mall':
      return resource.mallId === binding.resourceId;
    case 'supplier':
      return resource.supplierId === binding.resourceId;
    case 'distributor':
      return resource.distributorId === binding.resourceId;
    case 'brand':
      return resource.brandId === binding.resourceId;
    case 'store':
      return resource.storeId === binding.resourceId;
    case 'department':
      return resource.departmentId === binding.resourceId;
    case 'self':
      return membership.context.userId === binding.resourceId && resource.ownerUserId === binding.resourceId;
  }
}

function isCrossTenantHierarchyBinding(binding: ScopeBinding | undefined): boolean {
  return binding?.kind === 'platform' || binding?.kind === 'distributor';
}

function isHierarchicalScopeKind(kind: ScopeBinding['kind']): boolean {
  return ['platform', 'tenant', 'distributor', 'enterprise', 'mall', 'department'].includes(kind);
}
