import { defineModule } from '../../../bootstrap/DefinedModule';
import { organizationOperations } from '../03_application_yingyong/OrganizationOperations';

export const OrganizationModule = defineModule('organization', [], organizationOperations);
