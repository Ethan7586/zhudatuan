import { localInfrastructureEnvironment } from '@shop/config/server';

const environment = localInfrastructureEnvironment();
const expected = process.env.NODE_MANIFEST_ID ? {
  manifestId: process.env.NODE_MANIFEST_ID,
  manifestDigest: process.env.NODE_MANIFEST_DIGEST,
  runtimeInstanceId: process.env.NODE_RUNTIME_INSTANCE_ID,
  resourceBindingVersion: process.env.NODE_RESOURCE_BINDING_VERSION,
} : null;
let last = 'not-started';
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    const response = await fetch(`https://127.0.0.1:${environment.objectsPort}/health/ready`, {
      redirect: 'error', signal: AbortSignal.timeout(1_000),
    });
    const body: unknown = await response.json();
    if (response.status === 200 && body !== null && typeof body === 'object'
      && !Array.isArray(body) && Reflect.get(body, 'status') === 'ready'
      && (expected === null || Object.entries(expected).every(([key, value]) => value !== undefined && Reflect.get(body, key) === value))) {
      process.stdout.write(`CATALOG_OBJECT_STORE_READY${expected === null ? '' : ` ${JSON.stringify(expected)}`}\n`);
      process.exit(0);
    }
    last = `status-${response.status}`;
  } catch (cause) {
    last = cause instanceof Error ? cause.message.slice(0, 120) : 'request-failed';
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
throw new Error(`CATALOG_OBJECT_STORE_NOT_READY:${last}`);
