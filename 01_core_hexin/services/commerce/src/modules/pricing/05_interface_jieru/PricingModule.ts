import { defineModule } from '../../../bootstrap/DefinedModule';
import { pricingOperations } from '../03_application_yingyong/PricingOperations';

export const PricingModule = defineModule('pricing', ['catalog'], pricingOperations);
