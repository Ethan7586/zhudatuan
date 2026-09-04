import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../../foundation/application/AuditSink';
import { ModuleOperations } from '../../../../foundation/application/ModuleOperations';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { getAuditRecordsOperations } from '../../application/query/GetAuditRecords';
import { AUDIT_PORT } from '../../application/port/AuditPort';

export function auditRoutes(context: ModuleContext): ModuleOperations {
  const repository = context.container.get(AUDIT_PORT);
  return new ModuleOperations('audit', context.container.get(DATABASE_POOL), context.container.get(AUDIT_SINK), getAuditRecordsOperations(repository));
}
