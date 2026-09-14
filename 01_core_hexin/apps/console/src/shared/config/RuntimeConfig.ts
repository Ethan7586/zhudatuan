import {
  normalizeConsoleClientVersion,
  parseSflConsoleArtifact,
  parseSflConsoleNodeRuntime,
  resolveConsoleAppConfig,
  resolveConsoleNodeRuntimeConfig,
  type ConsoleAppConfig,
} from '@shop/config/sfl-console-runtime';
import {
  generateNodeManifest,
  nodeContextOf,
  resolveNodeDomainBindingByHost,
} from '@shop/config/sfl-node-kernel';

let installedConfig: ConsoleAppConfig | undefined;
let loadingConfig: Promise<ConsoleAppConfig> | undefined;

export function loadConsoleRuntimeConfig(): Promise<ConsoleAppConfig> {
  if (installedConfig !== undefined) return Promise.resolve(installedConfig);
  const hostname = browserHostname();
  loadingConfig ??= isLocalHostname(hostname)
    ? loadLocalConfig(hostname)
    : loadProductionConfig(hostname);
  return loadingConfig;
}

export function requireConsoleRuntimeConfig(): ConsoleAppConfig {
  if (installedConfig === undefined) throw new Error('CONSOLE_RUNTIME_CONFIG_NOT_READY');
  return installedConfig;
}

async function loadProductionConfig(hostname: string): Promise<ConsoleAppConfig> {
  const nodeResponsePromise = fetch('/console-runtime.json', {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
    redirect: 'error',
  });
  const nodeResponse = await nodeResponsePromise;
  const contentType = nodeResponse.headers.get('content-type')?.toLowerCase() ?? '';
  if (nodeResponse.ok && contentType.includes('json')) {
    const runtime = await parseSflConsoleNodeRuntime(await nodeResponse.json());
    return install(resolveConsoleNodeRuntimeConfig(runtime, hostname));
  }
  if (!nodeResponse.ok && nodeResponse.status !== 404) {
    throw new Error(`CONSOLE_NODE_RUNTIME_CONFIG_HTTP_${nodeResponse.status}`);
  }
  const response = await fetch('/console-build.json', {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`CONSOLE_RUNTIME_CONFIG_HTTP_${response.status}`);
  const artifact = await parseSflConsoleArtifact(await response.json());
  return install(resolveConsoleAppConfig(artifact, hostname));
}

async function loadLocalConfig(hostname: string): Promise<ConsoleAppConfig> {
  const consoleOrigin = browserOrigin(hostname);
  const identityOrigin = 'http://127.0.0.1:3002';
  const immutableArtifactDigest = `sha256:${'0'.repeat(64)}` as const;
  const nodeManifest = await generateNodeManifest({
    manifest_id: 'manifest:local-development:console',
    manifest_revision: 0,
    generated_at: '2026-09-08T00:00:00.000Z',
    lifecycle_status: 'provisioning',
    line_id: 'line:local-development',
    node_id: 'node:local-development:l0',
    parent_node_id: null,
    signed_level: 'L0',
    node_profile: 'operating_mall',
    mall_id: 'mall:local-development',
    host_node_id: null,
    domain_bindings: [{
      host: hostname,
      binding_ref: { ref: 'domain:local-development:console', version: '1' },
      application_ref: 'application:console',
      surface_ref: 'surface:console',
    }],
    brand_ref: { ref: 'brand:local-development', version: '1' },
    applications: [{ ref: 'application:console', version: '1' }],
    surfaces: [{ ref: 'surface:console', version: '1' }],
    enabled_features: [{ ref: 'feature:console', version: '1' }],
    api_contract_refs: [{ ref: 'contract:commerce-api', version: '1.0.0' }],
    realm_ref: { ref: 'realm:local-development', version: '1' },
    data_scope_ref: { ref: 'organization-platform-root', version: '1' },
    resource_binding_set_ref: { ref: 'resource-binding:local-development:console', version: '1' },
    secret_binding_set_ref: { ref: 'secret-binding:local-development', version: '1' },
    payment_binding_refs: [],
    callback_binding_refs: [],
    runtime_instance_id: 'runtime:local-development:console',
    runtime_config_ref: { ref: 'runtime-config:local-development:console', version: '1' },
    release_pointer_ref: {
      ref: 'release:local-development:console',
      version: '1',
      source_sha: '0'.repeat(40),
      build_id: 'local-development',
      build_count: 1,
      immutable_artifact_digest: immutableArtifactDigest,
    },
  });
  return install(Object.freeze({
    apiBaseUrl: consoleOrigin,
    identityOrigin,
    identityEntryUrl: `${identityOrigin}/?target=console`,
    consoleOrigin,
    clientVersion: normalizeConsoleClientVersion(import.meta.env.VITE_CLIENT_VERSION),
    scope: Object.freeze({ kind: 'platform', id: nodeManifest.data_scope_ref.ref }),
    nodeManifest,
    nodeContext: nodeContextOf(nodeManifest),
    domainBinding: resolveNodeDomainBindingByHost(nodeManifest, hostname),
    sourceSha: nodeManifest.release_pointer_ref.source_sha,
    buildId: nodeManifest.release_pointer_ref.build_id,
    buildCount: 1,
    immutableArtifactDigest,
  }));
}

function install(config: ConsoleAppConfig): ConsoleAppConfig {
  installedConfig = config;
  return config;
}

function browserHostname(): string {
  return typeof window === 'undefined' ? 'localhost' : window.location.hostname.toLowerCase();
}

function browserOrigin(hostname: string): string {
  if (typeof window !== 'undefined' && window.location.origin !== 'null') return window.location.origin;
  return `http://${hostname}`;
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}
