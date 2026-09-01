import { PgOrganizationReadPort } from './infrastructure/persistence/PgOrganizationReadPort';

import { defineModule } from '../../bootstrap/DefinedModule';
import { Manifest } from './Manifest';
import { OrganizationPort } from './infrastructure/persistence/OrganizationPort';
import { IDENTITY_ORGANIZATION_PORT } from './public/IdentityOrganizationPort';
import { CHANNEL_ORGANIZATION_PORT } from './public/index';
import { NAVIGATION_ORGANIZATION_PORT } from './public/NavigationOrganizationPort';
import { PgNavigationOrganization } from './infrastructure/persistence/PgNavigationOrganization';
import { ACCESS_ORGANIZATION_PORT } from './public/AccessOrganizationPort';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { ORGANIZATION_READ_PORT } from './public';
import { ORGANIZATION_HIERARCHY_PORT } from './public/HierarchyPort';
import { PgOrganizationHierarchy } from './infrastructure/persistence/PgOrganizationHierarchy';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { LayersReadHandler } from './application/handler/LayersReadHandler';
import { DirectoriesReadHandler } from './application/handler/DirectoriesReadHandler';
import { DirectoriesManageHandler } from './application/handler/DirectoriesManageHandler';
import { DirectoriesSyncHandler } from './application/handler/DirectoriesSyncHandler';
import { DirectorySyncRunsReadHandler } from './application/handler/DirectorySyncRunsReadHandler';
import { DirectoryEventsReceiveHandler } from './application/handler/DirectoryEventsReceiveHandler';
import { PgOrganizationRepository } from './infrastructure/persistence/PgOrganizationRepository';
import { PgJobScheduler } from '../../adapter/database/PgJobScheduler';
import { SECRET_STORE } from '../../foundation/infrastructure/SecretStore';
import { KMS_CLIENT } from '../../foundation/infrastructure/KmsClient';
import { DirectoryProviderRegistry } from './application/service/DirectoryProviderRegistry';
import { WecomDirectoryClient } from './infrastructure/adapter/wecom/WecomDirectoryClient';
import { WecomDirectoryProvider } from './infrastructure/adapter/wecom/WecomDirectoryProvider';
import { createJobs } from './interface/job/JobFactory';
import { EXPERIENCE_ORGANIZATION_PORT } from './public/ExperienceOrganizationPort';
import { PgExperienceOrganizationPort } from './infrastructure/persistence/PgExperienceOrganizationPort';
export const OrganizationModule = defineModule(Manifest, {
  jobs: createJobs,
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const organizations = new PgOrganizationRepository(transactions);
    const client = new WecomDirectoryClient(context.service(SECRET_STORE));
    const providers = new DirectoryProviderRegistry([new WecomDirectoryProvider('wecomcorp', client), new WecomDirectoryProvider('wecomsuite', client)]);
    return [
      new LayersReadHandler(organizations),
      new DirectoriesReadHandler(organizations),
      new DirectoriesManageHandler(organizations),
      new DirectoriesSyncHandler(organizations, new PgJobScheduler(transactions)),
      new DirectorySyncRunsReadHandler(organizations),
      new DirectoryEventsReceiveHandler(organizations, providers, context.service(KMS_CLIENT)),
    ];
  },
  ports: () => {
    const organization = new OrganizationPort();
    return [
      { token: IDENTITY_ORGANIZATION_PORT, value: organization },
      { token: ACCESS_ORGANIZATION_PORT, value: organization },
      { token: CHANNEL_ORGANIZATION_PORT, value: organization },
      { token: NAVIGATION_ORGANIZATION_PORT, value: new PgNavigationOrganization() },
      { token: ORGANIZATION_READ_PORT, value: new PgOrganizationReadPort() },
      { token: ORGANIZATION_HIERARCHY_PORT, value: new PgOrganizationHierarchy(new PgTransactionAccess()) },
      { token: EXPERIENCE_ORGANIZATION_PORT, value: new PgExperienceOrganizationPort() },
    ];
  },
  jobPorts: [{ token: ORGANIZATION_READ_PORT, value: new PgOrganizationReadPort() }],
  providerPorts: [{ token: ORGANIZATION_READ_PORT, value: new PgOrganizationReadPort() }],
});
