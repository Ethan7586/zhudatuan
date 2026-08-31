export { IDENTITY_ORGANIZATION_PORT, type IdentityOrganizationPort } from './IdentityOrganizationPort';
export { ACCESS_ORGANIZATION_PORT, type AccessOrganizationPort } from './AccessOrganizationPort';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
export interface ChannelOrganizationPort {
  createDistributor(database: OperationDatabase, input: Readonly<{ id: string; parent: string; name: string; timezone: string }>): Promise<void>;
  rename(database: OperationDatabase, id: string, name: string): Promise<void>;
  disable(database: OperationDatabase, id: string): Promise<void>;
  visible(database: OperationDatabase, ancestor: string, descendant: string): Promise<boolean>;
  bindingAllowed(database: OperationDatabase, root: string, distributor: string, tenant: string): Promise<boolean>;
}
export const CHANNEL_ORGANIZATION_PORT = publicPort<ChannelOrganizationPort>('organization', 'channel');
export { NAVIGATION_ORGANIZATION_PORT, type NavigationOrganizationPort, type NavigationScope } from './NavigationOrganizationPort';
export { ORGANIZATION_READ_PORT, PgOrganizationReadPort, type OrganizationReadPort, type OrganizationScopeSnapshot } from './OrganizationReadPort';
