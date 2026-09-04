import { defineModule } from '../../../bootstrap/DefinedModule';
import { referralOperations } from '../03_application_yingyong/ReferralOperations';

export const ReferralModule = defineModule('referral', ['member', 'catalog', 'finance'], referralOperations);
