import { apiAllowedOrigins, apiBindHost, apiEnvironment, apiPort } from '@shop/config/server';
import { bootstrapApi } from '../composition/ApiBootstrap';
import { createApplication } from '../composition/Application';
import { assertRuntimeReady } from '../composition/RuntimeReadiness';
import { listen } from '../platform/http/NodeServer';
import { COMMERCE_MODULES } from '../generated/ModuleCatalog';

const environment = apiEnvironment();
const runtime = await createApplication(environment, 'api');
const bootstrapped = await bootstrapApi({
  modules: COMMERCE_MODULES,
  extensions: runtime.extensions,
  configure: runtime.configure,
  allowedOrigins: apiAllowedOrigins(environment),
  telemetry: runtime.telemetry,
});
await assertRuntimeReady(runtime.pool, runtime.extensions, 'api', runtime.invitationKeyVersions);
const server = listen(bootstrapped.app, apiPort(environment), apiBindHost(environment));

for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, async () => {
    await server.close();
    await runtime.close();
    process.exit(0);
  });
