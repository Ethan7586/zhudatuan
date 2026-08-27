import { BatchImportProcessor } from '../../../../foundation/application/BatchImport';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { PgCatalogImport } from '../../infrastructure/persistence/PgCatalogImport';

export class CatalogImportProcessor extends BatchImportProcessor {
  constructor(pool: DatabasePool, objects: ObjectStore) {
    super('catalogimport', 'catalog', objects, new PgCatalogImport(pool));
  }
}
