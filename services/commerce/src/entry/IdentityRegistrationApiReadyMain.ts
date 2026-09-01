import { identityRegistrationApiEnvironment, identityRegistrationApiPort } from '@shop/config/server';

const environment = identityRegistrationApiEnvironment();
const port = identityRegistrationApiPort(environment);
let last = 'not-started';
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health/ready`, {
      redirect: 'error',signal: AbortSignal.timeout(1_000),
    });
    const body: unknown = await response.json();
    if (response.status === 200 && body !== null && typeof body === 'object'
      && !Array.isArray(body) && Reflect.get(body, 'status') === 'ready') {
      process.stdout.write('ZHUDATUAN_IDENTITY_REGISTRATION_API_READY\n');
      process.exit(0);
    }
    last = `status-${response.status}`;
  } catch (cause) {
    last = cause instanceof Error ? cause.message.slice(0,120) : 'request-failed';
  }
  await new Promise((resolve) => setTimeout(resolve,500));
}
throw new Error(`ZHUDATUAN_IDENTITY_REGISTRATION_API_NOT_READY:${last}`);
