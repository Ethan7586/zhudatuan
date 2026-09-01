import { PgInventoryReturnPort } from './infrastructure/persistence/PgInventoryReturnPort';

import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { defineModule } from '../../bootstrap/DefinedModule';
import { FULFILLMENT_ORDER_PORT } from '../order/public';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { ReturnsInspectHandler } from './application/handler/ReturnsInspectHandler';
import { ReturnsReceiveHandler } from './application/handler/ReturnsReceiveHandler';
import { ShipmentsCreateHandler } from './application/handler/ShipmentsCreateHandler';
import { TrackingReadHandler } from './application/handler/TrackingReadHandler';
import { FulfillmentPort } from './infrastructure/persistence/FulfillmentPort';
import { FulfillmentScopeReader } from './infrastructure/persistence/FulfillmentScopeReader';
import { PgFulfillmentRepository } from './infrastructure/persistence/PgFulfillmentRepository';
import { Manifest } from './Manifest';
import { FINANCE_FULFILLMENT_PORT, INVENTORY_RETURN_PORT, PAYMENT_FULFILLMENT_PORT } from './public';
import { createProviderJobs } from './interface/job/JobFactory';

export const FulfillmentModule = defineModule(Manifest, {
  providerJobs: createProviderJobs,
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const repository = new PgFulfillmentRepository(transactions, new FulfillmentScopeReader(context.ports.get(FULFILLMENT_ORDER_PORT), context.ports.get(ORGANIZATION_READ_PORT)));
    return [new TrackingReadHandler(repository), new ShipmentsCreateHandler(repository), new ReturnsReceiveHandler(repository), new ReturnsInspectHandler(repository)];
  },
  ports: (context) => {
    const fulfillment = new FulfillmentPort();
    return [
      { token: PAYMENT_FULFILLMENT_PORT, value: fulfillment },
      { token: FINANCE_FULFILLMENT_PORT, value: fulfillment },
      { token: INVENTORY_RETURN_PORT, value: new PgInventoryReturnPort(context.ports.get(FULFILLMENT_ORDER_PORT)) },
    ];
  },
  jobPorts: () => {
    const fulfillment = new FulfillmentPort();
    return [
      { token: PAYMENT_FULFILLMENT_PORT, value: fulfillment },
      { token: FINANCE_FULFILLMENT_PORT, value: fulfillment },
    ];
  },
  providerPorts: (context) => [{ token: INVENTORY_RETURN_PORT, value: new PgInventoryReturnPort(context.ports.get(FULFILLMENT_ORDER_PORT)) }],
});
