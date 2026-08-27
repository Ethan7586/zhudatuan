import { defineModule } from '../../bootstrap/DefinedModule';
import { fulfillmentOperations } from './FulfillmentOperations';
export const FulfillmentModule = defineModule('fulfillment', ['order', 'partner'], fulfillmentOperations);
export { FulfillmentPort, fulfillmentPort, type PaidFulfillment } from './FulfillmentPort';
