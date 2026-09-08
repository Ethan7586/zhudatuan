import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import { CACHE } from '../../../../platform/cache/Cache';
import { OBJECT_STORE } from '../../../runtime/public/ObjectPort';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { PublishExperience } from '../../application/process/PublishExperience';
import { CdnPublisher } from '../../infrastructure/adapter/CdnPublisher';
import { PgExperiencePublicationRepository } from '../../infrastructure/persistence/PgExperiencePublicationRepository';
import { ExperiencePublishJob } from './ExperiencePublishJob';
import { TELEMETRY } from '../../../../platform/telemetry/Telemetry';
import { ExperienceTelemetry } from '../../infrastructure/adapter/ExperienceTelemetry';
import { EXPERIENCE_CATALOG_PORT } from '../../../catalog/public';
import { MALL_PROVISION_PORT } from '../../../organization/public';
import { ProvisionExperience } from '../../application/process/ProvisionExperience';
import { PgExperienceProvisionRepository } from '../../infrastructure/persistence/PgExperienceProvisionRepository';
import { ExperienceProvisionJob } from './ExperienceProvisionJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const transactions = new PgTransactionManager(context.service(DATABASE_POOL));
  return Object.freeze([
    {
      id: 'experiencepublish',
      processor: new ExperiencePublishJob(
        new PublishExperience(transactions, new PgExperiencePublicationRepository(), new CdnPublisher(context.service(OBJECT_STORE)), context.service(CACHE), new ExperienceTelemetry(context.service(TELEMETRY)))
      ),
    },
    {
      id: 'experienceprovision',
      processor: new ExperienceProvisionJob(new ProvisionExperience(transactions, context.ports.get(MALL_PROVISION_PORT), new PgExperienceProvisionRepository(context.ports.get(EXPERIENCE_CATALOG_PORT)))),
    },
  ]);
}
