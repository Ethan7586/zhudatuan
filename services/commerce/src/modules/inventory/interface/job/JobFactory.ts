import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { INVENTORY_CATALOG_PORT, PROVIDER_CATALOG_PORT } from '../../../catalog/public';
import { PROVIDER_SYNC_PORT } from '../../../channel/public';
import { INVENTORY_RETURN_PORT } from '../../../fulfillment/public';
import { RestockReturn } from '../../application/process/RestockReturn';
import { InventoryImportProcess } from '../../application/process/InventoryImportProcess';
import { ExpireReservations } from '../../application/process/ExpireReservations';
import { createImportProcess } from '../../infrastructure/persistence/PgImportProcess';
import { PgRestockRepository } from '../../infrastructure/persistence/PgRestockRepository';
import { PROVIDER_INVENTORY_PORT } from '../../public';
import { IMPORT_BATCH_FACTORY_PORT, IMPORT_RUNNER_PORT, JOB_PORT, RUNTIME_IMPORT_PORT } from '../../../runtime/public';
import { PgInventoryImportRepository } from '../../infrastructure/persistence/PgInventoryImportRepository';
import { PgReservationExpiryRepository } from '../../infrastructure/persistence/PgReservationExpiryRepository';
import { InventoryImportJob } from './InventoryImportJob';
import { InventorySyncJob } from './InventorySyncJob';
import { ReservationExpiryJob } from './ReservationExpiryJob';
import { TASK_AUTHORIZATION_PORT } from '../../../access/public';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const process = new InventoryImportProcess(
    context.ports.get(IMPORT_RUNNER_PORT),
    createImportProcess(
      context.ports.get(IMPORT_BATCH_FACTORY_PORT),
      new PgTransactionManager(pool),
      context.ports.get(RUNTIME_IMPORT_PORT),
      context.ports.get(JOB_PORT),
      new PgInventoryImportRepository(context.ports.get(INVENTORY_CATALOG_PORT)),
      context.ports.get(TASK_AUTHORIZATION_PORT)
    )
  );
  return Object.freeze([
    {
      id: 'inventoryimport',
      processor: new InventoryImportJob(process),
    },
    {
      id: 'reservationexpiry',
      processor: new ReservationExpiryJob(new ExpireReservations(new PgTransactionManager(pool), new PgReservationExpiryRepository())),
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
      deadletter: channel,
    },
  ]);
}
