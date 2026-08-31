import { defineModule } from '../../bootstrap/DefinedModule';
import { referralOperations } from './ReferralOperations';

export const ReferralModule = defineModule('referral', ['member', 'catalog', 'finance'], referralOperations);
