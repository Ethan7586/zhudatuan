import { IDENTITY_NODE_MANIFEST, type IdentityNodeManifest } from '@shop/config/identity-node-manifest';

export type IdentityNodeProfile = 'operating_mall' | 'consumer';

interface IdentityNodeDefinitionBase {
  readonly nodeId: string;
  readonly nodeProfile: IdentityNodeProfile;
  readonly displayName: string;
  readonly mallName: string;
  readonly brandName: string;
  readonly accountsOrigin: string;
  readonly accountsHost: string;
  readonly apiOrigin: string;
  readonly consumerApiOrigin: string;
  readonly storefrontOrigin: string;
  readonly storefrontHosts: readonly string[];
  readonly consumerTarget: string;
  readonly consumerApplication: string;
}

export interface OperatingMallIdentityNodeDefinition extends IdentityNodeDefinitionBase {
  readonly nodeProfile: 'operating_mall';
  readonly mallId: string;
  readonly hostNodeId: null;
  readonly adminOrigin: string;
  readonly adminTarget: string;
}

export interface ConsumerIdentityNodeDefinition extends IdentityNodeDefinitionBase {
  readonly nodeProfile: 'consumer';
  readonly mallId: null;
  readonly hostNodeId: string;
  readonly adminOrigin: null;
  readonly adminTarget: null;
}

export type IdentityNodeDefinition = OperatingMallIdentityNodeDefinition | ConsumerIdentityNodeDefinition;

export interface IdentityNodeRegistry {
  readonly version: 2;
  readonly nodes: readonly IdentityNodeDefinition[];
}

export function identityNodeRegistryFromManifest(
  manifest: IdentityNodeManifest = IDENTITY_NODE_MANIFEST,
): IdentityNodeRegistry {
  if (manifest.schema !== 'sfl.identity-node-projection.v1' || manifest.version !== 2) {
    throw new Error('IDENTITY_NODE_MANIFEST_INVALID');
  }
  const activeNodes = manifest.nodes.filter((node) => node.status === 'active');
  const nodes = activeNodes.map((node) => {
    const accountsHost = new URL(node.accountsOrigin).hostname;
    const apiHost = new URL(node.apiOrigin).hostname;
    if (!node.entries.some((entry) => entry.status === 'active' && entry.kind === 'accounts' && entry.host === accountsHost)
      || !node.entries.some((entry) => entry.status === 'active' && entry.kind === 'api' && entry.host === apiHost)) {
      throw new Error('IDENTITY_NODE_MANIFEST_ENTRY_INVALID');
    }
    if (new Set(node.targets.map((target) => target.target)).size !== node.targets.length) {
      throw new Error('IDENTITY_NODE_MANIFEST_TARGET_INVALID');
    }
    const consumerTargets = node.targets.filter((target) => target.surface === 'consumer');
    const consumer = consumerTargets[0];
    if (consumerTargets.length !== 1 || consumer === undefined || consumer.membershipClient !== 'storefront'
      || consumer.application === null || consumer.returnOrigin !== node.storefrontOrigin) {
      throw new Error('IDENTITY_NODE_MANIFEST_CONSUMER_INVALID');
    }
    const common = {
      nodeId: node.nodeId,
      nodeProfile: node.nodeProfile,
      displayName: node.displayName,
      mallName: node.mallName,
      brandName: node.brandName,
      accountsOrigin: node.accountsOrigin,
      apiOrigin: node.apiOrigin,
      consumerApiOrigin: node.consumerApiOrigin,
      storefrontOrigin: node.storefrontOrigin,
      storefrontHosts: node.storefrontHosts,
      consumerTarget: consumer.target,
      consumerApplication: consumer.application,
    };
    if (node.nodeProfile === 'consumer') {
      if (node.mallId !== null || node.adminOrigin !== null
        || node.targets.some((target) => target.surface === 'admin')) {
        throw new Error('IDENTITY_NODE_MANIFEST_CONSUMER_INVALID');
      }
      return { ...common, mallId: null, hostNodeId: node.hostNodeId, adminOrigin: null, adminTarget: null };
    }
    const operators = node.targets.filter((target) => target.surface === 'admin' && target.membershipClient === 'operator');
    const operator = operators[0];
    if (node.mallId === null || node.hostNodeId !== null || node.adminOrigin === null || operators.length !== 1
      || operator === undefined || operator.returnOrigin !== node.adminOrigin) {
      throw new Error('IDENTITY_NODE_MANIFEST_OPERATING_INVALID');
    }
    return {
      ...common,
      mallId: node.mallId,
      hostNodeId: null,
      adminOrigin: node.adminOrigin,
      adminTarget: operator.target,
    };
  });
  return parseIdentityNodeRegistry(JSON.stringify({
    version: manifest.version,
    nodes,
  }));
}

