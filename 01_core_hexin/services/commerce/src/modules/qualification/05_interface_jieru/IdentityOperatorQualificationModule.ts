import { defineSelectedModule } from '../../../bootstrap/DefinedModule';
import { QUALIFICATION_OPERATOR_READ_OPERATION_IDS, qualificationOperatorReadOperations } from '../03_application_yingyong/QualificationReadOperations';

export const IdentityOperatorQualificationModule = defineSelectedModule(
  'qualification', QUALIFICATION_OPERATOR_READ_OPERATION_IDS, qualificationOperatorReadOperations, ['identity'],
);
