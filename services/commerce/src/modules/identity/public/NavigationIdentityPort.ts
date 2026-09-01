import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';

import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface NavigationIdentity {
  readonly principal: string;
  readonly membership: string;
  readonly membershipStatus: string;
  readonly accessVersion: number;
  readonly assurance: number;
}

export interface NavigationIdentityPort {
  read(context: ReadTransactionContext, principal: string, membership: string): Promise<NavigationIdentity>;
}

export const NAVIGATION_IDENTITY_PORT = publicPort<NavigationIdentityPort>('identity', 'navigation');
