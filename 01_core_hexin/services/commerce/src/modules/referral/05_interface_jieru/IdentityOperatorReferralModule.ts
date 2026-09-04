import { defineSelectedModule } from '../../../bootstrap/DefinedModule';
import { REFERRAL_OPERATOR_READ_OPERATION_IDS, referralOperatorReadOperations } from '../03_application_yingyong/ReferralReadOperations';

export const IdentityOperatorReferralModule = defineSelectedModule(
  'referral', REFERRAL_OPERATOR_READ_OPERATION_IDS, referralOperatorReadOperations, ['identity'],
);
