import { defineModule } from '../../bootstrap/DefinedModule';
import { partnerOperations } from './PartnerOperations';
export const PartnerModule = defineModule('partner', ['organization'], partnerOperations);
