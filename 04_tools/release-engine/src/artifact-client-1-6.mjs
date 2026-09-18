import { DeliveryError } from './errors.mjs';
import { simpleDownloadEndpoint, simpleOssClientFromEnvironment } from './oss-client-1-6.mjs';
import { r2ClientFromEnvironment } from './r2-client-1-6.mjs';

export async function artifactClientFromEnvironment(environment = process.env) {
  const store = environment.ZDT_ARTIFACT_STORE || 'aliyun';
  if (store === 'aliyun') return simpleOssClientFromEnvironment(undefined, environment);
  if (store === 'r2') return r2ClientFromEnvironment(environment);
  throw new DeliveryError('ARTIFACT_STORE_UNKNOWN', `Unknown artifact store: ${store}`);
}

export function artifactDownloadClientFromEnvironment(publicClient, environment = process.env) {
  if ((environment.ZDT_ARTIFACT_STORE || 'aliyun') === 'r2') return publicClient;
  return simpleOssClientFromEnvironment(simpleDownloadEndpoint(publicClient.endpoint, environment.ALIYUN_OSS_INTERNAL_ENDPOINT), environment);
}
