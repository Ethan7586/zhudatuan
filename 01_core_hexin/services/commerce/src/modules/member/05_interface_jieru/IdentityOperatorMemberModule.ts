import { defineSelectedModule } from '../../../bootstrap/DefinedModule';
import { MEMBER_OPERATOR_READ_OPERATION_IDS, memberOperatorReadOperations } from '../03_application_yingyong/MemberReadOperations';

export const IdentityOperatorMemberModule = defineSelectedModule(
  'member', MEMBER_OPERATOR_READ_OPERATION_IDS, memberOperatorReadOperations, ['identity'],
);
