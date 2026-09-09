import {
  identityNodeForAccountsHost,
  parseIdentityNodeRegistry,
  type IdentityNodeDefinition,
  type IdentityNodeRegistry,
} from '@shop/sdk/identity-node';

interface IdentityNodeRuntime {
  readonly schema_version: 'sfl.identity-node-runtime.v1';
  readonly source_sha: string;
  readonly build_id: string;
  readonly build_count: 1;
  readonly immutable_artifact_digest: string;
  readonly identity_node_registry: IdentityNodeRegistry;
}

let runtimeRegistry: IdentityNodeRegistry | null = null;

export async function loadIdentityNodeRuntime(
  fetcher: typeof fetch = fetch,
  hostname: string | undefined = typeof window === 'undefined' ? undefined : window.location.hostname,
): Promise<boolean> {
  const response = await fetcher('/identity-runtime.json', { cache: 'no-store', credentials: 'same-origin' });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`IDENTITY_NODE_RUNTIME_UNAVAILABLE:${response.status}`);
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) return false;
  installIdentityNodeRuntime(await response.json(), hostname);
  return true;
}

export function installIdentityNodeRuntime(value: unknown, hostname?: string): IdentityNodeRuntime {
  if (!isRecord(value) || value.schema_version !== 'sfl.identity-node-runtime.v1'
    || typeof value.source_sha !== 'string' || !/^[0-9a-f]{40,64}$/.test(value.source_sha)
    || typeof value.build_id !== 'string' || !value.build_id.trim()
    || value.build_count !== 1
    || typeof value.immutable_artifact_digest !== 'string'
    || !/^sha256:[0-9a-f]{64}$/.test(value.immutable_artifact_digest)) {
    throw new Error('IDENTITY_NODE_RUNTIME_INVALID');
  }
  const registry = parseIdentityNodeRegistry(JSON.stringify(value.identity_node_registry));
  if (hostname && identityNodeForAccountsHost(registry, hostname) === null) {
    throw new Error('IDENTITY_NODE_RUNTIME_HOST_MISMATCH');
  }
  runtimeRegistry = registry;
  return Object.freeze({
    schema_version: value.schema_version,
    source_sha: value.source_sha,
    build_id: value.build_id,
    build_count: value.build_count,
    immutable_artifact_digest: value.immutable_artifact_digest,
    identity_node_registry: registry,
  });
}

export function configuredIdentityNodeRegistry(
  source?: string,
): IdentityNodeRegistry {
  if (source?.trim()) return parseIdentityNodeRegistry(source);
  if (runtimeRegistry !== null) return runtimeRegistry;
  const builtRegistry = import.meta.env.VITE_IDENTITY_NODE_REGISTRY;
  if (!builtRegistry?.trim()) throw new Error('IDENTITY_NODE_REGISTRY_MISSING');
  return parseIdentityNodeRegistry(builtRegistry);
}

export function configuredIdentityNode(
  hostname: string | undefined = typeof window === 'undefined' ? undefined : window.location.hostname,
  registry: IdentityNodeRegistry = configuredIdentityNodeRegistry(),
): IdentityNodeDefinition | null {
  if (hostname === undefined || hostname === '') return null;
  return identityNodeForAccountsHost(registry, hostname);
}

export function currentIdentityNode(): IdentityNodeDefinition {
  const node = configuredIdentityNode();
  if (node === null) throw new Error('AUTH_REALM_ENTRY_INVALID');
  return node;
}

export function currentLoginIntent(
  search: string | undefined = typeof window === 'undefined' ? undefined : window.location.search,
): string | undefined {
  if (search === undefined || search === '') return undefined;
  const values = new URLSearchParams(search).getAll('login_intent');
  if (values.length === 0) return undefined;
  if (values.length !== 1 || !/^[A-Za-z0-9_-]{64}$/.test(values[0]!)) {
    throw new Error('跨节点登录凭证无效，请从原节点重新发起');
  }
  return values[0];
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
