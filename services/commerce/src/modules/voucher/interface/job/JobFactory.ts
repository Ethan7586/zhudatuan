import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { KMS_CLIENT } from '../../../../foundation/infrastructure/KmsClient';
import { OBJECT_STORE } from '../../../../foundation/infrastructure/ObjectStore';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { VOUCHER_ACCOUNTING_PORT } from '../../../finance/public';
import { RunVoucherBatch } from '../../application/process/RunVoucherBatch';
import { VoucherImportProcess } from '../../application/process/VoucherImportProcess';
import { VoucherDeadletter } from '../../infrastructure/persistence/VoucherDeadletter';
import { PgImportProcess } from '../../infrastructure/persistence/PgImportProcess';
import { PgVoucherJobProcess } from '../../infrastructure/persistence/PgVoucherJobProcess';
import { VoucherBatchJob } from './VoucherBatchJob';
import { VoucherImportJob } from './VoucherImportJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const transactions = new PgTransactionManager(pool);
  const kms = context.service(KMS_CLIENT);
  const finance = context.ports.get(VOUCHER_ACCOUNTING_PORT);
  const deadletter = new VoucherDeadletter();
  const batches = new RunVoucherBatch(new PgVoucherJobProcess(transactions, kms, finance));
  const imports = new VoucherImportProcess(context.service(OBJECT_STORE), new PgImportProcess(transactions, kms));
  return Object.freeze([
    { id: 'voucherissue', processor: new VoucherBatchJob('voucherissue', batches), deadletter },
    { id: 'voucherstatus', processor: new VoucherBatchJob('voucherstatus', batches), deadletter },
    { id: 'voucherexpiry', processor: new VoucherBatchJob('voucherexpiry', batches), deadletter },
    { id: 'voucherimport', processor: new VoucherImportJob(imports), deadletter },
  ]);
}
