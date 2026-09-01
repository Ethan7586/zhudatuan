import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';

import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface NavigationAccess {
  readonly membership: string;
  readonly permissions: ReadonlySet<string>;
  readonly version: number;
}

export interface NavigationAccessPort {
  read(context: ReadTransactionContext, memberships: readonly string[]): Promise<readonly NavigationAccess[]>;
}

export const NAVIGATION_ACCESS_PORT = publicPort<NavigationAccessPort>('access', 'navigation');
