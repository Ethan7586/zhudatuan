import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';

import { publicPort } from '../../../composition/ModuleRegistry';

export interface NavigationAccess {
  readonly membership: string;
  readonly permissions: ReadonlySet<string>;
  readonly version: number;
}

export interface NavigationAccessPort {
  read(context: ReadTransactionContext, memberships: readonly string[]): Promise<readonly NavigationAccess[]>;
}

export const NAVIGATION_ACCESS_PORT = publicPort<NavigationAccessPort>('access', 'navigation');
