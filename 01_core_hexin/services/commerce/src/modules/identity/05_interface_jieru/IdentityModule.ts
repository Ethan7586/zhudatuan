import { defineModule } from '../../../bootstrap/DefinedModule';
import { fullIdentityOperations } from './FullIdentityOperations';
import { PgIdentityPrincipal } from '../04_adapters_shixian/persistence_cunchu/PgIdentityPrincipal';
export type { IdentityPrincipal } from '../01_public_gongkai/ports_jiekou/IdentityPrincipal';
export const identityPrincipal = new PgIdentityPrincipal();
export { IdentityNotificationPort, identityNotificationPort, type IdentityChallenge } from '../01_public_gongkai/ports_jiekou/IdentityNotificationPort';
export { IdentityRetentionPort, identityRetentionPort } from '../01_public_gongkai/ports_jiekou/IdentityRetentionPort';
export const IdentityModule = defineModule('identity', [], fullIdentityOperations);
