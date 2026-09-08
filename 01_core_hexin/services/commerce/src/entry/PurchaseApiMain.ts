import { purchaseApiAllowedOrigins, purchaseApiEnvironment, purchaseApiPort } from '@shop/config/server';
import { bootstrapApi } from '../bootstrap/ApiBootstrap';
import { createPurchaseApiRuntime } from '../bootstrap/PurchaseApiRuntime';
import { listen } from '../foundation/interface/NodeServer';
import { PURCHASE_MODULES } from '../modules/purchase/PurchaseModules';
import { PURCHASE_OPERATION_IDS } from '../modules/purchase/PurchaseOperations';
import { PurchaseRuntimeModule } from '../modules/runtime/PurchaseRuntimeModule';
import { PURCHASE_RUNTIME_OPERATION_IDS } from '../modules/runtime/PurchaseRuntimeOperations';

const environment = purchaseApiEnvironment();
const runtime = await createPurchaseApiRuntime(environment);
const operationIds = Object.freeze([...PURCHASE_RUNTIME_OPERATION_IDS, ...PURCHASE_OPERATION_IDS]);
const bootstrapped = await bootstrapApi({
  modules: [PurchaseRuntimeModule, ...PURCHASE_MODULES],
  operationIds,
  extensions: runtime.extensions,
  configure: runtime.configure,
  allowedOrigins: purchaseApiAllowedOrigins(environment),
  telemetry: runtime.telemetry,
});
const server = listen(bootstrapped.app, purchaseApiPort(environment), '127.0.0.1', bootstrapped.nodeContextResolver);

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, async () => {
  await server.close();
  await runtime.close();
  process.exit(0);
});
