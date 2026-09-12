import type { CatalogMediaTarget } from '../../03_application_yingyong/port/CatalogMediaObjectStorage';

type MediaTargetEnvironment = Readonly<Record<string, string | undefined>>;

export function catalogMediaTargets(environment: MediaTargetEnvironment = process.env): readonly CatalogMediaTarget[] {
  return Object.freeze([
    target(environment, 'ZHUDATUAN', 'zhudatuan', 'https://media.zhudatuan.com'),
    target(environment, 'FUFU', 'fufu', 'https://media.fufu.com'),
  ]);
}

function target(
  environment: MediaTargetEnvironment,
  environmentName: string,
  id: string,
  publicBaseUrl: string,
): CatalogMediaTarget {
  const prefix = `CATALOG_MEDIA_${environmentName}_`;
  return Object.freeze({
    id,
    provider: environment[`${prefix}PROVIDER`] ?? 'aliyun-oss',
    endpoint: environment[`${prefix}ENDPOINT`] ?? '',
    region: environment[`${prefix}REGION`] ?? '',
    bucket: environment[`${prefix}BUCKET`] ?? '',
    publicBaseUrl: environment[`${prefix}PUBLIC_BASE_URL`] ?? publicBaseUrl,
    required: environment[`${prefix}REQUIRED`] !== 'false',
    enabled: environment[`${prefix}ENABLED`] !== 'false',
  });
}
