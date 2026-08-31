import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations } from '../../foundation/application/ModuleOperations';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { ReadAccessCenter } from './application/query/ReadAccessCenter';
import { ManageRole } from './application/command/ManageRole';
import { ManageScope } from './application/command/ManageScope';
import { TransferOwner } from './application/command/TransferOwner';
import { ManageOverride } from './application/command/ManageOverride';
import { AccessVersionService } from './application/service/AccessVersionService';
import type { AccessRepository } from './application/port/AccessRepository';

export function accessOperations(context: ModuleContext, repository: AccessRepository, versions: AccessVersionService): ModuleOperations {
  const pool = context.service(DATABASE_POOL);
  const center = new ReadAccessCenter(repository);
  const roles = new ManageRole(repository, versions);
  const scopes = new ManageScope(repository, versions);
  const owners = new TransferOwner(repository, versions);
  const overrides = new ManageOverride(repository, versions);
  return new ModuleOperations('access', pool, context.service(AUDIT_SINK), {
    'access.center.read': (request, database) => center.execute(request, database),
    'access.owners.transfer': (request, database) => owners.execute(request, database),
    'access.overrides.manage': (request, database) => overrides.execute(request, database),
    'access.roles.manage': (request, database) => roles.execute(request, database),
    'access.scopes.manage': (request, database) => scopes.execute(request, database),
  });
}
