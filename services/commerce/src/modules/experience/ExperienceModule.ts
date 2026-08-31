import { defineModule } from '../../bootstrap/DefinedModule';
import { experienceOperations } from './ExperienceOperations';
import { Manifest } from './Manifest';
import { CART_EXPERIENCE_PORT, CHECKOUT_EXPERIENCE_PORT, PgCartExperiencePort, PgCheckoutExperiencePort } from './public';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { EXPERIENCE_READ_PORT, PgExperienceReadPort } from './public/ExperienceReadPort';
import { readDatabaseWorkload } from '../../foundation/persistence/Workload';
export const ExperienceModule = defineModule(Manifest, experienceOperations, (context) => [
  { token: CART_EXPERIENCE_PORT, value: new PgCartExperiencePort() },
  { token: CHECKOUT_EXPERIENCE_PORT, value: new PgCheckoutExperiencePort() },
  { token: EXPERIENCE_READ_PORT, value: new PgExperienceReadPort(context.service(DATABASE_POOL), readDatabaseWorkload(context.workload)) },
]);
