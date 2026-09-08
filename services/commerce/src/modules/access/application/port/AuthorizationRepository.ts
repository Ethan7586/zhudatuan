import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { Scope, ScopeGrant } from '@shop/authz';

import type { AuthorizationRole } from '../../../../platform/security/AuthorizationSnapshot';

export interface AuthorizationSnapshotRecord {
  readonly membership: string;
  readonly active: boolean;
  readonly accessVersion: number;
  readonly credentialVersion: number;
  readonly organization: string;
  readonly target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
  readonly roles: readonly AuthorizationRole[];
  readonly allows: readonly string[];
  readonly denies: readonly string[];
  readonly scopes: readonly ScopeGrant[];
  readonly resource: Scope;
  readonly operations: readonly string[];
  readonly capabilityVersion: number;
}

export interface NavigationAuthorizationRecord {
  readonly membership: string;
  readonly permission: string | null;
  readonly effect: 'allow' | 'deny' | null;
  readonly accessVersion: number;
}

export interface EffectivePermissionRecord {
  readonly permission: string;
  readonly effect: 'allow' | 'deny';
}

export interface EffectiveScopeRecord {
  readonly scope: string;
  readonly effect: 'allow' | 'deny';
}

export interface AuthorizationRepository {
  snapshot(
    context: ReadTransactionContext,
    input: Readonly<{ membership: string; target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'; operation: string; resource: string | null }>
  ): Promise<AuthorizationSnapshotRecord | null>;
  navigation(context: ReadTransactionContext, memberships: readonly string[]): Promise<readonly NavigationAuthorizationRecord[]>;
  permissions(context: ReadTransactionContext, membership: string): Promise<readonly EffectivePermissionRecord[]>;
  scopes(context: ReadTransactionContext, membership: string): Promise<readonly EffectiveScopeRecord[]>;
}
