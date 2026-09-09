import { defineSelectedModule } from '../../../bootstrap/DefinedModule';
import {
  IDENTITY_REGISTRATION_CORE_OPERATION_IDS,
  IDENTITY_REGISTRATION_OPERATION_IDS,
  identityRegistrationOperations,
} from './http/IdentityOperations';
import { registrationWechatIdentityOperations } from './FullIdentityOperations';

export const IdentityRegistrationModule = defineSelectedModule('identity', IDENTITY_REGISTRATION_OPERATION_IDS,
  registrationWechatIdentityOperations);

export const IdentityRegistrationCoreModule = defineSelectedModule(
  'identity',
  IDENTITY_REGISTRATION_CORE_OPERATION_IDS,
  identityRegistrationOperations,
);
