import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { QueryResult } from 'pg';
export type { EntitlementInput } from '../CapabilityPort';
export interface ChannelCapabilityPort {
  save(database: OperationDatabase, input: import('../CapabilityPort').EntitlementInput): Promise<QueryResult<Readonly<Record<string, unknown>>>>;
}
export const CHANNEL_CAPABILITY_PORT = publicPort<ChannelCapabilityPort>('capability', 'channel');
export { NAVIGATION_CAPABILITY_PORT, type NavigationCapability, type NavigationCapabilityPort } from './NavigationCapabilityPort';
