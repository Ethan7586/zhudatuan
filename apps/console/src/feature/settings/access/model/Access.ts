import { OP_ACCESS_OVERRIDES_MANAGE, OP_ACCESS_OWNERS_TRANSFER, OP_ACCESS_ROLES_MANAGE, OP_ACCESS_SCOPES_MANAGE } from '@shop/contract/ids';
import type { OperationId } from '@shop/contract';

export type AccessEffect = 'allow' | 'deny';
export type AccessScopeKind = 'platform' | 'distributor' | 'tenant' | 'enterprise' | 'mall' | 'department' | 'store' | 'supplier' | 'brand' | 'self' | 'owner';

export interface AccessRole {
  readonly id: string;
  readonly name: string;
  readonly kind: 'custom' | 'system' | 'owner';
  readonly version: number;
  readonly allows: readonly string[];
  readonly denies: readonly string[];
}

export interface AccessScope {
  readonly id: string;
  readonly kind: AccessScopeKind;
  readonly resource: string;
  readonly effect: AccessEffect;
  readonly expiresAt: string | null;
}

export interface AccessOverride {
  readonly permission: string;
  readonly effect: AccessEffect;
  readonly expiresAt: string | null;
}

export interface AccessMembership {
  readonly id: string;
  readonly displayName: string;
  readonly employeeNo: string | null;
  readonly mobileMasked: string | null;
  readonly client: 'console' | 'storefront';
  readonly status: 'invited' | 'active' | 'suspended' | 'left';
  readonly accessVersion: number;
  readonly roles: readonly AccessRole[];
  readonly scopes: readonly AccessScope[];
  readonly overrides: readonly AccessOverride[];
}

export interface AccessPage {
  readonly items: readonly AccessMembership[];
  readonly count: number;
  readonly nextCursor?: string;
}

export type AccessChange =
  | Readonly<{ kind: 'role'; membership: AccessMembership; role: AccessRole; name: string; allows: readonly string[]; denies: readonly string[] }>
  | Readonly<{ kind: 'override'; membership: AccessMembership; action: 'set' | 'revoke'; permission: string; effect: AccessEffect; expiresAt?: string; reason: string }>
  | Readonly<{ kind: 'scope'; membership: AccessMembership; scopeKind: AccessScopeKind; resource: string; effect: AccessEffect; expiresAt?: string }>
  | Readonly<{ kind: 'owner'; membership: AccessMembership; target: AccessMembership; reason: string }>;

export interface AccessEnvelope {
  readonly operation: OperationId;
  readonly input: Readonly<{ path?: Readonly<Record<string, string>>; body: Readonly<Record<string, unknown>> }>;
  readonly expectedVersion: number;
}

export interface AccessReceipt {
  readonly operation: OperationId;
  readonly reference: string;
  readonly version: number;
  readonly message: string;
}

export function accessEnvelope(change: AccessChange): AccessEnvelope {
  if (change.kind === 'role')
    return Object.freeze({
      operation: OP_ACCESS_ROLES_MANAGE,
      input: Object.freeze({ path: Object.freeze({ roleid: change.role.id }), body: Object.freeze({ name: change.name.trim(), allows: [...change.allows], denies: [...change.denies] }) }),
      expectedVersion: change.role.version,
    });
  if (change.kind === 'override') {
    const body =
      change.action === 'revoke'
        ? { action: 'revoke' as const, targetMembership: change.membership.id, permission: change.permission, reason: change.reason.trim() }
        : { action: 'set' as const, targetMembership: change.membership.id, permission: change.permission, effect: change.effect, ...(change.expiresAt ? { expiresAt: change.expiresAt } : {}), reason: change.reason.trim() };
    return Object.freeze({ operation: OP_ACCESS_OVERRIDES_MANAGE, input: Object.freeze({ body: Object.freeze(body) }), expectedVersion: change.membership.accessVersion });
  }
  if (change.kind === 'scope')
    return Object.freeze({
      operation: OP_ACCESS_SCOPES_MANAGE,
      input: Object.freeze({ body: Object.freeze({ targetMembership: change.membership.id, kind: change.scopeKind, scope: change.resource.trim(), effect: change.effect, ...(change.expiresAt ? { expiresAt: change.expiresAt } : {}) }) }),
      expectedVersion: change.membership.accessVersion,
    });
  return Object.freeze({
    operation: OP_ACCESS_OWNERS_TRANSFER,
    input: Object.freeze({ body: Object.freeze({ targetMembership: change.target.id, targetVersion: change.target.accessVersion, reason: change.reason.trim() }) }),
    expectedVersion: change.membership.accessVersion,
  });
}
