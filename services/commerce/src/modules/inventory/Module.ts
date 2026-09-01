import { defineModule } from '../../bootstrap/DefinedModule';
import { Manifest } from './Manifest';
import { InventoryPort } from './infrastructure/persistence/InventoryPort';
import { CATALOG_INVENTORY_PORT, CHECKOUT_INVENTORY_PORT, ORDER_EXPIRY_INVENTORY_PORT, PAYMENT_INVENTORY_PORT, PROVIDER_INVENTORY_PORT } from './public/index';
import { INVENTORY_READ_PORT } from './public/InventoryReadPort';
import { PgInventoryReadPort } from './infrastructure/persistence/PgInventoryReadPort';
import { ImportsCreateHandler } from './application/handler/ImportsCreateHandler';
import { ImportsReadHandler } from './application/handler/ImportsReadHandler';
import { PgInventoryImportRepository } from './infrastructure/persistence/PgInventoryImportRepository';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { PgJobScheduler } from '../../adapter/database/PgJobScheduler';
import { OBJECT_STORE } from '../../foundation/infrastructure/ObjectStore';
import { createJobs, createProviderJobs } from './interface/job/JobFactory';

export const InventoryModule = defineModule(Manifest, {
  jobs: createJobs,
  providerJobs: createProviderJobs,
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const imports = new PgInventoryImportRepository(transactions);
    const objects = context.service(OBJECT_STORE);
    return [new ImportsCreateHandler(imports, new PgJobScheduler(transactions), new ImportObjectService(objects)), new ImportsReadHandler(imports, objects)];
  },
  ports: (context) => {
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
import { ImportObjectService } from '../../foundation/application/ImportObjectService';
