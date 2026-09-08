import { PgInventoryReturnPort } from './infrastructure/persistence/PgInventoryReturnPort';

import { PgTransactionAccess } from '../../platform/database/PgTransactionAccess';
import { defineModule } from '../../composition/DefinedModule';
import { ORDER_FULFILLMENT_PORT } from '../order/public';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { ReturnsInspectHandler } from './application/handler/ReturnsInspectHandler';
import { ReturnsReceiveHandler } from './application/handler/ReturnsReceiveHandler';
import { ShipmentsCreateHandler } from './application/handler/ShipmentsCreateHandler';
import { TrackingReadHandler } from './application/handler/TrackingReadHandler';
import { WorkitemsReadHandler } from './application/handler/WorkitemsReadHandler';
import { WorkitemsTransitionHandler } from './application/handler/WorkitemsTransitionHandler';
import { ReturnsReadHandler } from './application/handler/ReturnsReadHandler';
import { FulfillmentPort } from './infrastructure/persistence/FulfillmentPort';
import { FulfillmentScopeReader } from './infrastructure/persistence/FulfillmentScopeReader';
import { PgFulfillmentRepository } from './infrastructure/persistence/PgFulfillmentRepository';
import { PgStoreWorkRepository } from './infrastructure/persistence/PgStoreWorkRepository';
import { Manifest } from './Manifest';
import { FINANCE_FULFILLMENT_PORT, INVENTORY_RETURN_PORT } from './public';
import { createJobs, createProviderJobs } from './interface/job/JobFactory';
import { EVENT_SUBSCRIPTIONS } from '../../generated/EventSubscriptions';

export const FulfillmentModule = defineModule(Manifest, {
  events: [{ handler: 'fulfillmentevent', events: EVENT_SUBSCRIPTIONS.fulfillmentevent }],
  jobs: createJobs,
  providerJobs: createProviderJobs,
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const repository = new PgFulfillmentRepository(transactions, new FulfillmentScopeReader(context.ports.get(ORDER_FULFILLMENT_PORT), context.ports.get(ORGANIZATION_READ_PORT)));
    const work = new PgStoreWorkRepository(transactions, new FulfillmentScopeReader(context.ports.get(ORDER_FULFILLMENT_PORT), context.ports.get(ORGANIZATION_READ_PORT)));
    return [
      new TrackingReadHandler(repository),
      new WorkitemsReadHandler(work),
      new WorkitemsTransitionHandler(work),
      new ReturnsReadHandler(work),
      new ShipmentsCreateHandler(repository),
      new ReturnsReceiveHandler(repository),
      new ReturnsInspectHandler(repository),
    ];
  },
  ports: (context) => {
    return [
      { token: FINANCE_FULFILLMENT_PORT, value: new FulfillmentPort() },
      { token: INVENTORY_RETURN_PORT, value: new PgInventoryReturnPort(context.ports.get(ORDER_FULFILLMENT_PORT)) },
    ];
  },
  jobPorts: (context) => {
    return [{ token: FINANCE_FULFILLMENT_PORT, value: new FulfillmentPort() }];
  },
  providerPorts: (context) => [{ token: INVENTORY_RETURN_PORT, value: new PgInventoryReturnPort(context.ports.get(ORDER_FULFILLMENT_PORT)) }],
});
