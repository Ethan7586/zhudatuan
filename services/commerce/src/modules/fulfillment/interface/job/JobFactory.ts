import { EXTENSION_REGISTRY } from '../../../../bootstrap/ExtensionRegistry';
import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { FULFILLMENT_CHANNEL_PORT } from '../../../channel/public';
import { FULFILLMENT_ORDER_PORT } from '../../../order/public';
import { ORGANIZATION_READ_PORT } from '../../../organization/public';
import { RunFulfillment } from '../../application/process/RunFulfillment';
import { PgFulfillmentJobProcess } from '../../infrastructure/persistence/PgFulfillmentJobProcess';
import { FulfillmentJob } from './FulfillmentJob';

export function createProviderJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const extensions = context.service(EXTENSION_REGISTRY);
  const dependencies = Object.freeze({
    operations: context.ports.get(FULFILLMENT_CHANNEL_PORT),
    orders: context.ports.get(FULFILLMENT_ORDER_PORT),
    organizations: context.ports.get(ORGANIZATION_READ_PORT),
  });
  const fulfillment = new RunFulfillment(new PgFulfillmentJobProcess(new PgTransactionManager(pool), extensions, dependencies));
  return Object.freeze([
    { id: 'fulfillment', processor: new FulfillmentJob('fulfillment', fulfillment) },
    { id: 'tracking', processor: new FulfillmentJob('tracking', fulfillment) },
  ]);
}
