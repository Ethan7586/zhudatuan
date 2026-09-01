import { defineSelectedModule } from '../../bootstrap/DefinedModule';
import { QUALIFICATION_OPERATOR_READ_OPERATION_IDS, qualificationOperatorReadOperations } from './QualificationReadOperations';

export const IdentityOperatorQualificationModule = defineSelectedModule(
  'qualification', QUALIFICATION_OPERATOR_READ_OPERATION_IDS, qualificationOperatorReadOperations, ['identity'],
);
