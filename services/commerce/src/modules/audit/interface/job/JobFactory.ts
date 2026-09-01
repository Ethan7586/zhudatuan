import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { KMS_CLIENT } from '../../../../foundation/infrastructure/KmsClient';
import { OBJECT_STORE } from '../../../../foundation/infrastructure/ObjectStore';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
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
