import type { IdentityNodeDefinition, IdentityNodeRegistry } from '@shop/sdk/identity-node';
import { resolveStorefrontNode, storefrontIdentityNodeRegistry } from './storefrontIdentity';

export function resolveStorefrontAuthOrigin(
  candidate: string | undefined,
  environment: string | undefined,
  node: IdentityNodeDefinition = resolveStorefrontNode(),
): string {
  const selected = candidate?.trim();
  if (selected !== undefined && exactOrigin(selected) === node.accountsOrigin) return node.accountsOrigin;
  if (environment !== 'production' && selected !== undefined) {
    const origin = exactOrigin(selected);
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return origin;
  }
  return node.accountsOrigin;
}

export function storefrontAuthHref(
  hostname?: string,
  registry: IdentityNodeRegistry = storefrontIdentityNodeRegistry(),
): string {
  const node = resolveStorefrontNode(hostname, registry);
  const authOrigin = resolveStorefrontAuthOrigin(
    process.env.NEXT_PUBLIC_AUTH_ORIGIN,
    process.env.NODE_ENV,
    node,
  );
  const target = new URL('/', authOrigin);
  target.searchParams.set('target', node.consumerTarget);
  target.searchParams.set('surface', 'web');
  target.searchParams.set('application', node.consumerApplication);
  return target.toString();
}

function exactOrigin(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password || parsed.search || parsed.hash
      || (parsed.pathname !== '/' && parsed.pathname !== '')) throw new Error('invalid');
    return parsed.origin;
  } catch {
    throw new Error('商城身份入口配置无效');
  }
}
