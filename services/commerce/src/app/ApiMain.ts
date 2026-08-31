import { apiAllowedOrigins, apiBindHost, apiEnvironment, apiPort } from '@shop/config/server';
import { bootstrapApi } from '../bootstrap/ApiBootstrap';
import { createRuntime } from '../bootstrap/CommerceRuntime';
import { assertRuntimeReady } from '../bootstrap/RuntimeReadiness';
import { listen } from '../foundation/interface/NodeServer';
import { COMMERCE_MODULES } from './modules';

const environment = apiEnvironment();
const runtime = await createRuntime(environment, 'api');
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
