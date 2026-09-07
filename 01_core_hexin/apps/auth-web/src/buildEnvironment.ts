import { parseIdentityNodeRegistry, type IdentityNodeRegistry } from '@shop/sdk/identity-node';

export interface AuthBuildEnvironment {
  readonly identityNodes: IdentityNodeRegistry;
  readonly clientVersion: string;
}

export function validateAuthBuildEnvironment(source: Readonly<Record<string, string | undefined>>): AuthBuildEnvironment {
  const registrySource = required(source.VITE_IDENTITY_NODE_REGISTRY, 'AUTH_CLIENT_IDENTITY_NODE_REGISTRY_MISSING');
  const identityNodes = parseIdentityNodeRegistry(registrySource);
  if (identityNodes.nodes.some((node) => [node.accountsOrigin, node.apiOrigin, node.consumerApiOrigin,
    node.storefrontOrigin, ...(node.adminOrigin === null ? [] : [node.adminOrigin])]
    .some((origin) => !origin.startsWith('https://')))) {
    throw new Error('AUTH_CLIENT_IDENTITY_NODE_ORIGIN_INVALID');
  }
  const clientVersion = required(source.VITE_CLIENT_VERSION, 'AUTH_CLIENT_VERSION_MISSING');
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.]+)?$/i.test(clientVersion)) throw new Error('AUTH_CLIENT_VERSION_INVALID');
  return Object.freeze({ identityNodes, clientVersion });
}

function required(value: string | undefined, code: string): string {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}
