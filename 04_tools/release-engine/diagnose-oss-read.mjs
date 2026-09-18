import { simpleOssClientFromEnvironment } from './src/oss-client-1-6.mjs';
import { simpleReleaseObject } from './src/simple-artifact-store.mjs';

const client = simpleOssClientFromEnvironment();
const samples = [
  { name: 'known-identity', target: 'identity-api', sourceSha: process.env.KNOWN_SOURCE_SHA },
  { name: 'failed-auth', target: 'auth-web', sourceSha: process.env.FAILED_SOURCE_SHA },
  { name: 'same-source-identity', target: 'identity-api', sourceSha: process.env.FAILED_SOURCE_SHA },
];

for (const { name, target, sourceSha } of samples) {
  const object = simpleReleaseObject('zdt-next', target, sourceSha);
  try {
    await client.getObject(object);
    process.stdout.write(`${JSON.stringify({ name, status: 200, ossCode: 'OK' })}\n`);
  } catch (error) {
    const detail = String(error.details?.detail ?? '');
    const ossCode = /<Code>([^<]+)<\/Code>/.exec(detail)?.[1] ?? 'UNKNOWN';
    process.stdout.write(`${JSON.stringify({ name, status: error.details?.status ?? null, ossCode })}\n`);
  }
}
