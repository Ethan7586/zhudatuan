import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../../foundation/application/AuditSink';
import { ModuleOperations } from '../../../../foundation/application/ModuleOperations';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { getExtensions } from '../../application/query/GetExtensions';
import { PgExtensionRepository } from '../../infrastructure/persistence/PgExtensionRepository';

export function extensionRoutes(context:ModuleContext):ModuleOperations {
  return new ModuleOperations('extension',context.container.get(DATABASE_POOL),context.container.get(AUDIT_SINK),
    getExtensions((database)=>new PgExtensionRepository(database)));
}
