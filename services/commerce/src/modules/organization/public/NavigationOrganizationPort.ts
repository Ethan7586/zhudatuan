import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ConsoleScopeKind } from '@shop/authz';

export interface NavigationScope {
  readonly membership: string;
  readonly id: string;
  readonly kind: ConsoleScopeKind;
  readonly status: string;
  readonly version: number;
  readonly default: boolean;
}
export interface NavigationOrganizationPort {
  read(database: DatabasePool, memberships: readonly string[]): Promise<readonly NavigationScope[]>;
}
export const NAVIGATION_ORGANIZATION_PORT = publicPort<NavigationOrganizationPort>('organization', 'navigation');
