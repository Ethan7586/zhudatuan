import { defineModule } from '../../../bootstrap/DefinedModule';
import { fulfillmentOperations } from '../03_application_yingyong/FulfillmentOperations';

export const FulfillmentModule = defineModule('fulfillment', ['order', 'partner'], fulfillmentOperations);
