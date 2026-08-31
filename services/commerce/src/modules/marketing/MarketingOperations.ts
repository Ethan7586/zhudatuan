import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess } from '../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';

export function marketingOperations(context: ModuleContext): ModuleOperations {
  const pool = context.service(DATABASE_POOL);
  return new ModuleOperations('marketing', pool, context.service(AUDIT_SINK), {
    'marketing.campaigns.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(
        `select id,kind,name,state,budget_minor,spent_minor,currency,effective_at,expires_at,version,updated_at
        from marketing.campaign where scope_id=$1 and ($2::timestamptz is null or (updated_at,id)<($2::timestamptz,$3))
        order by updated_at desc,id desc limit $4`,
        [access.scope.id, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'updated_at');
    },
  });
}
