import {
  webBusinessApiAllowedOrigins,
  webBusinessApiEnvironment,
  webBusinessApiPort,
  webBusinessApiPublicMallHostMappings,
  webBusinessApiPublicMallSlug,
} from '@shop/config/server';

// This entry is the independently deployed web-business runtime for each sovereign node.
import { bootstrapApi } from '../bootstrap/ApiBootstrap';
import { createWebBusinessApiRuntime } from '../bootstrap/WebBusinessApiRuntime';
import { listen } from '../foundation/interface/NodeServer';
import { WebBusinessRuntimeModule } from '../modules/runtime/WebBusinessRuntimeModule';
import { WEB_BUSINESS_RUNTIME_OPERATION_IDS } from '../modules/runtime/WebBusinessRuntimeOperations';
import { WEB_BUSINESS_MODULES } from '../modules/webbusiness/WebBusinessModules';
import { WEB_BUSINESS_OPERATION_IDS } from '../modules/webbusiness/WebBusinessOperationIds';
import { PUBLIC_CATALOG_INTERFACE, PublicCatalogHttpHandler } from '../modules/webbusiness/PublicCatalogHttpHandler';

const environment = webBusinessApiEnvironment();
const runtime = await createWebBusinessApiRuntime(environment);
const allowedOrigins = webBusinessApiAllowedOrigins(environment);
const operationIds = Object.freeze([
  ...WEB_BUSINESS_RUNTIME_OPERATION_IDS,
  ...WEB_BUSINESS_OPERATION_IDS,
]);
const bootstrapped = await bootstrapApi({
  modules: [WebBusinessRuntimeModule, ...WEB_BUSINESS_MODULES],
  operationIds,
  extensions: runtime.extensions,
  configure: runtime.configure,
  allowedOrigins,
  telemetry: runtime.telemetry,
  gateEngine: runtime.gateEngine,
  runtimeNodeIds: [runtime.manifest.node_id],
});
bootstrapped.arch.mount(runtime.manifest.node_id, PUBLIC_CATALOG_INTERFACE);
const app = new PublicCatalogHttpHandler(
  bootstrapped.app, runtime.pool, webBusinessApiPublicMallSlug(environment), allowedOrigins,
  webBusinessApiPublicMallHostMappings(environment), bootstrapped.arch, runtime.manifest.node_id,
);
const server = listen(app, webBusinessApiPort(environment), '127.0.0.1', bootstrapped.nodeContextResolver);

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, async () => {
  await server.close();
  await runtime.close();
  process.exit(0);
});
