import { defineModule } from '../../bootstrap/DefinedModule';
import { organizationOperations } from './OrganizationOperations';
export const OrganizationModule = defineModule('organization', [], organizationOperations);
export { OrganizationPort, organizationPort, type MallOrganization, type MallOrganizationConflict, type MallOrganizationIdentity } from './OrganizationPort';
