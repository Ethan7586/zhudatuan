import { defineModule } from '../../bootstrap/DefinedModule';
import { provisioningOperations } from './ProvisioningOperations';

export const ProvisioningModule = defineModule('provisioning', ['organization', 'catalog', 'experience'], provisioningOperations);
