import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export type { EntitlementInput } from './Entitlement';
export interface ChannelEntitlement {
  readonly id: string;
  readonly scopeId: string;
  readonly capabilityId: string;
  readonly state: 'enabled' | 'disabled';
  readonly quota: number | null;
  readonly effectiveAt: string;
  readonly expiresAt: string | null;
  readonly version: number;
}
export interface ChannelCapabilityPort {
  save(context: WriteTransactionContext, input: import('./Entitlement').EntitlementInput): Promise<ChannelEntitlement | null>;
}
export const CHANNEL_CAPABILITY_PORT = publicPort<ChannelCapabilityPort>('capability', 'channel');
export { NAVIGATION_CAPABILITY_PORT, type NavigationCapability, type NavigationCapabilityPort } from './NavigationCapabilityPort';
