import { defineModule } from '../../bootstrap/DefinedModule';
<<<<<<< HEAD
import { fullIdentityOperations } from './FullIdentityOperations';
=======
import { identityOperations } from './IdentityOperations';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
import { PgIdentityPrincipal } from './infrastructure/PgIdentityPrincipal';
export type { IdentityPrincipal } from './application/port/IdentityPrincipal';
export const identityPrincipal = new PgIdentityPrincipal();
export { IdentityNotificationPort, identityNotificationPort, type IdentityChallenge } from './IdentityNotificationPort';
export { IdentityRetentionPort, identityRetentionPort } from './IdentityRetentionPort';
<<<<<<< HEAD
export const IdentityModule = defineModule('identity', [], fullIdentityOperations);
=======
export const IdentityModule = defineModule('identity', [], identityOperations);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
