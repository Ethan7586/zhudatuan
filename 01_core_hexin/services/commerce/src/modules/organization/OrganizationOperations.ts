import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess } from '../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';

export function organizationOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  return new ModuleOperations('organization', pool, context.container.get(AUDIT_SINK), {
    'organization.layers.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request, 1000);
      const result = await database.query(`select child.id,child.kind,child.parent_id,child.name,child.timezone,child.status,child.version
        from organization.unitclosure visible join organization.organization child on child.id=visible.descendant_id
        where visible.ancestor_id=$1 and ($2::text is null or child.id>$2) order by child.id limit $3`, [access.scope.id, page.id, page.fetch]);
      return keysetResult(result, page, 'id');
    },
  });
}
