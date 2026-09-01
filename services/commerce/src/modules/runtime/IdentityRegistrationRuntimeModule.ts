import { defineSelectedModule } from '../../bootstrap/DefinedModule';
import { IDENTITY_REGISTRATION_RUNTIME_OPERATION_IDS, identityRegistrationRuntimeOperations } from './IdentityRegistrationRuntimeOperations';

export const IdentityRegistrationRuntimeModule = defineSelectedModule('runtime', IDENTITY_REGISTRATION_RUNTIME_OPERATION_IDS,
  identityRegistrationRuntimeOperations);
