import { defineModule } from '../../../bootstrap/DefinedModule';
import { partnerOperations } from '../03_application_yingyong/PartnerOperations';

export const PartnerModule = defineModule('partner', ['organization'], partnerOperations);
