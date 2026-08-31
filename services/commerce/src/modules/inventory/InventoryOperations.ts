import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations } from '../../foundation/application/ModuleOperations';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { inventoryImportOperations } from './application/InventoryImportOperations';

export function inventoryOperations(context: ModuleContext): ModuleOperations {
  const pool = context.service(DATABASE_POOL);
  return new ModuleOperations('inventory', pool, context.service(AUDIT_SINK), {
    ...inventoryImportOperations(context),
  });
}
