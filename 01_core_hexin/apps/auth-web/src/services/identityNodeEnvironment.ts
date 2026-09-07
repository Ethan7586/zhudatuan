import {
  defaultIdentityNode,
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
  return hostname === undefined || hostname === ''
    ? defaultIdentityNode(registry)
    : identityNodeForAccountsHost(registry, hostname);
}

export function currentIdentityNode(): IdentityNodeDefinition {
  const node = configuredIdentityNode();
  if (node === null) throw new Error('AUTH_REALM_ENTRY_INVALID');
  return node;
}
