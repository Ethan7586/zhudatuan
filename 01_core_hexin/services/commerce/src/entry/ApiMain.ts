import { apiAllowedOrigins, apiEnvironment, apiPort } from '@shop/config/server';
import { bootstrapApi } from '../bootstrap/ApiBootstrap';
import { createRuntime } from '../bootstrap/CommerceRuntime';
import { listen } from '../foundation/interface/NodeServer';
import { COMMERCE_MODULES } from '../app/modules';
import { assertRuntimeCompatibility } from '../bootstrap/RuntimeCompatibility';

const environment = apiEnvironment();
const runtime = await createRuntime(environment, 'api');
const bootstrapped = await bootstrapApi({ modules: COMMERCE_MODULES, extensions: runtime.extensions, configure: runtime.configure,
  allowedOrigins: apiAllowedOrigins(environment), telemetry: runtime.telemetry });
await assertRuntimeCompatibility(runtime.pool, runtime.extensions, 'api', runtime.cache.state());
const server = listen(bootstrapped.app, apiPort(environment));

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, async () => {
  await server.close();
  await runtime.close();
  process.exit(0);
});
