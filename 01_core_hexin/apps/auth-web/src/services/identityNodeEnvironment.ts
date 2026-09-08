import {
  identityNodeForAccountsHost,
  parseIdentityNodeRegistry,
  type IdentityNodeDefinition,
  type IdentityNodeRegistry,
} from '@shop/sdk/identity-node';

export function configuredIdentityNodeRegistry(
  source: string | undefined = import.meta.env.VITE_IDENTITY_NODE_REGISTRY,
): IdentityNodeRegistry {
  if (!source?.trim()) throw new Error('IDENTITY_NODE_REGISTRY_MISSING');
  return parseIdentityNodeRegistry(source);
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
