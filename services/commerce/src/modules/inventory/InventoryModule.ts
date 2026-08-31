import { defineModule } from '../../bootstrap/DefinedModule';
import { inventoryOperations } from './InventoryOperations';
import { Manifest } from './Manifest';
import { InventoryPort } from './InventoryPort';
import { CATALOG_INVENTORY_PORT, CHECKOUT_INVENTORY_PORT, PAYMENT_INVENTORY_PORT } from './public/index';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { INVENTORY_READ_PORT, PgInventoryReadPort } from './public/InventoryReadPort';
import { readDatabaseWorkload } from '../../foundation/persistence/Workload';
export const InventoryModule = defineModule(Manifest, inventoryOperations, (context) => {
  const inventory = new InventoryPort();
  return [
    { token: CHECKOUT_INVENTORY_PORT, value: inventory },
    { token: PAYMENT_INVENTORY_PORT, value: inventory },
    { token: CATALOG_INVENTORY_PORT, value: inventory },
    { token: INVENTORY_READ_PORT, value: new PgInventoryReadPort(context.service(DATABASE_POOL), readDatabaseWorkload(context.workload)) },
  ];
});
