<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import { apiAllowedOrigins, apiBindHost, apiEnvironment, apiPort } from '@shop/config/server';
=======
import { apiAllowedOrigins, apiEnvironment, apiPort } from '@shop/config/server';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { apiAllowedOrigins, apiBindHost, apiEnvironment, apiPort } from '@shop/config/server';
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
import { apiAllowedOrigins, apiEnvironment, apiPort } from '@shop/config/server';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
import { bootstrapApi } from '../bootstrap/ApiBootstrap';
import { createRuntime } from '../bootstrap/CommerceRuntime';
import { listen } from '../foundation/interface/NodeServer';
import { COMMERCE_MODULES } from '../app/modules';
import { assertRuntimeCompatibility } from '../bootstrap/RuntimeCompatibility';

const environment = apiEnvironment();
const runtime = await createRuntime(environment, 'api');
const bootstrapped = await bootstrapApi({ modules: COMMERCE_MODULES, extensions: runtime.extensions, configure: runtime.configure,
  allowedOrigins: apiAllowedOrigins(environment), telemetry: runtime.telemetry });
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
await assertRuntimeCompatibility(runtime.pool, runtime.extensions, 'api')
  .catch((cause: unknown) => console.warn('RUNTIME_COMPATIBILITY_WARNING', cause));
const server = listen(bootstrapped.app, apiPort(environment), apiBindHost(environment));
=======
await assertRuntimeCompatibility(runtime.pool, runtime.extensions, 'api');
const server = listen(bootstrapped.app, apiPort(environment));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
await assertRuntimeCompatibility(runtime.pool, runtime.extensions, 'api')
  .catch((cause: unknown) => console.warn('RUNTIME_COMPATIBILITY_WARNING', cause));
const server = listen(bootstrapped.app, apiPort(environment), apiBindHost(environment));
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
await assertRuntimeCompatibility(runtime.pool, runtime.extensions, 'api');
const server = listen(bootstrapped.app, apiPort(environment));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, async () => {
  await server.close();
  await runtime.close();
  process.exit(0);
});
