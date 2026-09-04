import { defineModule } from '../../bootstrap/DefinedModule';
import { fullIdentityOperations } from './FullIdentityOperations';
import { PgIdentityPrincipal } from './infrastructure/PgIdentityPrincipal';
export type { IdentityPrincipal } from './application/port/IdentityPrincipal';
export const identityPrincipal = new PgIdentityPrincipal();
export { IdentityNotificationPort, identityNotificationPort, type IdentityChallenge } from './IdentityNotificationPort';
export { IdentityRetentionPort, identityRetentionPort } from './IdentityRetentionPort';
export const IdentityModule = defineModule('identity', [], fullIdentityOperations);
