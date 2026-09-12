import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { CatalogMediaReplicationResult } from '../CatalogMediaReplication';
import type { CatalogMediaPurpose } from './CatalogMediaObjectStorage';

export interface CatalogMediaPersistence {
  upsertReplicationResult(database: OperationDatabase, result: CatalogMediaReplicationResult): Promise<void>;
  bindProductMedia(
    database: OperationDatabase,
    productId: string,
    mediaId: string,
    purpose: CatalogMediaPurpose,
    position: number,
  ): Promise<void>;
  unbindProductMedia(
    database: OperationDatabase,
    productId: string,
    purpose: CatalogMediaPurpose,
    position: number,
  ): Promise<void>;
}
