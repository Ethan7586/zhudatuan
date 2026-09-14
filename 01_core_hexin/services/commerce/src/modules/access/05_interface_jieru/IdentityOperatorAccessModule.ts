import { defineSelectedModule } from '../../../bootstrap/DefinedModule';
import { accessOperations } from '../03_application_yingyong/AccessOperations';
import { accessManifest } from '../module.manifest';

export const ACCESS_IDENTITY_OPERATOR_OPERATION_IDS = Object.freeze([...accessManifest.operations]);

export const IdentityOperatorAccessModule = defineSelectedModule(
  'access', ACCESS_IDENTITY_OPERATOR_OPERATION_IDS, accessOperations, ['identity'],
);
