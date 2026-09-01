import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { CACHE } from '../../../../foundation/cache/Cache';
import { OBJECT_STORE } from '../../../../foundation/infrastructure/ObjectStore';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { PublishExperience } from '../../application/process/PublishExperience';
import { CdnPublisher } from '../../infrastructure/adapter/CdnPublisher';
import { PgExperiencePublicationRepository } from '../../infrastructure/persistence/PgExperiencePublicationRepository';
import { ExperiencePublishJob } from './ExperiencePublishJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  return Object.freeze([
    {
      id: 'experiencepublish',
      processor: new ExperiencePublishJob(new PublishExperience(new PgTransactionManager(context.service(DATABASE_POOL)), new PgExperiencePublicationRepository(), new CdnPublisher(context.service(OBJECT_STORE)), context.service(CACHE))),
    },
  ]);
}
