import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface NavigationAccess {
  readonly membership: string;
  readonly permissions: ReadonlySet<string>;
  readonly version: number;
}

export interface NavigationAccessPort {
  read(database: DatabasePool, memberships: readonly string[]): Promise<readonly NavigationAccess[]>;
}

export const NAVIGATION_ACCESS_PORT = publicPort<NavigationAccessPort>('access', 'navigation');
