import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';

import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { NavigationScopeKind } from '@shop/authz';

export interface NavigationScope {
  readonly membership: string;
  readonly id: string;
  readonly kind: NavigationScopeKind;
  readonly status: string;
  readonly version: number;
  readonly default: boolean;
}
export interface NavigationOrganizationPort {
  read(context: ReadTransactionContext, memberships: readonly string[]): Promise<readonly NavigationScope[]>;
}
export const NAVIGATION_ORGANIZATION_PORT = publicPort<NavigationOrganizationPort>('organization', 'navigation');
