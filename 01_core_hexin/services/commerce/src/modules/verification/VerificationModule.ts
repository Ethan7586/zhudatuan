import { defineModule } from '../../bootstrap/DefinedModule';
import { verificationOperations } from './VerificationOperations';
export const VerificationModule = defineModule('verification', ['member', 'partner'], verificationOperations);
