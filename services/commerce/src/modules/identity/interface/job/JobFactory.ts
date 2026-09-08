import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import { jobDefinition } from '../../../../pipeline/JobCatalog';
import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import { IDENTITY_SECURITY_KEYS, SECRET_STORE } from '../../../../platform/secret/SecretStore';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { TELEMETRY } from '../../../../platform/telemetry/Telemetry';
import { ProviderResolver } from '../../application/service/ProviderResolver';
import { CleanupFederation } from '../../application/process/CleanupFederation';
import { CleanupInvitations } from '../../application/process/CleanupInvitations';
import { MonitorIdentityProviders } from '../../application/process/MonitorIdentityProviders';
import { PgFederationCleanupRepository } from '../../infrastructure/persistence/PgFederationCleanupRepository';
import { PgInvitationCleanupRepository } from '../../infrastructure/persistence/PgInvitationCleanupRepository';
import { PgProviderHealthRepository } from '../../infrastructure/persistence/PgProviderHealthRepository';
import { PgProviderRepository } from '../../infrastructure/persistence/PgProviderRepository';
import { identityProviderRegistry } from '../../infrastructure/registry/IdentityProviderRegistry';
import { ProviderHttpClient } from '../../infrastructure/security/ProviderHttpClient';
import { ProviderHealthJob } from './ProviderHealthJob';
import { FederationCleanupJob } from './FederationCleanupJob';
import { InvitationCleanupJob } from './InvitationCleanupJob';
import { PgInbox } from '../../../../platform/database/PgInbox';
import { RevokeStaleSessions } from '../../application/process/RevokeStaleSessions';
import { PgSessionRevocationRepository } from '../../infrastructure/persistence/PgSessionRevocationRepository';
import { SessionRevocationJob } from './SessionRevocationJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const transactions = new PgTransactionManager(pool);
  const client = new ProviderHttpClient(context.service(SECRET_STORE));
  const key = context.service(IDENTITY_SECURITY_KEYS).identity;
  const resolver = new ProviderResolver(new PgProviderRepository(client, key), identityProviderRegistry(client, key));
  return Object.freeze([
    { id: 'sessionrevocation', processor: new SessionRevocationJob(new RevokeStaleSessions(transactions, new PgInbox(), new PgSessionRevocationRepository())) },
    { id: 'federationcleanup', processor: new FederationCleanupJob(new CleanupFederation(transactions, new PgFederationCleanupRepository())) },
    {
      id: 'providerhealth',
      processor: new ProviderHealthJob(new MonitorIdentityProviders(transactions, resolver, new PgProviderHealthRepository(), jobDefinition('providerhealth').concurrency)),
    },
    {
      id: 'invitationcleanup',
      processor: new InvitationCleanupJob(new CleanupInvitations(transactions, new PgInvitationCleanupRepository(), context.service(TELEMETRY))),
    },
  ]);
}
