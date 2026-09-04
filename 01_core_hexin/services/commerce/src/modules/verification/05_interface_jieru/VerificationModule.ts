import { defineModule } from '../../../bootstrap/DefinedModule';
import { verificationOperations } from '../03_application_yingyong/VerificationOperations';

export const VerificationModule = defineModule('verification', ['member', 'partner'], verificationOperations);
