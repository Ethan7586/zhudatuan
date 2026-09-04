import { defineModule } from '../../bootstrap/DefinedModule';
import { Manifest } from './Manifest';
import { InventoryPort } from './infrastructure/persistence/InventoryPort';
import { CATALOG_INVENTORY_PORT, CHECKOUT_INVENTORY_PORT, ORDER_EXPIRY_INVENTORY_PORT, PAYMENT_INVENTORY_PORT, PROVIDER_INVENTORY_PORT } from './public/index';
import { INVENTORY_READ_PORT } from './public/InventoryReadPort';
import { PgInventoryReadPort } from './infrastructure/persistence/PgInventoryReadPort';
import { ImportsCreateHandler } from './application/handler/ImportsCreateHandler';
import { ImportsReadHandler } from './application/handler/ImportsReadHandler';
import { AvailabilityReadHandler } from './application/handler/AvailabilityReadHandler';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { PgJobScheduler } from '../../adapter/database/PgJobScheduler';
import { OBJECT_STORE } from '../runtime/public/ObjectPort';
import { createJobs, createProviderJobs } from './interface/job/JobFactory';
import { IMPORT_OBJECT_PORT, RUNTIME_IMPORT_PORT } from '../runtime/public';

export const InventoryModule = defineModule(Manifest, {
  jobs: createJobs,
  providerJobs: createProviderJobs,
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const imports = context.ports.get(RUNTIME_IMPORT_PORT);
    const objects = context.service(OBJECT_STORE);
    return [new AvailabilityReadHandler(new PgInventoryReadPort()), new ImportsCreateHandler(imports, new PgJobScheduler(transactions), context.ports.get(IMPORT_OBJECT_PORT)), new ImportsReadHandler(imports, objects)];
  },
  ports: () => {
    const inventory = new InventoryPort();
    return [
      { token: CHECKOUT_INVENTORY_PORT, value: inventory },
      { token: PAYMENT_INVENTORY_PORT, value: inventory },
      { token: CATALOG_INVENTORY_PORT, value: inventory },
      { token: INVENTORY_READ_PORT, value: new PgInventoryReadPort() },
    ];
  },
  jobPorts: () => {
    const inventory = new InventoryPort();
    return [
      { token: PAYMENT_INVENTORY_PORT, value: inventory },
      { token: ORDER_EXPIRY_INVENTORY_PORT, value: inventory },
    ];
  },
  providerPorts: [{ token: PROVIDER_INVENTORY_PORT, value: new InventoryPort() }],
});
