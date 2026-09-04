export { IDENTITY_CAPABILITIES, type IdentityCapability } from './01_public_gongkai/IdentityCapabilities';
export * from './01_public_gongkai/ports_jiekou/IdentityNotificationPort';
export type { IdentityPrincipal } from './01_public_gongkai/ports_jiekou/IdentityPrincipal';
export * from './01_public_gongkai/ports_jiekou/IdentityRetentionPort';
export * from './01_public_gongkai/ports_jiekou/WechatIdentity';
export { PasswordPolicy } from './02_domain_yewu/policies_guize/PasswordPolicy';
export * from './04_adapters_shixian/providers_waibu/ReturnTargetCatalog';
export * from './04_adapters_shixian/providers_waibu/WechatIdentityGateway';
export {
  IDENTITY_CORE_OPERATION_IDS,
  IDENTITY_REGISTRATION_OPERATION_IDS,
} from './05_interface_jieru/http/IdentityOperations';
export { IdentityModule, identityPrincipal } from './05_interface_jieru/IdentityModule';
export { IdentityRegistrationModule } from './05_interface_jieru/IdentityRegistrationModule';
