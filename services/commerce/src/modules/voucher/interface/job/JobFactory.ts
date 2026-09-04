import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { jobDefinition } from '../../../../foundation/application/JobCatalog';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { KMS_CLIENT } from '../../../../foundation/application/KmsPort';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { VOUCHER_ACCOUNTING_PORT } from '../../../finance/public';
import { TASK_AUTHORIZATION_PORT } from '../../../access/public';
import { EXPORT_PORT, EXPORT_RUNNER_PORT, IMPORT_BATCH_FACTORY_PORT, IMPORT_RUNNER_PORT, JOB_PORT, RUNTIME_IMPORT_PORT } from '../../../runtime/public';
import { ActionBatchProcess } from '../../application/process/ActionBatchProcess';
import { CredentialGenerateProcess } from '../../application/process/CredentialGenerateProcess';
import { CredentialImportProcess } from '../../application/process/CredentialImportProcess';
import { IssueBatchProcess } from '../../application/process/IssueBatchProcess';
import { VoucherExportProcess } from '../../application/process/VoucherExportProcess';
import { EnvelopeCredentialProtector } from '../../infrastructure/crypto/EnvelopeCredentialProtector';
import { PgVoucherExportProcess } from '../../infrastructure/persistence/PgVoucherExportProcess';
import { PgActionBatchProcess } from '../../infrastructure/persistence/PgActionBatchProcess';
import { PgCredentialGenerateProcess } from '../../infrastructure/persistence/PgCredentialGenerateProcess';
import { createCredentialImportProcess } from '../../infrastructure/persistence/PgCredentialImportProcess';
import { PgIssueBatchProcess } from '../../infrastructure/persistence/PgIssueBatchProcess';
import { ActionBatchJob } from './ActionBatchJob';
import { CredentialGenerateJob } from './CredentialGenerateJob';
import { CredentialImportJob } from './CredentialImportJob';
import { IssueBatchJob } from './IssueBatchJob';
import { VoucherExportJob } from './VoucherExportJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const manager = new PgTransactionManager(context.service(DATABASE_POOL));
  const jobs = context.ports.get(JOB_PORT);
  const exports = context.ports.get(EXPORT_PORT);
  const protector = new EnvelopeCredentialProtector(context.service(KMS_CLIENT));
  const importing = new CredentialImportProcess(context.ports.get(IMPORT_RUNNER_PORT), createCredentialImportProcess(context.ports.get(IMPORT_BATCH_FACTORY_PORT),
    manager, context.ports.get(RUNTIME_IMPORT_PORT), jobs, protector, context.ports.get(TASK_AUTHORIZATION_PORT)));
  return Object.freeze([
    { id: 'credentialgenerate', processor: new CredentialGenerateJob(new CredentialGenerateProcess(new PgCredentialGenerateProcess(manager, protector, jobs))) },
    { id: 'credentialimport', processor: new CredentialImportJob(importing) },
    { id: 'voucherissue', processor: new IssueBatchJob(new IssueBatchProcess(new PgIssueBatchProcess(manager, jobs, context.ports.get(VOUCHER_ACCOUNTING_PORT)))) },
    { id: 'voucheraction', processor: new ActionBatchJob(new ActionBatchProcess(new PgActionBatchProcess(manager, jobs))) },
    { id: 'voucherexport', processor: new VoucherExportJob(context.ports.get(EXPORT_RUNNER_PORT), new VoucherExportProcess(new PgVoucherExportProcess(manager, exports, protector, jobDefinition('voucherexport').retry.attempts, context.ports.get(TASK_AUTHORIZATION_PORT)))) },
  ]);
}
