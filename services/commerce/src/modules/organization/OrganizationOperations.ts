import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess } from '../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { SECRET_STORE } from '../../foundation/infrastructure/SecretStore';
import { KMS_CLIENT } from '../../foundation/infrastructure/KmsClient';
import { PgDirectoryRepository } from './infrastructure/persistence/PgDirectoryRepository';
import { PgDirectoryInbox } from './infrastructure/persistence/PgDirectoryInbox';
import { PgDirectoryJob } from './infrastructure/persistence/PgDirectoryJob';
import { WecomDirectoryClient } from './infrastructure/adapter/wecom/WecomDirectoryClient';
import { WecomDirectoryProvider } from './infrastructure/adapter/wecom/WecomDirectoryProvider';
import { DirectoryProviderRegistry } from './application/service/DirectoryProviderRegistry';
import { ManageDirectory } from './application/command/ManageDirectory';
import { StartDirectorySync } from './application/command/StartDirectorySync';
import { ReceiveDirectoryEvent } from './application/command/ReceiveDirectoryEvent';
import { ReadDirectories } from './application/query/ReadDirectories';
import { ReadSyncRuns } from './application/query/ReadSyncRuns';

export function organizationOperations(context: ModuleContext): ModuleOperations {
  const pool = context.service(DATABASE_POOL);
  const repository = new PgDirectoryRepository();
  const jobs = new PgDirectoryJob();
  const client = new WecomDirectoryClient(context.service(SECRET_STORE));
  const providers = new DirectoryProviderRegistry([new WecomDirectoryProvider('wecomcorp', client), new WecomDirectoryProvider('wecomsuite', client)]);
  const inbox = new PgDirectoryInbox();
  const kms = context.service(KMS_CLIENT);
  return new ModuleOperations('organization', pool, context.service(AUDIT_SINK), {
    'organization.layers.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(
        `select child.id,child.kind,child.parent_id,child.name,child.timezone,child.status,child.version
        from organization.unitclosure visible join organization.organization child on child.id=visible.descendant_id
        where visible.ancestor_id=$1 and ($2::text is null or child.id>$2) order by child.id limit $3`,
        [access.scope.id, page.id, page.fetch]
      );
      return keysetResult(result, page, 'id');
    },
    'organization.directories.read': new ReadDirectories(repository).action(),
    'organization.directories.manage': new ManageDirectory(repository).action(),
    'organization.directories.sync': new StartDirectorySync(repository, jobs).action(),
    'organization.directories.syncruns.read': new ReadSyncRuns(repository).action(),
    'organization.directoryevents.receive': new ReceiveDirectoryEvent(repository, inbox, providers, kms).action(),
  });
}
