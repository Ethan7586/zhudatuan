import { defineModule } from '../../bootstrap/DefinedModule';
import { verificationOperations } from './VerificationOperations';
import { Manifest } from './Manifest';
export const VerificationModule = defineModule(Manifest, verificationOperations);
