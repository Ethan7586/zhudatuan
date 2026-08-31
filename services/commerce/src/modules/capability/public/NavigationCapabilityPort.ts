import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface NavigationCapability {
  readonly scope: string;
  readonly capabilities: ReadonlySet<string>;
  readonly version: number;
}
export interface NavigationCapabilityPort {
  read(database: DatabasePool, scopes: readonly string[]): Promise<readonly NavigationCapability[]>;
}
export const NAVIGATION_CAPABILITY_PORT = publicPort<NavigationCapabilityPort>('capability', 'navigation');
