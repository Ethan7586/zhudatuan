import { createRequire as createNodeRequire } from 'node:module';
import type { CatalogMediaStorageResolver, CatalogMediaTarget } from '../../03_application_yingyong/port/CatalogMediaObjectStorage';
import { AliyunOssCatalogMediaStorage, type AliyunOssClient } from './AliyunOssCatalogMediaStorage';

export interface AliyunOssClientConfiguration {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly accessKeySecret: string;
}

export type AliyunOssClientFactory = (configuration: AliyunOssClientConfiguration) => AliyunOssClient;
type MediaTargetEnvironment = Readonly<Record<string, string | undefined>>;

export function createCatalogMediaStorageResolver(
  environment: MediaTargetEnvironment = process.env,
  createClient: AliyunOssClientFactory = createAliyunOssClient,
): CatalogMediaStorageResolver {
  const storages = new Map<string, AliyunOssCatalogMediaStorage>();
  return (target) => {
    const existing = storages.get(target.id);
    if (existing) return existing;
    if (target.provider !== 'aliyun-oss') throw new Error(`CATALOG_MEDIA_PROVIDER_UNSUPPORTED:${target.provider}`);
    const prefix = `CATALOG_MEDIA_${environmentTargetId(target.id)}_`;
    const storage = new AliyunOssCatalogMediaStorage(createClient({
      endpoint: target.endpoint,
      region: target.region,
      bucket: target.bucket,
      accessKeyId: environment[`${prefix}ACCESS_KEY_ID`] ?? '',
      accessKeySecret: environment[`${prefix}ACCESS_KEY_SECRET`] ?? '',
    }));
    storages.set(target.id, storage);
    return storage;
  };
}

function createAliyunOssClient(configuration: AliyunOssClientConfiguration): AliyunOssClient {
  const require = createNodeRequire(import.meta.url);
  const AliyunOss = require('ali-oss') as new (options: AliyunOssClientConfiguration) => AliyunOssClient;
  return new AliyunOss(configuration);
}

function environmentTargetId(targetId: CatalogMediaTarget['id']): string {
  return targetId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
}
