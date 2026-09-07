import {
  defaultIdentityNode,
  identityNodeForStorefrontHost,
  parseIdentityNodeRegistry,
  type IdentityNodeDefinition,
  type IdentityNodeRegistry,
} from '@shop/sdk/identity-node';

export interface StorefrontPresentationIdentity {
  readonly mallName: string;
  readonly brandName: string;
}

function currentStorefrontHostname(): string {
  if (typeof window !== 'undefined' && window.location?.hostname) return window.location.hostname;
  return process.env.NEXT_PUBLIC_STOREFRONT_HOSTNAME || 'zhudatuan.com';
}

export function storefrontIdentityNodeRegistry(
  source: string | undefined = process.env.NEXT_PUBLIC_IDENTITY_NODE_REGISTRY,
): IdentityNodeRegistry {
  if (!source?.trim()) throw new Error('IDENTITY_NODE_REGISTRY_MISSING');
  return parseIdentityNodeRegistry(source);
}

export function resolveStorefrontNode(
  hostname?: string,
  registry: IdentityNodeRegistry = storefrontIdentityNodeRegistry(),
): IdentityNodeDefinition {
  const browserHostname = typeof window === 'undefined' ? undefined : window.location?.hostname;
  const selectedHostname = hostname ?? browserHostname ?? process.env.NEXT_PUBLIC_STOREFRONT_HOSTNAME;
  if (selectedHostname === undefined || selectedHostname === '') return defaultIdentityNode(registry);
  const node = identityNodeForStorefrontHost(registry, selectedHostname);
  if (node === null) throw new Error('商城身份节点无效');
  return node;
}

export function resolveStorefrontApplication(
  hostname?: string,
  configured: string | undefined = process.env.NEXT_PUBLIC_STOREFRONT_APPLICATION,
  registry: IdentityNodeRegistry = storefrontIdentityNodeRegistry(),
): string {
  const node = resolveStorefrontNode(hostname, registry);
  const explicit = configured?.trim();
  if (explicit !== undefined && explicit !== '' && explicit !== node.consumerApplication) {
    throw new Error('商城身份节点无效');
  }
  return node.consumerApplication;
}

export function resolveStorefrontAuthTarget(
  application: string = resolveStorefrontApplication(),
  hostname?: string,
  registry: IdentityNodeRegistry = storefrontIdentityNodeRegistry(),
): string {
  const node = resolveStorefrontNode(hostname, registry);
  if (application !== node.consumerApplication) throw new Error('商城身份节点无效');
  return node.consumerTarget;
}

/** Keep the host's visible identity stable while the member scope hydrates. */
export function resolveStorefrontPresentationIdentity(
  hostname: string = currentStorefrontHostname(),
  configured: string | undefined = process.env.NEXT_PUBLIC_STOREFRONT_APPLICATION,
  registry: IdentityNodeRegistry = storefrontIdentityNodeRegistry(),
): StorefrontPresentationIdentity {
  const node = resolveStorefrontNode(hostname, registry);
  if (resolveStorefrontApplication(hostname, configured, registry) !== node.consumerApplication) {
    throw new Error('商城身份节点无效');
  }
  return { mallName: node.mallName, brandName: node.brandName };
}
