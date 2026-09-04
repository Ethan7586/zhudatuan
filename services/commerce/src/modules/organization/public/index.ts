import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
export { IDENTITY_ORGANIZATION_PORT, type IdentityOrganizationPort } from './IdentityOrganizationPort';
export { ACCESS_ORGANIZATION_PORT, type AccessOrganizationPort } from './AccessOrganizationPort';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface ChannelOrganizationPort {
  createDistributor(context: WriteTransactionContext, input: Readonly<{ id: string; parent: string; name: string; timezone: string }>): Promise<void>;
  rename(context: WriteTransactionContext, id: string, name: string): Promise<void>;
  disable(context: WriteTransactionContext, id: string): Promise<void>;
  visible(context: ReadTransactionContext, ancestor: string, descendant: string): Promise<boolean>;
  bindingAllowed(context: ReadTransactionContext, root: string, distributor: string, tenant: string): Promise<boolean>;
}
export const CHANNEL_ORGANIZATION_PORT = publicPort<ChannelOrganizationPort>('organization', 'channel');
export { NAVIGATION_ORGANIZATION_PORT, type NavigationOrganizationPort, type NavigationScope } from './NavigationOrganizationPort';
export { ORGANIZATION_READ_PORT, type OrganizationReadPort, type OrganizationScopeSnapshot, type OrganizationSummary } from './OrganizationReadPort';
export { ORGANIZATION_HIERARCHY_PORT, type OrganizationHierarchyPort, type OrganizationNode } from './HierarchyPort';
export { MALL_PROVISION_PORT, type MallProvisionPort, type MallProvisionSnapshot } from './MallProvisionPort';
