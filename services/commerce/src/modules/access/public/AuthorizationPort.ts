import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import type { Scope, ScopeGrant } from '@shop/authz';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

import type { AuthorizationRole } from '../../../foundation/security/AuthorizationSnapshot';
export interface AuthorizationSnapshot {
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
export interface AuthorizationPort {
  read(
    context: ReadTransactionContext,
    input: Readonly<{
      membership: string;
      target: 'console' | 'storefront';
      operation: string;
      resource: string | null;
    }>
  ): Promise<AuthorizationSnapshot | null>;
}
export const AUTHORIZATION_PORT = publicPort<AuthorizationPort>('access', 'authorization');
