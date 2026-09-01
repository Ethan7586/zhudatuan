import { defineSelectedModule } from '../../bootstrap/DefinedModule';
import { ACCESS_OPERATOR_READ_OPERATION_IDS, accessOperatorReadOperations } from './AccessReadOperations';

export const IdentityOperatorAccessModule = defineSelectedModule(
  'access', ACCESS_OPERATOR_READ_OPERATION_IDS, accessOperatorReadOperations, ['identity'],
);
