import { localIdentityInfrastructureEnvironment, localInfrastructureEnvironment } from '@shop/config/server';

const fullStaging = process.env.LOCAL_RUNTIME_PROFILE === 'full-staging';
const fullEnvironment = fullStaging ? localInfrastructureEnvironment() : undefined;
const environment = fullEnvironment ?? localIdentityInfrastructureEnvironment();
const services = [
  ready(`https://127.0.0.1:${environment.secretsPort}/health/ready`, 'SECRET_STORE'),
  ready(`https://127.0.0.1:${environment.kmsPort}/health/ready`, 'KMS'),
];
if (fullEnvironment) services.push(ready(`https://127.0.0.1:${fullEnvironment.objectsPort}/health/ready`, 'OBJECT_STORE'));
await Promise.all(services);
process.stdout.write(`ZHUDATUAN_INTERNAL_RUNTIME_READY services=secret-store,kms${fullStaging ? ',object-store' : ''}\n`);

async function ready(url: string, service: string): Promise<void> {
  let last = 'not-started';
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(1_000) });
      const body: unknown = await response.json();
      if (response.status === 200 && body !== null && typeof body === 'object'
        && !Array.isArray(body) && Reflect.get(body, 'status') === 'ready') return;
      last = `status-${response.status}`;
    } catch (cause) {
      last = cause instanceof Error ? cause.message.slice(0, 120) : 'request-failed';
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`ZHUDATUAN_INTERNAL_RUNTIME_NOT_READY:${service}:${last}`);
}
