import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { CatalogMediaReplication, type CatalogMediaReplicationResult } from './CatalogMediaReplication';
import type { CatalogMediaPersistence } from './port/CatalogMediaPersistence';
import type { CatalogMediaPurpose } from './port/CatalogMediaObjectStorage';

export interface CatalogProductMediaRegistrationInput {
  readonly productId: string;
  readonly mediaId?: string;
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly purpose: CatalogMediaPurpose;
  readonly position: number;
}

export interface CatalogProductMediaRegistrationResult extends CatalogMediaReplicationResult {
  readonly productId: string;
  readonly purpose: CatalogMediaPurpose;
  readonly position: number;
  readonly bindingStatus: 'ready' | 'not_ready';
}

export class CatalogProductMediaRegistration {
  constructor(
    private readonly replication: CatalogMediaReplication,
    private readonly persistence: CatalogMediaPersistence,
  ) {}

  async register(
    database: OperationDatabase,
    input: CatalogProductMediaRegistrationInput,
  ): Promise<CatalogProductMediaRegistrationResult> {
    const replication = await this.replication.replicate({
      ...(input.mediaId === undefined ? { productId: input.productId } : { mediaId: input.mediaId }),
      bytes: input.bytes,
      contentType: input.contentType,
      purpose: input.purpose,
    });
    await this.persistence.upsertReplicationResult(database, replication);
    const bindingStatus = replication.overallStatus === 'complete' ? 'ready' : 'not_ready';
    if (bindingStatus === 'ready') {
      await this.persistence.bindProductMedia(database, input.productId, replication.mediaId, input.purpose, input.position);
    } else {
      await this.persistence.unbindProductMedia(database, input.productId, input.purpose, input.position);
    }
    return Object.freeze({
      ...replication,
      productId: input.productId,
      purpose: input.purpose,
      position: input.position,
      bindingStatus,
    });
  }
}
