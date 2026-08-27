import { BatchImportProcessor } from '../../../../foundation/application/BatchImport';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { PgInventoryImport } from '../../infrastructure/persistence/PgInventoryImport';
import type { CatalogSku } from '../../../catalog/CatalogModule';

export class InventoryImportProcessor extends BatchImportProcessor {
  constructor(pool: DatabasePool, objects: ObjectStore, catalog: CatalogSku) {
    super('inventoryimport', 'inventory', objects, new PgInventoryImport(pool, catalog));
  }
}
