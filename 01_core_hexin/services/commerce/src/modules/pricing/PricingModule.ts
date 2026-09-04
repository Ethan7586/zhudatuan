import { defineModule } from '../../bootstrap/DefinedModule';
import { pricingOperations } from './PricingOperations';
export const PricingModule = defineModule('pricing', ['catalog'], pricingOperations);
export { PricingPort, pricingPort, type ProviderPrice } from './PricingPort';
