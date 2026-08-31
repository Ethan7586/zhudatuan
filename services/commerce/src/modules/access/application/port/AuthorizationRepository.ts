import type { Scope, ScopeGrant } from '@shop/authz';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { AuthorizationRole } from '../../../../foundation/security/AuthorizationSnapshot';

export interface AuthorizationSnapshotRecord {
  readonly membership: string;
  readonly active: boolean;
  readonly accessVersion: number;
  readonly credentialVersion: number;
  readonly organization: string;
  readonly target: 'console' | 'storefront';
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
  snapshot(database: OperationDatabase, input: Readonly<{ membership: string; target: 'console' | 'storefront'; operation: string; resource: string | null }>): Promise<AuthorizationSnapshotRecord | null>;
  navigation(database: OperationDatabase, memberships: readonly string[]): Promise<readonly NavigationAuthorizationRecord[]>;
  permissions(database: OperationDatabase, membership: string): Promise<readonly EffectivePermissionRecord[]>;
  scopes(database: OperationDatabase, membership: string): Promise<readonly EffectiveScopeRecord[]>;
}
