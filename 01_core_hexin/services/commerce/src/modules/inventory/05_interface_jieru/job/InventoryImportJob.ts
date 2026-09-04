import { BatchImportProcessor } from '../../../../foundation/application/BatchImport';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { PgInventoryImport } from '../../04_adapters_shixian/persistence/PgInventoryImport';
import type { CatalogSku } from '../../../catalog';

export class InventoryImportProcessor extends BatchImportProcessor {
  constructor(pool: DatabasePool, objects: ObjectStore, catalog: CatalogSku) {
    super('inventoryimport', 'inventory', objects, new PgInventoryImport(pool, catalog));
  }
}
