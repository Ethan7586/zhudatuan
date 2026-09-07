import { catalogJobsEnvironment, createCatalogJobsRuntime } from '../bootstrap/CatalogJobsRuntime';

const runtime = await createCatalogJobsRuntime(catalogJobsEnvironment());
const manifest = runtime.manifest;
await runtime.close();
process.stdout.write(`CATALOG_JOBS_READY ${JSON.stringify({
  manifestId: manifest.manifest_id,
  manifestVersion: manifest.manifest_version,
  manifestDigest: manifest.manifest_digest,
  runtimeInstanceId: manifest.runtime_instance_id,
  resourceBindingVersion: manifest.resource_binding_version,
  nodeId: manifest.node_id,
  scopeId: manifest.data_scope_ref,
})}\n`);
