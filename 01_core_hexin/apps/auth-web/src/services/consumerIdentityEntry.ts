// SFL-D02：兼容旧 target/application 查询参数；只识别入口，不承担授权判定。
import type { IdentityNodeDefinition, IdentityNodeRegistry } from '@shop/sdk/identity-node';
import { configuredIdentityNode, configuredIdentityNodeRegistry } from './identityNodeEnvironment';
export interface ConsumerIdentityEntry {
  readonly application: string;
  readonly target: string;
}

export type IdentityEntry =
  | Readonly<{
      kind: 'consumer';
      nodeId: string;
      application: string;
      target: string;
      storefrontOrigin: string;
    }>
  | Readonly<{
      kind: 'operator';
      nodeId: string;
      target: string;
      adminOrigin: string;
      displayName: string;
    }>;

export function resolveConsumerIdentityEntry(
  search: string,
  node: IdentityNodeDefinition,
): ConsumerIdentityEntry | null {
  const params = new URLSearchParams(search);
  if (params.get('application')?.trim() !== node.consumerApplication) return null;
  if (params.get('target')?.trim() !== node.consumerTarget) return null;
  return Object.freeze({ application: node.consumerApplication, target: node.consumerTarget });
}

export function resolveIdentityEntry(
  search: string,
  hostname: string,
  registry: IdentityNodeRegistry = configuredIdentityNodeRegistry(),
): IdentityEntry | null {
  const node = configuredIdentityNode(hostname, registry);
  if (node === null) return null;

  const consumer = resolveConsumerIdentityEntry(search, node);
  if (consumer !== null) {
    return Object.freeze({
      kind: 'consumer', nodeId: node.nodeId, ...consumer, storefrontOrigin: node.storefrontOrigin,
    });
  }

  const params = new URLSearchParams(search);
  const target = params.get('target')?.trim() ?? '';
  const client = params.get('client')?.trim() ?? '';
  const application = params.get('application')?.trim() ?? '';
  const adminOrigin = params.get('admin_origin')?.trim() ?? '';
  const consumerIntent = application !== '' || params.get('surface') === 'web'
    || registry.nodes.some((candidate) => candidate.consumerTarget === target);
  if (consumerIntent) return null;
  if ((target && target !== node.adminTarget) || (client && client !== node.adminTarget)
    || (adminOrigin && adminOrigin !== node.adminOrigin)) return null;
  return Object.freeze({
    kind: 'operator', nodeId: node.nodeId, target: node.adminTarget,
    adminOrigin: node.adminOrigin, displayName: node.displayName,
  });
}

export function recoverLocalIdentitySearch(
  search: string,
  hostname: string,
  registry: IdentityNodeRegistry = configuredIdentityNodeRegistry(),
): string | null {
  const node = configuredIdentityNode(hostname, registry);
  if (node === null || resolveIdentityEntry(search, hostname, registry) !== null) return null;

  const params = new URLSearchParams(search);
  const target = params.get('target')?.trim() ?? '';
  const client = params.get('client')?.trim() ?? '';
  const application = params.get('application')?.trim() ?? '';
  const consumerIntent = application !== '' || params.get('surface') === 'web'
    || registry.nodes.some((candidate) => candidate.consumerTarget === target);
  if (consumerIntent) {
    params.set('target', node.consumerTarget);
    params.set('surface', 'web');
    params.set('application', node.consumerApplication);
    params.delete('client');
    params.delete('admin_origin');
    return `?${params.toString()}`;
  }

  const operatorIntent = target !== '' || client !== '' || params.has('admin_origin');
  if (!operatorIntent) return null;
  params.set('target', node.adminTarget);
  params.set('client', node.adminTarget);
  params.set('admin_origin', node.adminOrigin);
  params.delete('application');
  params.delete('surface');
  return `?${params.toString()}`;
}
