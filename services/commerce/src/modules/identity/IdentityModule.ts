import { defineModule } from '../../bootstrap/DefinedModule';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import { fullIdentityOperations } from './FullIdentityOperations';
=======
import { identityOperations } from './IdentityOperations';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { fullIdentityOperations } from './FullIdentityOperations';
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
import { identityOperations } from './IdentityOperations';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
import { PgIdentityPrincipal } from './infrastructure/PgIdentityPrincipal';
export type { IdentityPrincipal } from './application/port/IdentityPrincipal';
export const identityPrincipal = new PgIdentityPrincipal();
export { IdentityNotificationPort, identityNotificationPort, type IdentityChallenge } from './IdentityNotificationPort';
export { IdentityRetentionPort, identityRetentionPort } from './IdentityRetentionPort';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
export const IdentityModule = defineModule('identity', [], fullIdentityOperations);
=======
export const IdentityModule = defineModule('identity', [], identityOperations);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
export const IdentityModule = defineModule('identity', [], fullIdentityOperations);
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
export const IdentityModule = defineModule('identity', [], identityOperations);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
