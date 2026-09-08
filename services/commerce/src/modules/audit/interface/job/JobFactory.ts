import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import { KMS_CLIENT } from '../../../../pipeline/KmsPort';
import { OBJECT_STORE } from '../../../runtime/public/ObjectPort';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { ArchiveAudit } from '../../application/process/ArchiveAudit';
import { PgAuditRepository } from '../../infrastructure/persistence/PgAuditRepository';
import { AuditArchiveJob } from './AuditArchiveJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  return Object.freeze([
    {
      id: 'auditarchive',
      processor: new AuditArchiveJob(new ArchiveAudit(new PgTransactionManager(context.service(DATABASE_POOL)), context.service(OBJECT_STORE), context.service(KMS_CLIENT), new PgAuditRepository())),
    },
  ]);
}
