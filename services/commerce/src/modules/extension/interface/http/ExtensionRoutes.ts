import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../../foundation/application/AuditSink';
import { ModuleOperations } from '../../../../foundation/application/ModuleOperations';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { getExtensions } from '../../application/query/GetExtensions';
import { PgExtensionRepository } from '../../infrastructure/persistence/PgExtensionRepository';
import { ORGANIZATION_READ_PORT } from '../../../organization/public';

export function extensionRoutes(context: ModuleContext): ModuleOperations {
  return new ModuleOperations(
    'extension',
    context.service(DATABASE_POOL),
    context.service(AUDIT_SINK),
    getExtensions((database) => new PgExtensionRepository(database), context.ports.get(ORGANIZATION_READ_PORT))
  );
}
