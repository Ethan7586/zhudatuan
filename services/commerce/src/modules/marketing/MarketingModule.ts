import { defineModule } from '../../bootstrap/DefinedModule';
import { marketingOperations } from './MarketingOperations';
export const MarketingModule = defineModule('marketing', ['catalog'], marketingOperations);
export { MarketingPort, marketingPort, type MarketingReservation } from './MarketingPort';
