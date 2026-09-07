export interface IdentityNodeDefinition {
  readonly nodeId: string;
  readonly displayName: string;
  readonly mallName: string;
  readonly brandName: string;
  readonly accountsOrigin: string;
  readonly accountsHost: string;
  readonly apiOrigin: string;
  readonly consumerApiOrigin: string;
  readonly adminOrigin: string;
  readonly storefrontOrigin: string;
  readonly storefrontHosts: readonly string[];
  readonly adminTarget: string;
  readonly consumerTarget: string;
  readonly consumerApplication: string;
}

export interface IdentityNodeRegistry {
  readonly version: 1;
  readonly defaultNodeId: string;
  readonly nodes: readonly IdentityNodeDefinition[];
}

export function parseIdentityNodeRegistry(source: string): IdentityNodeRegistry {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error('IDENTITY_NODE_REGISTRY_INVALID');
  }
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.nodes) || value.nodes.length === 0) {
    throw new Error('IDENTITY_NODE_REGISTRY_INVALID');
  }
  const defaultNodeId = nodeKey(value.defaultNodeId, 'IDENTITY_NODE_DEFAULT_INVALID');
  const nodes = value.nodes.map(parseNode);
  unique(nodes.map((node) => node.nodeId), 'IDENTITY_NODE_ID_DUPLICATE');
  unique(nodes.map((node) => node.accountsHost), 'IDENTITY_NODE_ACCOUNTS_HOST_DUPLICATE');
  unique(nodes.flatMap((node) => node.storefrontHosts), 'IDENTITY_NODE_STOREFRONT_HOST_DUPLICATE');
  if (!nodes.some((node) => node.nodeId === defaultNodeId)) throw new Error('IDENTITY_NODE_DEFAULT_INVALID');
  return Object.freeze({ version: 1, defaultNodeId, nodes: Object.freeze(nodes) });
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

export function defaultIdentityNode(registry: IdentityNodeRegistry): IdentityNodeDefinition {
  return registry.nodes.find((node) => node.nodeId === registry.defaultNodeId)!;
}

function parseNode(value: unknown): IdentityNodeDefinition {
  if (!isRecord(value)) throw new Error('IDENTITY_NODE_REGISTRY_INVALID');
  const displayName = text(value.displayName, 'IDENTITY_NODE_DISPLAY_NAME_INVALID');
  const accountsOrigin = exactOrigin(value.accountsOrigin, 'IDENTITY_NODE_ACCOUNTS_ORIGIN_INVALID');
  const storefrontOrigin = exactOrigin(value.storefrontOrigin, 'IDENTITY_NODE_STOREFRONT_ORIGIN_INVALID');
  const configuredStorefrontHosts = Array.isArray(value.storefrontHosts)
    ? value.storefrontHosts.map((host) => normalizedHost(text(host, 'IDENTITY_NODE_STOREFRONT_HOST_INVALID')))
    : [];
  const storefrontHosts = [...new Set([new URL(storefrontOrigin).hostname, ...configuredStorefrontHosts])];
  return Object.freeze({
    nodeId: nodeKey(value.nodeId, 'IDENTITY_NODE_ID_INVALID'),
    displayName,
    mallName: optionalText(value.mallName) ?? displayName,
    brandName: optionalText(value.brandName) ?? displayName,
    accountsOrigin,
    accountsHost: new URL(accountsOrigin).hostname,
    apiOrigin: exactOrigin(value.apiOrigin, 'IDENTITY_NODE_API_ORIGIN_INVALID'),
    consumerApiOrigin: exactOrigin(value.consumerApiOrigin, 'IDENTITY_NODE_CONSUMER_API_ORIGIN_INVALID'),
    adminOrigin: exactOrigin(value.adminOrigin, 'IDENTITY_NODE_ADMIN_ORIGIN_INVALID'),
    storefrontOrigin,
    storefrontHosts: Object.freeze(storefrontHosts),
    adminTarget: nodeKey(value.adminTarget, 'IDENTITY_NODE_ADMIN_TARGET_INVALID'),
    consumerTarget: nodeKey(value.consumerTarget, 'IDENTITY_NODE_CONSUMER_TARGET_INVALID'),
    consumerApplication: nodeKey(value.consumerApplication, 'IDENTITY_NODE_CONSUMER_APPLICATION_INVALID'),
  });
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
