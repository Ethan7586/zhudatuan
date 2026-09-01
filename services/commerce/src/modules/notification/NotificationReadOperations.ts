import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, type OperationActions } from '../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';

export const NOTIFICATION_OPERATOR_READ_OPERATION_IDS = Object.freeze([
  'notification.announcements.read',
  'notification.templates.read',
] as const satisfies readonly OperationId[]);

export function notificationOperatorReadActions(): OperationActions {
  return {
    'notification.announcements.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select id,title,body,audience,state,starts_at,ends_at,version,created_at,updated_at
        from notification.announcement where scope_id=$1 and($2::text is null or id>$2) order by id limit $3`,
      [access.scope.id, page.id, page.fetch]);
      return keysetResult(result, page, 'id');
    },
    'notification.templates.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select id,scope_id,channel,event_type,version,variable_schema,provider_template,
        subject,body,status,created_at from notification.template where scope_id=$1 and($2::text is null or id>$2)
        order by id limit $3`, [access.scope.id, page.id, page.fetch]);
      return keysetResult(result, page, 'id');
    },
  };
}

export function notificationOperatorReadOperations(context: ModuleContext): ModuleOperations {
  return new ModuleOperations('notification', context.container.get(DATABASE_POOL), context.container.get(AUDIT_SINK),
    notificationOperatorReadActions(), NOTIFICATION_OPERATOR_READ_OPERATION_IDS);
}
