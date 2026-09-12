export { CATALOG_CAPABILITIES, type CatalogCapability } from './01_public_gongkai/CatalogCapabilities';
export {
  CatalogProvisioningPort,
  catalogProvisioningPort,
  type MallCatalogProvisioning,
} from './01_public_gongkai/CatalogProvisioningPort';
export {
  CatalogSourcePort,
  catalogSourcePort,
  type CatalogSourceInput,
} from './01_public_gongkai/CatalogSourcePort';
export {
  catalogSourceProjection,
  CatalogSourceProjection,
  type CatalogSourceProjectionInput,
  type CatalogSourceProjectionResult,
} from './03_application_yingyong/CatalogSourceProjection';
export type { CatalogSku } from './03_application_yingyong/port/CatalogSku';
export {
  CatalogMediaReplication,
  type CatalogMediaReplicaResult,
  type CatalogMediaReplicationInput,
  type CatalogMediaReplicationResult,
} from './03_application_yingyong/CatalogMediaReplication';
export type {
  CatalogMediaObjectStorage,
  CatalogMediaObjectUpload,
  CatalogMediaPurpose,
  CatalogMediaStoredObject,
  CatalogMediaStorageResolver,
  CatalogMediaTarget,
} from './03_application_yingyong/port/CatalogMediaObjectStorage';
export {
  CatalogProductMediaRegistration,
  type CatalogProductMediaRegistrationInput,
  type CatalogProductMediaRegistrationResult,
} from './03_application_yingyong/CatalogProductMediaRegistration';
export type { CatalogMediaPersistence } from './03_application_yingyong/port/CatalogMediaPersistence';
export { catalogMediaTargets } from './04_adapters_shixian/config/CatalogMediaTargets';
export {
  AliyunOssCatalogMediaStorage,
  type AliyunOssClient,
  type AliyunOssHeadResult,
} from './04_adapters_shixian/object_storage/AliyunOssCatalogMediaStorage';
export {
  createCatalogMediaStorageResolver,
  type AliyunOssClientConfiguration,
  type AliyunOssClientFactory,
} from './04_adapters_shixian/object_storage/CatalogMediaStorageResolver';
export { PgCatalogMediaPersistence } from './04_adapters_shixian/persistence/PgCatalogMediaPersistence';
export { catalogManifest } from './module.manifest';