export const PRODUCTION_IDENTITY_NODE_REGISTRY = identityNodeRegistryFromManifest();
export const PRODUCTION_IDENTITY_NODE_REGISTRY_SOURCE = JSON.stringify(PRODUCTION_IDENTITY_NODE_REGISTRY);

export function parseIdentityNodeRegistry(source: string): IdentityNodeRegistry {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error('IDENTITY_NODE_REGISTRY_INVALID');
  }
  if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.nodes) || value.nodes.length === 0) {
    throw new Error('IDENTITY_NODE_REGISTRY_INVALID');
  }
  const nodes = value.nodes.map(parseNode);
  unique(nodes.map((node) => node.nodeId), 'IDENTITY_NODE_ID_DUPLICATE');
  unique(nodes.map((node) => node.accountsHost), 'IDENTITY_NODE_ACCOUNTS_HOST_DUPLICATE');
  unique(nodes.flatMap((node) => node.storefrontHosts), 'IDENTITY_NODE_STOREFRONT_HOST_DUPLICATE');
  unique(nodes.flatMap((node) => node.adminOrigin === null ? [] : [new URL(node.adminOrigin).hostname]),
    'IDENTITY_NODE_ADMIN_HOST_DUPLICATE');
  for (const node of nodes) {
    if (node.nodeProfile !== 'consumer') continue;
    const host = nodes.find((candidate) => candidate.nodeId === node.hostNodeId);
    if (host?.nodeProfile !== 'operating_mall') throw new Error('IDENTITY_CONSUMER_HOST_NODE_INVALID');
  }
  return Object.freeze({ version: 2, nodes: Object.freeze(nodes) });
}

export function identityNodeForAccountsHost(
  registry: IdentityNodeRegistry,
  hostname: string,
): IdentityNodeDefinition | null {
  const normalized = normalizedHost(hostname);
  return registry.nodes.find((node) => node.accountsHost === normalized) ?? null;
}

export function identityNodeForStorefrontHost(
  registry: IdentityNodeRegistry,
  hostname: string,
): IdentityNodeDefinition | null {
  const normalized = normalizedHost(hostname);
  return registry.nodes.find((node) => node.storefrontHosts.includes(normalized)) ?? null;
}

