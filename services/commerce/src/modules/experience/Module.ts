import { PgExperienceReadPort } from './infrastructure/persistence/PgExperienceReadPort';
import { PgCheckoutExperiencePort } from './infrastructure/persistence/PgCheckoutExperiencePort';
import { PgCartExperiencePort } from './infrastructure/persistence/PgCartExperiencePort';

import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { defineModule } from '../../bootstrap/DefinedModule';
import { EXPERIENCE_CATALOG_PORT } from '../catalog/public';
import { EXPERIENCE_MARKETING_PORT } from '../marketing/public';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { ApplicationsCopyHandler } from './application/handler/ApplicationsCopyHandler';
import { ApplicationsCreateHandler } from './application/handler/ApplicationsCreateHandler';
import { ApplicationsReadHandler } from './application/handler/ApplicationsReadHandler';
import { ApplicationsUpdateHandler } from './application/handler/ApplicationsUpdateHandler';
import { VersionsPublishHandler } from './application/handler/VersionsPublishHandler';
import { VersionsRestoreHandler } from './application/handler/VersionsRestoreHandler';
import { VersionsSaveHandler } from './application/handler/VersionsSaveHandler';
import { VersionsValidateHandler } from './application/handler/VersionsValidateHandler';
import { PgApplicationRepository } from './infrastructure/persistence/PgApplicationRepository';
import { PgPublicationRepository } from './infrastructure/persistence/PgPublicationRepository';
import { PgReleaseRepository } from './infrastructure/persistence/PgReleaseRepository';
import { PgVersionRepository } from './infrastructure/persistence/PgVersionRepository';
import { Manifest } from './Manifest';
import { CART_EXPERIENCE_PORT, CHECKOUT_EXPERIENCE_PORT } from './public';
import { EXPERIENCE_READ_PORT } from './public/ExperienceReadPort';
import { createJobs } from './interface/job/JobFactory';
import { EVENT_SUBSCRIPTIONS } from '../../generated/EventSubscriptions';

export const ExperienceModule = defineModule(Manifest, {
  jobs: createJobs,
  events: [{ handler: 'experiencepublish', events: EVENT_SUBSCRIPTIONS.experiencepublish }],
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const applications = new PgApplicationRepository(transactions, context.ports.get(ORGANIZATION_READ_PORT), context.ports.get(EXPERIENCE_CATALOG_PORT));
    const versions = new PgVersionRepository(transactions);
    const publications = new PgPublicationRepository(transactions, context.ports.get(EXPERIENCE_CATALOG_PORT), context.ports.get(EXPERIENCE_MARKETING_PORT));
    const releases = new PgReleaseRepository(transactions);
    return [
      new ApplicationsCreateHandler(applications),
      new ApplicationsCopyHandler(applications),
      new ApplicationsReadHandler(applications),
      new ApplicationsUpdateHandler(applications),
      new VersionsSaveHandler(versions),
      new VersionsValidateHandler(versions),
      new VersionsPublishHandler(versions, publications, releases),
      new VersionsRestoreHandler(versions),
    ];
  },
  ports: (context) => [
    { token: CART_EXPERIENCE_PORT, value: new PgCartExperiencePort() },
    { token: CHECKOUT_EXPERIENCE_PORT, value: new PgCheckoutExperiencePort() },
    { token: EXPERIENCE_READ_PORT, value: new PgExperienceReadPort() },
  ],
});
