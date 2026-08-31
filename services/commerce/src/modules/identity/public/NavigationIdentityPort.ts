import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface NavigationIdentity {
  readonly principal: string;
  readonly membership: string;
  readonly membershipStatus: string;
  readonly accessVersion: number;
  readonly assurance: number;
}

export interface NavigationIdentityPort {
  read(database: DatabasePool, principal: string, membership: string): Promise<NavigationIdentity>;
}

export const NAVIGATION_IDENTITY_PORT = publicPort<NavigationIdentityPort>('identity', 'navigation');
