import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';

import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface NavigationCapability {
  readonly scope: string;
  readonly capabilities: ReadonlySet<string>;
  readonly version: number;
}
export interface NavigationCapabilityPort {
  read(context: ReadTransactionContext, scopes: readonly string[]): Promise<readonly NavigationCapability[]>;
}
export const NAVIGATION_CAPABILITY_PORT = publicPort<NavigationCapabilityPort>('capability', 'navigation');
