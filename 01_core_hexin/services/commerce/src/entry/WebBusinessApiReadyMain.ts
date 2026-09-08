import { webBusinessApiEnvironment, webBusinessApiPort } from '@shop/config/server';

const environment = webBusinessApiEnvironment();
const port = webBusinessApiPort(environment);
let last = 'not-started';
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health/ready`, {
      redirect: 'error',
      signal: AbortSignal.timeout(1_000),
    });
    const body: unknown = await response.json();
    if (response.status === 200 && body !== null && typeof body === 'object'
      && !Array.isArray(body) && Reflect.get(body, 'status') === 'ready'
      && Reflect.get(body, 'manifestId') === environment.NODE_MANIFEST_ID
      && Reflect.get(body, 'manifestDigest') === environment.NODE_MANIFEST_DIGEST
      && Reflect.get(body, 'runtimeInstanceId') === environment.NODE_RUNTIME_INSTANCE_ID
      && Reflect.get(body, 'resourceBindingVersion') === environment.NODE_RESOURCE_BINDING_VERSION) {
      process.stdout.write(`WEB_BUSINESS_API_READY ${JSON.stringify({
        manifestId: environment.NODE_MANIFEST_ID,
        manifestDigest: environment.NODE_MANIFEST_DIGEST,
        runtimeInstanceId: environment.NODE_RUNTIME_INSTANCE_ID,
        resourceBindingVersion: environment.NODE_RESOURCE_BINDING_VERSION,
      })}\n`);
      process.exit(0);
    }
    last = `status-${response.status}`;
  } catch (cause) {
    last = cause instanceof Error ? cause.message.slice(0, 120) : 'request-failed';
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
throw new Error(`WEB_BUSINESS_API_NOT_READY:${last}`);
