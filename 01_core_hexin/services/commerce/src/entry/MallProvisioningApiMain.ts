import {
  mallProvisioningApiAllowedOrigins,
  mallProvisioningApiEnvironment,
  mallProvisioningApiPort,
} from '@shop/config/server';
import { bootstrapApi } from '../bootstrap/ApiBootstrap';
import { createMallProvisioningApiRuntime } from '../bootstrap/MallProvisioningApiRuntime';
import { listen } from '../foundation/interface/NodeServer';
import { MallProvisioningModule } from '../modules/provisioning/MallProvisioningModule';
import { MALL_PROVISIONING_OPERATION_IDS } from '../modules/provisioning/ProvisioningOperations';
import { MallProvisioningRuntimeModule } from '../modules/runtime/MallProvisioningRuntimeModule';
import { MALL_PROVISIONING_RUNTIME_OPERATION_IDS } from '../modules/runtime/MallProvisioningRuntimeOperations';

const environment = mallProvisioningApiEnvironment();
const runtime = await createMallProvisioningApiRuntime(environment);
const operationIds = Object.freeze([
  ...MALL_PROVISIONING_RUNTIME_OPERATION_IDS,
  ...MALL_PROVISIONING_OPERATION_IDS,
]);
const bootstrapped = await bootstrapApi({
  modules: [MallProvisioningRuntimeModule, MallProvisioningModule],
  operationIds,
  extensions: runtime.extensions,
  configure: runtime.configure,
  allowedOrigins: mallProvisioningApiAllowedOrigins(environment),
  telemetry: runtime.telemetry,
});
const server = listen(bootstrapped.app, mallProvisioningApiPort(environment), '127.0.0.1');

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, async () => {
  await server.close();
  await runtime.close();
  process.exit(0);
});
