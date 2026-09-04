import { EXTENSION_REGISTRY } from '../../../../bootstrap/ExtensionRegistry';
import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { FULFILLMENT_CHANNEL_PORT } from '../../../channel/public';
import { ORDER_FULFILLMENT_PORT } from '../../../order/public';
import { ORGANIZATION_READ_PORT } from '../../../organization/public';
import { FULFILLMENT_VOUCHER_PORT } from '../../../voucher/public';
import { RunFulfillment } from '../../application/process/RunFulfillment';
import { PgFulfillmentJobProcess } from '../../infrastructure/persistence/PgFulfillmentJobProcess';
import { FulfillmentJob } from './FulfillmentJob';
import { ProcessFulfillmentEvent } from '../../application/process/ProcessFulfillmentEvent';
import { PgFulfillmentEventProcess } from '../../infrastructure/persistence/PgFulfillmentEventProcess';
import { FulfillmentEventJob } from './FulfillmentEventJob';
import { FulfillmentDeadletter } from '../../infrastructure/persistence/FulfillmentDeadletter';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const process = new ProcessFulfillmentEvent(
    new PgFulfillmentEventProcess(new PgTransactionManager(context.service(DATABASE_POOL)), context.ports.get(ORDER_FULFILLMENT_PORT))
  );
  return Object.freeze([{ id: 'fulfillmentevent', processor: new FulfillmentEventJob(process) }]);
}

export function createProviderJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const extensions = context.service(EXTENSION_REGISTRY);
  const dependencies = Object.freeze({
    operations: context.ports.get(FULFILLMENT_CHANNEL_PORT),
    orders: context.ports.get(ORDER_FULFILLMENT_PORT),
    organizations: context.ports.get(ORGANIZATION_READ_PORT),
    vouchers: context.ports.get(FULFILLMENT_VOUCHER_PORT),
  });
  const fulfillment = new RunFulfillment(new PgFulfillmentJobProcess(new PgTransactionManager(pool), extensions, dependencies));
  const deadletter = new FulfillmentDeadletter();
  return Object.freeze([
    { id: 'fulfillment', processor: new FulfillmentJob('fulfillment', fulfillment), deadletter },
    { id: 'tracking', processor: new FulfillmentJob('tracking', fulfillment), deadletter },
  ]);
}
