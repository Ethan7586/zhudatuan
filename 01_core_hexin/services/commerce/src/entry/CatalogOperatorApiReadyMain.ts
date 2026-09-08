import { catalogOperatorApiEnvironment } from '@shop/config/server';
import { createCatalogOperatorApiRuntime } from '../bootstrap/CatalogOperatorApiRuntime';

const runtime = await createCatalogOperatorApiRuntime(catalogOperatorApiEnvironment());
const manifest = runtime.manifest;
await runtime.close();
process.stdout.write(`CATALOG_OPERATOR_API_READY ${JSON.stringify({
  manifestId: manifest.manifest_id,
  manifestVersion: manifest.manifest_version,
  manifestDigest: manifest.manifest_digest,
  runtimeInstanceId: manifest.runtime_instance_id,
  resourceBindingVersion: manifest.resource_binding_set_ref.version,
  nodeId: manifest.node_id,
  scopeId: manifest.data_scope_ref.ref,
})}\n`);
