import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../../foundation/application/AuditSink';
import { ModuleOperations } from '../../../../foundation/application/ModuleOperations';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { getAuditRecordsOperations } from '../../application/query/GetAuditRecords';
import { AUDIT_PORT } from '../../application/port/AuditPort';

export function auditRoutes(context: ModuleContext): ModuleOperations {
  const repository = context.service(AUDIT_PORT);
  return new ModuleOperations('audit', context.service(DATABASE_POOL), context.service(AUDIT_SINK), getAuditRecordsOperations(repository));
}
