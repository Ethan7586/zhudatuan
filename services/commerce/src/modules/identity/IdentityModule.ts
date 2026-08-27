import { defineModule } from '../../bootstrap/DefinedModule';
import { identityOperations } from './IdentityOperations';
import { PgIdentityPrincipal } from './infrastructure/PgIdentityPrincipal';
export type { IdentityPrincipal } from './application/port/IdentityPrincipal';
export const identityPrincipal = new PgIdentityPrincipal();
export { IdentityNotificationPort, identityNotificationPort, type IdentityChallenge } from './IdentityNotificationPort';
export { IdentityRetentionPort, identityRetentionPort } from './IdentityRetentionPort';
export const IdentityModule = defineModule('identity', [], identityOperations);
