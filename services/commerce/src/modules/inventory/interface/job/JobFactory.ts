import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { OBJECT_STORE } from '../../../../foundation/infrastructure/ObjectStore';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { INVENTORY_CATALOG_PORT, PROVIDER_CATALOG_PORT } from '../../../catalog/public';
import { PROVIDER_SYNC_PORT } from '../../../channel/public';
import { INVENTORY_RETURN_PORT } from '../../../fulfillment/public';
import { RestockReturn } from '../../application/process/RestockReturn';
import { InventoryImportProcess } from '../../application/process/InventoryImportProcess';
import { PgImportProcess } from '../../infrastructure/persistence/PgImportProcess';
import { PgRestockRepository } from '../../infrastructure/persistence/PgRestockRepository';
import { PROVIDER_INVENTORY_PORT } from '../../public';
import { InventoryImportJob } from './InventoryImportJob';
import { InventorySyncJob } from './InventorySyncJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const process = new InventoryImportProcess(context.service(OBJECT_STORE), new PgImportProcess(new PgTransactionManager(pool), context.ports.get(INVENTORY_CATALOG_PORT)));
  return Object.freeze([
    {
      id: 'inventoryimport',
      processor: new InventoryImportJob(process),
    },
  ]);
}

export function createProviderJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const channel = context.ports.get(PROVIDER_SYNC_PORT).inventory(context.ports.get(PROVIDER_CATALOG_PORT), context.ports.get(PROVIDER_INVENTORY_PORT));
  return Object.freeze([
    {
      id: 'inventorysync',
      processor: new InventorySyncJob(new RestockReturn(new PgTransactionManager(pool), new PgRestockRepository(), context.ports.get(INVENTORY_RETURN_PORT)), channel),
    },
  ]);
}
import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
