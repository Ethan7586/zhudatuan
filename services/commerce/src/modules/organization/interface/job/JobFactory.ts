import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { jobDefinition } from '../../../../foundation/application/JobCatalog';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { KMS_CLIENT } from '../../../../foundation/infrastructure/KmsClient';
import { IDENTITY_SECURITY_KEYS, SECRET_STORE } from '../../../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { IDENTITY_ACCESS_PORT } from '../../../access/public';
import { DirectoryProviderRegistry } from '../../application/service/DirectoryProviderRegistry';
import { ReconcileDirectory } from '../../application/process/ReconcileDirectory';
import { SynchronizeDirectory } from '../../application/process/SynchronizeDirectory';
import { DirectoryReconciler } from '../../application/service/DirectoryReconciler';
import { DirectorySyncService } from '../../application/service/DirectorySyncService';
import { MembershipLifecycle } from '../../application/service/MembershipLifecycle';
import { DirectoryPolicy } from '../../domain/policy/DirectoryPolicy';
import { WecomDirectoryClient } from '../../infrastructure/adapter/wecom/WecomDirectoryClient';
import { WecomDirectoryMapper } from '../../infrastructure/adapter/wecom/WecomDirectoryMapper';
import { WecomDirectoryProvider } from '../../infrastructure/adapter/wecom/WecomDirectoryProvider';
import { PgDirectoryRepository } from '../../infrastructure/persistence/PgDirectoryRepository';
import { DirectoryLeaseStore } from '../../infrastructure/persistence/DirectoryLeaseStore';
import { PgDirectoryJobRepository } from '../../infrastructure/persistence/PgDirectoryJobRepository';
import { DirectoryReconcileJob } from './DirectoryReconcileJob';
import { DirectorySyncJob } from './DirectorySyncJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const transactions = new PgTransactionManager(pool);
  const repository = new PgDirectoryRepository();
  const client = new WecomDirectoryClient(context.service(SECRET_STORE));
  const providers = new DirectoryProviderRegistry([new WecomDirectoryProvider('wecomcorp', client), new WecomDirectoryProvider('wecomsuite', client)]);
  const lifecycle = new MembershipLifecycle(context.ports.get(IDENTITY_ACCESS_PORT));
  const reconciler = new DirectoryReconciler(repository, lifecycle);
  const service = new DirectorySyncService(transactions, repository, providers, new WecomDirectoryMapper(context.service(IDENTITY_SECURITY_KEYS).identity), reconciler, new DirectoryPolicy(), lifecycle, context.service(KMS_CLIENT));
  const sync = jobDefinition('directorysync');
  const reconcile = jobDefinition('directoryreconcile');
  const leases = new DirectoryLeaseStore(pool);
  return Object.freeze([
    {
      id: 'directorysync',
      processor: new DirectorySyncJob(new SynchronizeDirectory(leases, service, sync.lease, sync.retry.attempts)),
      resourceLeasePrefix: 'directory',
    },
    {
      id: 'directoryreconcile',
      processor: new DirectoryReconcileJob(new ReconcileDirectory(leases, transactions, new PgDirectoryJobRepository(), reconcile.lease)),
      resourceLeasePrefix: 'directory',
    },
  ]);
}
