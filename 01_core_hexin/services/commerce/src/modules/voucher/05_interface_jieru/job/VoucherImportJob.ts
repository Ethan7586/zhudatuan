import { BatchImportProcessor } from '../../../../foundation/application/BatchImport';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { PgVoucherImport } from '../../04_adapters_shixian/persistence/PgVoucherImport';

export class VoucherImportProcessor extends BatchImportProcessor {
  constructor(pool: DatabasePool, objects: ObjectStore, kms: KmsClient) {
    super('voucherimport', 'voucher', objects, new PgVoucherImport(pool, kms));
  }
}
