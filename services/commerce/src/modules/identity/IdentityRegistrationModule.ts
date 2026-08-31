import { defineSelectedModule } from '../../bootstrap/DefinedModule';
import { IDENTITY_REGISTRATION_OPERATION_IDS, identityRegistrationOperations } from './IdentityOperations';

export const IdentityRegistrationModule = defineSelectedModule('identity', IDENTITY_REGISTRATION_OPERATION_IDS,
  identityRegistrationOperations);
