import { defineModule } from '../../bootstrap/DefinedModule';
import { fulfillmentOperations } from './FulfillmentOperations';
import { Manifest } from './Manifest';
import { FulfillmentPort } from './FulfillmentPort';
import { FINANCE_FULFILLMENT_PORT, INVENTORY_RETURN_PORT, PAYMENT_FULFILLMENT_PORT, PgInventoryReturnPort } from './public/index';
import { FULFILLMENT_ORDER_PORT } from '../order/public';
export const FulfillmentModule = defineModule(Manifest, fulfillmentOperations, (context) => {
  const fulfillment = new FulfillmentPort();
  return [
    { token: PAYMENT_FULFILLMENT_PORT, value: fulfillment },
    { token: FINANCE_FULFILLMENT_PORT, value: fulfillment },
    { token: INVENTORY_RETURN_PORT, value: new PgInventoryReturnPort(context.ports.get(FULFILLMENT_ORDER_PORT)) },
  ];
});
