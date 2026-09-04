import { defineModule } from '../../../bootstrap/DefinedModule';
import { marketingOperations } from '../03_application_yingyong/MarketingOperations';

export const MarketingModule = defineModule('marketing', ['catalog'], marketingOperations);