function parseNode(value: unknown): IdentityNodeDefinition {
  if (!isRecord(value)) throw new Error('IDENTITY_NODE_REGISTRY_INVALID');
  const nodeProfile = identityNodeProfile(value.nodeProfile);
  const displayName = text(value.displayName, 'IDENTITY_NODE_DISPLAY_NAME_INVALID');
  const accountsOrigin = exactOrigin(value.accountsOrigin, 'IDENTITY_NODE_ACCOUNTS_ORIGIN_INVALID');
  const storefrontOrigin = exactOrigin(value.storefrontOrigin, 'IDENTITY_NODE_STOREFRONT_ORIGIN_INVALID');
  const configuredStorefrontHosts = Array.isArray(value.storefrontHosts)
    ? value.storefrontHosts.map((host) => normalizedHost(text(host, 'IDENTITY_NODE_STOREFRONT_HOST_INVALID')))
    : [];
  const storefrontHosts = [...new Set([new URL(storefrontOrigin).hostname, ...configuredStorefrontHosts])];
  const common = {
    nodeId: nodeIdKey(value.nodeId, 'IDENTITY_NODE_ID_INVALID'),
    nodeProfile,
    displayName,
    mallName: optionalText(value.mallName) ?? displayName,
    brandName: optionalText(value.brandName) ?? displayName,
    accountsOrigin,
    accountsHost: new URL(accountsOrigin).hostname,
    apiOrigin: exactOrigin(value.apiOrigin, 'IDENTITY_NODE_API_ORIGIN_INVALID'),
    consumerApiOrigin: exactOrigin(value.consumerApiOrigin, 'IDENTITY_NODE_CONSUMER_API_ORIGIN_INVALID'),
    storefrontOrigin,
    storefrontHosts: Object.freeze(storefrontHosts),
    consumerTarget: nodeKey(value.consumerTarget, 'IDENTITY_NODE_CONSUMER_TARGET_INVALID'),
    consumerApplication: nodeKey(value.consumerApplication, 'IDENTITY_NODE_CONSUMER_APPLICATION_INVALID'),
  } as const;
  if (nodeProfile === 'operating_mall') {
    if (value.hostNodeId !== undefined && value.hostNodeId !== null) {
      throw new Error('IDENTITY_OPERATING_HOST_NODE_FORBIDDEN');
    }
    return Object.freeze({
      ...common,
      nodeProfile,
      mallId: text(value.mallId, 'IDENTITY_OPERATING_MALL_ID_INVALID'),
      hostNodeId: null,
      adminOrigin: exactOrigin(value.adminOrigin, 'IDENTITY_NODE_ADMIN_ORIGIN_INVALID'),
      adminTarget: nodeKey(value.adminTarget, 'IDENTITY_NODE_ADMIN_TARGET_INVALID'),
    });
  }
  if (value.mallId !== undefined && value.mallId !== null) throw new Error('IDENTITY_CONSUMER_MALL_FORBIDDEN');
  if (value.adminOrigin !== undefined && value.adminOrigin !== null) throw new Error('IDENTITY_CONSUMER_ADMIN_FORBIDDEN');
  if (value.adminTarget !== undefined && value.adminTarget !== null) throw new Error('IDENTITY_CONSUMER_ADMIN_FORBIDDEN');
  return Object.freeze({
    ...common,
    nodeProfile,
    mallId: null,
    hostNodeId: nodeIdKey(value.hostNodeId, 'IDENTITY_CONSUMER_HOST_NODE_INVALID'),
    adminOrigin: null,
    adminTarget: null,
  });
}

function identityNodeProfile(value: unknown): IdentityNodeProfile {
  if (value === 'operating_mall' || value === 'consumer') return value;
  throw new Error('IDENTITY_NODE_PROFILE_INVALID');
}

function exactOrigin(value: unknown, code: string): string {
  let parsed: URL;
  try {
    parsed = new URL(text(value, code));
  } catch {
    throw new Error(code);
  }
  const local = parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
  if ((!local && parsed.protocol !== 'https:') || parsed.username || parsed.password
    || (parsed.pathname !== '/' && parsed.pathname !== '') || parsed.search || parsed.hash) throw new Error(code);
  return parsed.origin;
}

function normalizedHost(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\.$/, '');
  if (!/^[a-z0-9.-]+$/.test(normalized)) throw new Error('IDENTITY_NODE_HOST_INVALID');
  return normalized;
}

function nodeKey(value: unknown, code: string): string {
  const key = text(value, code).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(key)) throw new Error(code);
  return key;
}

function nodeIdKey(value: unknown, code: string): string {
  const key = text(value, code).toLowerCase();
  if (!/^node:[a-z0-9][a-z0-9-]{0,62}:[a-z0-9][a-z0-9-]{0,62}$/.test(key)) throw new Error(code);
  return key;
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function unique(values: readonly string[], code: string): void {
  if (new Set(values).size !== values.length) throw new Error(code);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
