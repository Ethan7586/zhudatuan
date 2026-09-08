import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import { jobDefinition } from '../../../../pipeline/JobCatalog';
import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import { KMS_CLIENT } from '../../../../pipeline/KmsPort';
import { IDENTITY_SECURITY_KEYS, SECRET_STORE } from '../../../../platform/secret/SecretStore';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { IDENTITY_ACCESS_PORT } from '../../../access/public';
import { DirectoryProviderRegistry } from '../../application/service/DirectoryProviderRegistry';
import { ReconcileDirectory } from '../../application/process/ReconcileDirectory';
import { SynchronizeDirectory } from '../../application/process/SynchronizeDirectory';
import { DirectoryReconciler } from '../../application/service/DirectoryReconciler';
import { DirectorySynchronization } from '../../application/service/DirectorySynchronization';
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
import { LEASE_PORT } from '../../../runtime/public';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const transactions = new PgTransactionManager(pool);
  const repository = new PgDirectoryRepository();
  const client = new WecomDirectoryClient(context.service(SECRET_STORE));
  const providers = new DirectoryProviderRegistry([new WecomDirectoryProvider('wecomcorp', client), new WecomDirectoryProvider('wecomsuite', client)]);
  const lifecycle = new MembershipLifecycle(context.ports.get(IDENTITY_ACCESS_PORT));
  const reconciler = new DirectoryReconciler(repository, lifecycle);
  const synchronization = new DirectorySynchronization(
    transactions,
    repository,
    providers,
    new WecomDirectoryMapper(context.service(IDENTITY_SECURITY_KEYS).identity),
    reconciler,
    new DirectoryPolicy(),
    lifecycle,
    context.service(KMS_CLIENT)
  );
  const sync = jobDefinition('directorysync');
  const reconcile = jobDefinition('directoryreconcile');
  const leases = new DirectoryLeaseStore(context.ports.get(LEASE_PORT));
  return Object.freeze([
    {
      id: 'directorysync',
      processor: new DirectorySyncJob(new SynchronizeDirectory(leases, synchronization, sync.lease, sync.retry.attempts)),
      resourceLeasePrefix: 'directory',
    },
    {
      id: 'directoryreconcile',
      processor: new DirectoryReconcileJob(new ReconcileDirectory(leases, transactions, new PgDirectoryJobRepository(), reconcile.lease)),
      resourceLeasePrefix: 'directory',
    },
  ]);
}
