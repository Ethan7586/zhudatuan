import { defineSelectedModule } from '../../bootstrap/DefinedModule';
import { IDENTITY_REGISTRATION_OPERATION_IDS } from './IdentityOperations';
import { registrationWechatIdentityOperations } from './FullIdentityOperations';

export const IdentityRegistrationModule = defineSelectedModule('identity', IDENTITY_REGISTRATION_OPERATION_IDS,
  registrationWechatIdentityOperations);
