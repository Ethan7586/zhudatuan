import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess } from '../../../foundation/application/ModuleOperations';
import { bodyRecord } from '../../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';
import { accessOperatorReadActions } from './AccessReadOperations';
import { administratorSegmentWriteActions } from './AdministratorSegmentOperations';
import { demoteAdministrator, offboardAdministrator } from './OperatorLifecycleOperations';
import { grantOperatorScope, manageRoleAssignment } from './OperatorGrantOperations';
import { operatorOwnershipActions } from './OperatorOwnershipOperations';
import { deleteCustomRole, upsertRoleTemplate } from './OperatorRoleTemplateOperations';

export function accessOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  return new ModuleOperations('access', pool, context.container.get(AUDIT_SINK), {
    ...accessOperatorReadActions(),
    ...administratorSegmentWriteActions(),
    ...operatorOwnershipActions(context),
    'access.roles.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const role = request.input.path.roleid!;
      if (body.action === 'offboard') return offboardAdministrator(request, database, access);
      if (body.action === 'demote') return demoteAdministrator(request, database, access, role);
      if (body.action === 'assign' || body.action === 'revoke') {
        return manageRoleAssignment(request, database, access, role, body.action);
      }
      if (body.action === 'delete') return deleteCustomRole(request, database, access, role);
      if (body.action !== undefined) throw new Error('VALIDATION_FAILED:action');
      return upsertRoleTemplate(request, database, access, role);
    },
    'access.scopes.manage': grantOperatorScope,
  });
}
