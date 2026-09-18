import {
  catalogOperatorApiAllowedOrigins,
  catalogOperatorApiEnvironment,
  catalogOperatorApiPort,
} from '@shop/config/server';
import { bootstrapApi } from '../bootstrap/ApiBootstrap';
import { createCatalogOperatorApiRuntime } from '../bootstrap/CatalogOperatorApiRuntime';
import { listen } from '../foundation/interface/NodeServer';
import { CATALOG_OPERATOR_OPERATION_IDS } from '../modules/catalog/03_application_yingyong/CatalogOperatorOperations';
import { CatalogOperatorModule } from '../modules/catalog/IdentityOperatorCatalogModule';
import { CATALOG_OPERATOR_RUNTIME_OPERATION_IDS } from '../modules/runtime/CatalogOperatorRuntimeOperations';
import { CatalogOperatorRuntimeModule } from '../modules/runtime/CatalogOperatorRuntimeModule';

const environment = catalogOperatorApiEnvironment();
const runtime = await createCatalogOperatorApiRuntime(environment);
const operationIds = Object.freeze([
  ...CATALOG_OPERATOR_RUNTIME_OPERATION_IDS,
  ...CATALOG_OPERATOR_OPERATION_IDS,
]);
const bootstrapped = await bootstrapApi({
  modules: [
    CatalogOperatorRuntimeModule,
    CatalogOperatorModule,
  ],
  operationIds,
  extensions: runtime.extensions,
  configure: runtime.configure,
  allowedOrigins: catalogOperatorApiAllowedOrigins(environment),
  telemetry: runtime.telemetry,
  runtimeNodeIds: [runtime.manifest.node_id],
});
const server = listen(
  bootstrapped.app,
  catalogOperatorApiPort(environment),
  '127.0.0.1',
  bootstrapped.nodeContextResolver,
);

for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, async () => {
    await server.close();
    await runtime.close();
    process.exit(0);
  });
