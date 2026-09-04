import { defineModule } from '../../../bootstrap/DefinedModule';
import { provisioningOperations } from '../03_application_yingyong/ProvisioningOperations';

export const ProvisioningModule = defineModule('provisioning', ['organization', 'catalog', 'experience'], provisioningOperations);
