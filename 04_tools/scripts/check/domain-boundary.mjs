import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const contractPath = resolve(repositoryRoot, '02_platform_pingtai/config/production-domain-boundary.json');
const lockPath = resolve(repositoryRoot, '02_platform_pingtai/config/production-domain-boundary.lock.json');
const identityNodeManifestPath = resolve(repositoryRoot, '01_core_hexin/packages/config/src/identity-node-manifest.json');

const runtimeEntries = Object.freeze([
  '01_core_hexin/apps/auth-web/src',
  '01_core_hexin/apps/auth-web/index.html',
  '01_core_hexin/apps/auth-web/.env.example',
  '01_core_hexin/apps/auth-web/vite.config.ts',
  '01_core_hexin/apps/console/src',
  '01_core_hexin/apps/console/index.html',
  '01_core_hexin/apps/console/vite.config.ts',
  '02_platform_pingtai/config/console-node-manifests.json',
  '01_core_hexin/apps/miniapp/miniprogram',
  '01_core_hexin/apps/storefront-web/src',
  '01_core_hexin/apps/storefront-web/vite.config.ts',
  '02_platform_pingtai/config/owner-approved-ui.json',
  '02_platform_pingtai/infrastructure/zhudatuan/aliyun',
  '01_core_hexin/packages/config/src',
  '01_core_hexin/services/commerce/src',
]);

const builtEntries = Object.freeze([
  '01_core_hexin/apps/auth-web/dist',
  '01_core_hexin/apps/console/dist',
  '01_core_hexin/apps/storefront-web/dist',
  '01_core_hexin/services/commerce/dist',
]);

const sourceExtensions = new Set(['.cjs', '.html', '.js', '.json', '.jsx', '.mjs', '.ts', '.tsx', '.yaml', '.yml']);
const builtExtensions = new Set(['.html', '.js', '.json', '.map', '.mjs']);
const testFile = /(?:^|\/)(?:__tests__\/|[^/]+\.(?:spec|test)\.[cm]?[jt]sx?$)/;
const inertDesignReference = /(?:^|\/)design-references\//;
const hbbtznSubdomain = /(?:[a-z0-9-]+\.)+hbbtzn\.com/ig;

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function sorted(values) {
  return [...values].sort();
}

function sameValues(actual, expected) {
  return JSON.stringify(sorted(actual)) === JSON.stringify(sorted(expected));
}

function requiredObject(value, code) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(code);
  return value;
}

function exactOrigin(value, code) {
  if (typeof value !== 'string') fail(code);
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || parsed.origin !== value || parsed.pathname !== '/' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    fail(code, value);
  }
  return value;
}

export function assertContractLock(contractSource, lock) {
  if (lock?.schema !== 'zhudatuan.production-domain-boundary-lock.v1'
    || lock?.approvedBy !== 'Ethan'
    || lock?.changePolicy !== 'explicit-owner-approval-required') {
    fail('PRODUCTION_DOMAIN_LOCK_INVALID');
  }
  const digest = createHash('sha256').update(contractSource).digest('hex');
  if (digest !== lock.contractSha256) fail('PRODUCTION_DOMAIN_OWNER_APPROVAL_REQUIRED', digest);
}

export function validateDomainContract(contract) {
  requiredObject(contract, 'PRODUCTION_DOMAIN_CONTRACT_INVALID');
  if (contract.schema !== 'zhudatuan.production-domain-boundary.v1') fail('PRODUCTION_DOMAIN_SCHEMA_INVALID');
  const frontends = requiredObject(contract.frontends, 'PRODUCTION_DOMAIN_FRONTENDS_MISSING');
  const h5 = requiredObject(frontends.h5, 'PRODUCTION_DOMAIN_H5_MISSING');
  const miniProgram = requiredObject(frontends.miniProgram, 'PRODUCTION_DOMAIN_MINI_PROGRAM_MISSING');
  const controlPlane = requiredObject(contract.controlPlane, 'PRODUCTION_DOMAIN_CONTROL_PLANE_MISSING');
  const canonicalOrigins = requiredObject(contract.canonicalOrigins, 'PRODUCTION_DOMAIN_CANONICAL_ORIGINS_MISSING');
  const identityApi = requiredObject(contract.identityApi, 'PRODUCTION_DOMAIN_IDENTITY_API_MISSING');
  const aliases = requiredObject(contract.redirectOnlyAliases, 'PRODUCTION_DOMAIN_REDIRECT_ALIASES_MISSING');
  const proxyAliases = requiredObject(contract.proxyAliases, 'PRODUCTION_DOMAIN_PROXY_ALIASES_MISSING');
  const tenantControlPlanes = requiredObject(contract.tenantControlPlanes, 'PRODUCTION_DOMAIN_TENANT_CONTROL_PLANES_MISSING');
  const hongtai = requiredObject(tenantControlPlanes.hongtai, 'PRODUCTION_DOMAIN_HONGTAI_CONTROL_PLANE_MISSING');
  const tenantStorefronts = requiredObject(contract.tenantStorefronts, 'PRODUCTION_DOMAIN_TENANT_STOREFRONTS_MISSING');
  const hongtaiStorefront = requiredObject(tenantStorefronts.hongtai, 'PRODUCTION_DOMAIN_HONGTAI_STOREFRONT_MISSING');

  const h5Origin = exactOrigin(h5.publicOrigin, 'PRODUCTION_DOMAIN_H5_ORIGIN_INVALID');
  const accountsOrigin = exactOrigin(controlPlane.accountsOrigin, 'PRODUCTION_DOMAIN_ACCOUNTS_ORIGIN_INVALID');
  const consoleOrigin = exactOrigin(controlPlane.consoleOrigin, 'PRODUCTION_DOMAIN_CONSOLE_ORIGIN_INVALID');
  const apiOrigin = exactOrigin(controlPlane.apiOrigin, 'PRODUCTION_DOMAIN_API_ORIGIN_INVALID');
  const storefrontOrigin = exactOrigin(canonicalOrigins.storefrontOrigin, 'PRODUCTION_DOMAIN_STOREFRONT_ORIGIN_INVALID');
  const hongtaiAccountsOrigin = exactOrigin(hongtai.accountsOrigin, 'PRODUCTION_DOMAIN_HONGTAI_ACCOUNTS_ORIGIN_INVALID');
  const hongtaiConsoleOrigin = exactOrigin(hongtai.consoleOrigin, 'PRODUCTION_DOMAIN_HONGTAI_CONSOLE_ORIGIN_INVALID');
  const hongtaiApiOrigin = exactOrigin(hongtai.apiOrigin, 'PRODUCTION_DOMAIN_HONGTAI_API_ORIGIN_INVALID');
  const hongtaiPlatformStorefrontOrigin = exactOrigin(hongtai.platformStorefrontOrigin, 'PRODUCTION_DOMAIN_HONGTAI_PLATFORM_STOREFRONT_ORIGIN_INVALID');
  const hongtaiPlatformConsoleOrigin = exactOrigin(hongtai.platformConsoleOrigin, 'PRODUCTION_DOMAIN_HONGTAI_PLATFORM_CONSOLE_ORIGIN_INVALID');
  const hongtaiStorefrontOrigin = exactOrigin(hongtaiStorefront.publicOrigin, 'PRODUCTION_DOMAIN_HONGTAI_STOREFRONT_ORIGIN_INVALID');
  const hongtaiEdgeGatewayOrigin = exactOrigin(hongtaiStorefront.edgeGatewayOrigin, 'PRODUCTION_DOMAIN_HONGTAI_STOREFRONT_GATEWAY_INVALID');

  if (new URL(h5Origin).hostname !== 'hbbtzn.com' || miniProgram.publicDomain !== 'hbbtzn.com') {
    fail('PRODUCTION_DOMAIN_CONSUMER_FRONTEND_INVALID');
  }
  if (hongtaiStorefrontOrigin !== h5Origin
    || hongtaiEdgeGatewayOrigin !== storefrontOrigin
    || hongtaiStorefront.nodeId !== 'node:hbbtzn:l1'
    || hongtaiStorefront.edgeSurface !== 'storefront'
    || hongtaiStorefront.releasePointer !== '/opt/sfl/nodes/hbbtzn-l1/storefront/current'
    || hongtaiStorefront.service !== 'sfl-storefront@hbbtzn-l1.service'
    || hongtaiStorefront.port !== 4410
    || hongtaiStorefront.sharesCanonicalRelease !== false
    || hongtaiStorefront.sharesCanonicalService !== false) {
    fail('PRODUCTION_DOMAIN_HONGTAI_STOREFRONT_ISOLATION_INVALID');
  }
  if (h5.apiOrigin !== apiOrigin || miniProgram.apiOrigin !== apiOrigin
    || h5.authOrigin !== accountsOrigin || miniProgram.authOrigin !== accountsOrigin) {
    fail('PRODUCTION_DOMAIN_FRONTEND_CONTROL_PLANE_DRIFT');
  }
  for (const origin of [accountsOrigin, consoleOrigin, apiOrigin, storefrontOrigin]) {
    if (new URL(origin).hostname.endsWith('.hbbtzn.com') || new URL(origin).hostname === 'hbbtzn.com') {
      fail('PRODUCTION_DOMAIN_CONTROL_PLANE_ON_HBBTZN', origin);
    }
  }

  const allowedOrigins = [accountsOrigin, consoleOrigin, h5Origin, storefrontOrigin];
  if (!Array.isArray(identityApi.allowedOrigins) || !sameValues(identityApi.allowedOrigins, allowedOrigins)) {
    fail('PRODUCTION_DOMAIN_ALLOWED_ORIGINS_DRIFT');
  }
  const expectedTargets = {
    console: consoleOrigin,
    'console-hbbtzn': hongtaiConsoleOrigin,
    storefront: storefrontOrigin,
    'storefront-hbbtzn': h5Origin,
    store: `${consoleOrigin}/entrances/store`,
    supplier: `${consoleOrigin}/entrances/supplier`,
  };
  if (JSON.stringify(identityApi.returnTargets) !== JSON.stringify(expectedTargets)) {
    fail('PRODUCTION_DOMAIN_RETURN_TARGETS_DRIFT');
  }

  const approvedRedirectAliases = {
    [hongtaiPlatformStorefrontOrigin]: h5Origin,
    [hongtaiPlatformConsoleOrigin]: hongtaiConsoleOrigin,
    'https://mall.hbbtzn.com': h5Origin,
  };
  for (const [alias, target] of Object.entries(aliases)) {
    exactOrigin(alias, 'PRODUCTION_DOMAIN_ALIAS_INVALID');
    exactOrigin(target, 'PRODUCTION_DOMAIN_ALIAS_TARGET_INVALID');
    if (approvedRedirectAliases[alias] !== target) {
      fail('PRODUCTION_DOMAIN_ALIAS_BOUNDARY_INVALID', `${alias}->${target}`);
    }
  }
  if (JSON.stringify(aliases) !== JSON.stringify(approvedRedirectAliases)) {
    fail('PRODUCTION_DOMAIN_REDIRECT_ALIASES_DRIFT');
  }
  const expectedProxyAliases = {
    [hongtaiAccountsOrigin]: accountsOrigin,
    [hongtaiApiOrigin]: apiOrigin,
    [hongtaiConsoleOrigin]: consoleOrigin,
  };
  if (JSON.stringify(proxyAliases) !== JSON.stringify(expectedProxyAliases)
    || hongtai.scopeKind !== 'mall' || typeof hongtai.scopeId !== 'string' || !hongtai.scopeId.startsWith('mall:')) {
    fail('PRODUCTION_DOMAIN_PROXY_ALIASES_DRIFT');
  }
  if (contract.changePolicy?.ownerApprovalRequired !== true
    || contract.changePolicy?.frontendDomainChangeDoesNotAuthorizeControlPlaneChange !== true
    || contract.changePolicy?.tenantControlPlaneAliasesAllowed !== true
    || contract.changePolicy?.tenantStorefrontIsolationRequired !== true
    || contract.changePolicy?.globalDomainReplacementForbidden !== true) {
    fail('PRODUCTION_DOMAIN_CHANGE_POLICY_INVALID');
  }
  return contract;
}

export function validateIdentityNodeManifest(manifest, contract) {
  requiredObject(manifest, 'IDENTITY_NODE_MANIFEST_INVALID');
  if (manifest.schema !== 'zhudatuan.identity-node-manifest.v1' || manifest.version !== 2
    || typeof manifest.revision !== 'string' || !manifest.revision || !Array.isArray(manifest.nodes)) {
    fail('IDENTITY_NODE_MANIFEST_INVALID');
  }
  const nodes = manifest.nodes.map((value) => requiredObject(value, 'IDENTITY_NODE_MANIFEST_NODE_INVALID'));
  if (new Set(nodes.map((node) => node.nodeId)).size !== nodes.length
    || !nodes.some((node) => node.nodeId === manifest.defaultNodeId && node.status === 'active')) {
    fail('IDENTITY_NODE_MANIFEST_NODE_INVALID');
  }
  for (const node of nodes) {
    if (!Array.isArray(node.entries) || !Array.isArray(node.targets) || !Array.isArray(node.storefrontHosts)) {
      fail('IDENTITY_NODE_MANIFEST_NODE_INVALID', String(node.nodeId));
    }
    const level = /^l(\d+)$/.exec(node.nodeId)?.[1];
    if (level !== undefined && Number(level) <= 11) {
      const expectedProfile = Number(level) <= 5 ? 'operating_mall' : 'consumer';
      if (node.nodeProfile !== expectedProfile) fail('IDENTITY_NODE_MANIFEST_PROFILE_INVALID', node.nodeId);
    }
    const accountsHost = new URL(exactOrigin(node.accountsOrigin, 'IDENTITY_NODE_MANIFEST_ACCOUNTS_ORIGIN_INVALID')).hostname;
    const apiHost = new URL(exactOrigin(node.apiOrigin, 'IDENTITY_NODE_MANIFEST_API_ORIGIN_INVALID')).hostname;
    exactOrigin(node.consumerApiOrigin, 'IDENTITY_NODE_MANIFEST_CONSUMER_API_ORIGIN_INVALID');
    exactOrigin(node.storefrontOrigin, 'IDENTITY_NODE_MANIFEST_STOREFRONT_ORIGIN_INVALID');
    if (!node.entries.some((entry) => entry.kind === 'accounts' && entry.host === accountsHost && entry.status === 'active')
      || !node.entries.some((entry) => entry.kind === 'api' && entry.host === apiHost && entry.status === 'active')) {
      fail('IDENTITY_NODE_MANIFEST_ENTRY_INVALID', node.nodeId);
    }
    const consumers = node.targets.filter((target) => target.surface === 'consumer');
    const operators = node.targets.filter((target) => target.surface === 'admin' && target.membershipClient === 'operator');
    if (consumers.length !== 1 || consumers[0].membershipClient !== 'storefront'
      || typeof consumers[0].application !== 'string' || consumers[0].returnOrigin !== node.storefrontOrigin) {
      fail('IDENTITY_NODE_MANIFEST_CONSUMER_INVALID', node.nodeId);
    }
    if (node.nodeProfile === 'consumer') {
      if (node.mallId !== null || node.adminOrigin !== null || operators.length !== 0
        || node.targets.some((target) => target.surface === 'admin') || typeof node.hostNodeId !== 'string') {
        fail('IDENTITY_NODE_MANIFEST_CONSUMER_INVALID', node.nodeId);
      }
    } else if (typeof node.mallId !== 'string' || node.hostNodeId !== null || operators.length !== 1
      || operators[0].returnOrigin !== node.adminOrigin) {
      fail('IDENTITY_NODE_MANIFEST_OPERATING_INVALID', node.nodeId);
    }
  }
  const l0 = nodes.find((node) => node.nodeId === 'l0');
  const l1 = nodes.find((node) => node.nodeId === 'l1');
  const hongtai = contract.tenantControlPlanes.hongtai;
  if (!l0 || !l1
    || l0.accountsOrigin !== contract.controlPlane.accountsOrigin
    || l0.apiOrigin !== contract.controlPlane.apiOrigin
    || l0.consumerApiOrigin !== contract.controlPlane.apiOrigin
    || l0.adminOrigin !== contract.controlPlane.consoleOrigin
    || l0.storefrontOrigin !== contract.canonicalOrigins.storefrontOrigin
    || l1.accountsOrigin !== hongtai.accountsOrigin
    || l1.apiOrigin !== hongtai.apiOrigin
    || l1.consumerApiOrigin !== contract.frontends.h5.publicOrigin
    || l1.adminOrigin !== hongtai.consoleOrigin
    || l1.storefrontOrigin !== contract.frontends.h5.publicOrigin) {
    fail('IDENTITY_NODE_MANIFEST_DOMAIN_DRIFT');
  }
  const returnTargets = Object.fromEntries(nodes.flatMap((node) => node.targets)
    .map((target) => [target.target, target.returnOrigin]));
  if (!sameValues(Object.keys(returnTargets), Object.keys(contract.identityApi.returnTargets))
    || Object.entries(returnTargets).some(([target, origin]) => contract.identityApi.returnTargets[target] !== origin)) {
    fail('IDENTITY_NODE_MANIFEST_RETURN_TARGET_DRIFT');
  }
  return manifest;
}

export function assertNoHbbtznSubdomain(file, source, approvedOrigins = []) {
  const approvedHosts = new Set(approvedOrigins.map((origin) => new URL(origin).hostname));
  for (const match of source.matchAll(hbbtznSubdomain)) {
    if (!approvedHosts.has(match[0].toLowerCase())) {
      fail('HBBTZN_SUBDOMAIN_RUNTIME_FORBIDDEN', `${file}:${match[0]}`);
    }
  }
}

function parseEnvironment(source) {
  const values = new Map();
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator);
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

export function validateIdentityEnvironmentText(source, contract, expectedAllowedOrigins = contract.identityApi.allowedOrigins) {
  const values = parseEnvironment(source);
  const origins = values.get('API_ALLOWED_ORIGINS')?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
  if (!sameValues(origins, expectedAllowedOrigins)) fail('PRODUCTION_DOMAIN_ENV_ORIGINS_DRIFT');
  let returnTargets;
  try {
    returnTargets = JSON.parse(values.get('AUTH_RETURN_TARGETS') ?? '');
  } catch {
    fail('PRODUCTION_DOMAIN_ENV_RETURN_TARGETS_INVALID');
  }
  if (JSON.stringify(returnTargets) !== JSON.stringify(contract.identityApi.returnTargets)) {
    fail('PRODUCTION_DOMAIN_ENV_RETURN_TARGETS_DRIFT');
  }
}

function block(source, name) {
  const match = source.match(new RegExp(`const ${name} = Object\\.freeze\\(\\{([\\s\\S]*?)\\} as const\\);`));
  if (!match) fail('PRODUCTION_DOMAIN_EDGE_BLOCK_MISSING', name);
  return match[1];
}

export function validateEdgeRedirects(source, contract) {
  if (source.includes("incoming.pathname === '/api/v1/identity/tickets/exchange'")) {
    fail('PRODUCTION_DOMAIN_EDGE_TICKET_REWRITE_FORBIDDEN');
  }
  const h5Host = new URL(contract.frontends.h5.publicOrigin).hostname;
  const upstreamBlock = block(source, 'UPSTREAM_ORIGINS');
  if (!upstreamBlock.includes(`[ROOT_STOREFRONT_HOST]: '${contract.canonicalOrigins.storefrontOrigin}'`)) {
    fail('PRODUCTION_DOMAIN_EDGE_H5_UPSTREAM_DRIFT');
  }
  const tenantStorefront = contract.tenantStorefronts.hongtai;
  for (const token of [
    `const HONGTAI_NODE_ID = '${tenantStorefront.nodeId}'`,
    `return { nodeId: HONGTAI_NODE_ID, surface: '${tenantStorefront.edgeSurface}' };`,
    "headers.delete('x-sfl-node-id')",
    "headers.delete('x-sfl-node-surface')",
  ]) {
    if (!source.includes(token)) fail('PRODUCTION_DOMAIN_EDGE_STOREFRONT_ISOLATION_MISSING', token);
  }
  for (const alias of Object.keys(contract.proxyAliases)) {
    const hostname = new URL(alias).hostname;
    if (!upstreamBlock.includes(`'${hostname}'`) && !upstreamBlock.includes(`[HONGTAI_CONSOLE_HOST]`)) {
      fail('PRODUCTION_DOMAIN_EDGE_PROXY_MISSING', hostname);
    }
  }

  const redirectBlock = block(source, 'CANONICAL_REDIRECT_HOSTS');
  const actual = Object.fromEntries([...redirectBlock.matchAll(/'([^']+)':\s*(?:'([^']+)'|(ROOT_STOREFRONT_HOST))/g)]
    .map((match) => [match[1], match[2] ?? h5Host]));
  const expected = Object.fromEntries(Object.entries(contract.redirectOnlyAliases)
    .map(([alias, target]) => [new URL(alias).hostname, new URL(target).hostname]));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail('PRODUCTION_DOMAIN_EDGE_REDIRECTS_DRIFT');
}

function collectFiles(entry, extensions) {
  if (!existsSync(entry)) return [];
  const entries = readdirSync(entry, { withFileTypes: true });
  return entries.flatMap((item) => {
    const path = resolve(entry, item.name);
    if (item.isDirectory()) return collectFiles(path, extensions);
    return item.isFile() && extensions.has(extname(item.name)) ? [path] : [];
  });
}

function filesFor(relativeEntry, extensions) {
  const absolute = resolve(repositoryRoot, relativeEntry);
  if (!existsSync(absolute)) return [];
  if (extensions.has(extname(absolute)) || absolute.endsWith('.env.example')) return [absolute];
  return collectFiles(absolute, extensions);
}

function requireTokens(relativeFile, tokens) {
  const source = readFileSync(resolve(repositoryRoot, relativeFile), 'utf8');
  for (const token of tokens) {
    if (!source.includes(token)) fail('PRODUCTION_DOMAIN_REQUIRED_BINDING_MISSING', `${relativeFile}:${token}`);
  }
}

function validateOwnerManifest(contract, identityNodeManifest) {
  const manifest = JSON.parse(readFileSync(resolve(repositoryRoot, '02_platform_pingtai/config/owner-approved-ui.json'), 'utf8'));
  if (manifest.surfaces?.accounts?.domain !== new URL(contract.controlPlane.accountsOrigin).hostname
    || manifest.surfaces?.console?.domain !== new URL(contract.controlPlane.consoleOrigin).hostname
    || manifest.surfaces?.storefront?.domain !== new URL(contract.canonicalOrigins.storefrontOrigin).hostname) {
    fail('PRODUCTION_DOMAIN_OWNER_MANIFEST_SURFACE_DRIFT');
  }
  const accountBuild = new Set(manifest.surfaces.accounts.requiredBuildEnvironment ?? []);
  for (const value of ['VITE_CLIENT_VERSION=<release-version>']) {
    if (!accountBuild.has(value)) fail('PRODUCTION_DOMAIN_OWNER_MANIFEST_BUILD_DRIFT', value);
  }
  const nodeManifest = '01_core_hexin/packages/config/src/identity-node-manifest.json';
  for (const surface of ['accounts', 'storefront']) {
    if (!manifest.surfaces[surface].requiredBuildInputs?.includes(nodeManifest)) {
      fail('PRODUCTION_DOMAIN_OWNER_MANIFEST_BUILD_DRIFT', `${surface}:${nodeManifest}`);
    }
  }
  const runtime = new Set(manifest.deployment?.requiredRuntimeEnvironment ?? []);
  const allowedOrigins = `API_ALLOWED_ORIGINS=${identityNodeManifest.allowedBrowserOrigins.join(',')}`;
  const returnTargets = `AUTH_RETURN_TARGETS=${JSON.stringify(contract.identityApi.returnTargets)}`;
  if (!runtime.has(allowedOrigins) || !runtime.has(returnTargets)) fail('PRODUCTION_DOMAIN_OWNER_MANIFEST_RUNTIME_DRIFT');
}

function validateWranglerRoutes(contract) {
  const config = JSON.parse(readFileSync(resolve(repositoryRoot, '02_platform_pingtai/infrastructure/zhudatuan/cloudflare/hbbtzn-alias/wrangler.jsonc'), 'utf8'));
  const h5Host = new URL(contract.frontends.h5.publicOrigin).hostname;
  const expectedCustomDomains = [
    ...Object.keys(contract.redirectOnlyAliases).map((origin) => new URL(origin).hostname),
    ...Object.keys(contract.proxyAliases).map((origin) => new URL(origin).hostname),
  ];
  const routes = config.routes ?? [];
  const h5Route = routes.find((route) => route.pattern === `${h5Host}/*`);
  const customDomains = routes.filter((route) => route !== h5Route);
  if (h5Route?.zone_name !== h5Host || h5Route.custom_domain === true
    || !sameValues(customDomains.map((route) => route.pattern), expectedCustomDomains)
    || customDomains.some((route) => route.custom_domain !== true)) {
    fail('PRODUCTION_DOMAIN_EDGE_ROUTES_DRIFT');
  }
}

function validateRequiredBindings(contract) {
  const { accountsOrigin, consoleOrigin } = contract.controlPlane;
  const h5Origin = contract.frontends.h5.publicOrigin;
  const hongtai = contract.tenantControlPlanes.hongtai;
  requireTokens('01_core_hexin/apps/auth-web/src/services/canonicalIdentity.ts', [apiOrigin]);
  requireTokens('01_core_hexin/apps/auth-web/src/services/canonicalRegistration.ts', [apiOrigin]);
  requireTokens('01_core_hexin/apps/auth-web/src/services/auth.ts', [consoleOrigin, h5Origin]);
  requireTokens('01_core_hexin/apps/auth-web/src/buildEnvironment.ts', [
    'VITE_API_BASE_URL',
    'VITE_ADMIN_ORIGIN',
    'VITE_STOREFRONT_ORIGIN',
  ]);
  requireTokens('01_core_hexin/apps/auth-web/index.html', [accountsOrigin]);
  requireTokens('01_core_hexin/apps/storefront-web/src/services/canonicalApiClient.ts', [apiOrigin]);
  requireTokens('01_core_hexin/apps/storefront-web/src/config/storefrontAuth.ts', [accountsOrigin]);
  requireTokens('01_core_hexin/apps/console/src/shared/config/RuntimeConfig.ts', [
    'console-build.json',
    'resolveConsoleAppConfig',
    'CONSOLE_RUNTIME_CONFIG_NOT_READY',
  ]);
  requireTokens('02_platform_pingtai/config/console-node-manifests.json', [
    consoleOrigin,
    apiOrigin,
    accountsOrigin,
    hongtai.consoleOrigin,
    hongtai.apiOrigin,
    hongtai.accountsOrigin,
    hongtai.scopeId,
  ]);
  requireTokens('01_core_hexin/apps/auth-web/src/buildEnvironment.ts', ['PRODUCTION_IDENTITY_NODE_REGISTRY_SOURCE']);
  requireTokens('01_core_hexin/apps/auth-web/src/services/identityNodeEnvironment.ts', ['configuredIdentityNodeRegistry']);
  requireTokens('01_core_hexin/apps/auth-web/index.html', [accountsOrigin]);
  requireTokens('01_core_hexin/apps/storefront-web/src/config/storefrontIdentity.ts', ['PRODUCTION_IDENTITY_NODE_REGISTRY_SOURCE']);
  requireTokens('01_core_hexin/services/commerce/src/bootstrap/IdentityNodeManifestRuntime.ts', ['IDENTITY_NODE_MANIFEST']);
  requireTokens('01_core_hexin/services/commerce/src/foundation/interface/NodeServer.ts', [
    'trustedIdentityEntryHost', "headers['x-real-ip']",
  ]);
  requireTokens('02_platform_pingtai/infrastructure/zhudatuan/cloudflare/hbbtzn-alias/src/index.ts', ['x-zdt-identity-entry-host']);
  requireTokens('01_core_hexin/apps/console/src/shared/config/AppConfig.ts', [
    'clientEnvironment()',
    'apiBaseUrl',
    'authBaseUrl',
  ]);
  requireTokens('01_core_hexin/packages/config/src/IdentityRegistrationApiEnvironment.ts', ['IDENTITY_NODE_MANIFEST']);
  requireTokens('02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-storefront@.service', [
    contract.tenantStorefronts.hongtai.releasePointer.replace('/hbbtzn-l1/', '/%i/'),
    '${STOREFRONT_PORT}',
    'EnvironmentFile=/opt/sfl/nodes/%i/runtime/storefront.env',
  ]);
}

function validateRuntimeSources(contract, identityNodeManifest) {
  const approvedTenantOrigins = identityNodeManifest.nodes.flatMap((node) => [
    node.accountsOrigin, node.apiOrigin, node.consumerApiOrigin, node.adminOrigin, node.storefrontOrigin,
    ...node.storefrontHosts.map((host) => `https://${host}`),
  ]).filter(Boolean);
  for (const entry of runtimeEntries) {
    const files = filesFor(entry, sourceExtensions);
    if (files.length === 0) fail('PRODUCTION_DOMAIN_RUNTIME_ENTRY_MISSING', entry);
    for (const file of files) {
      const relativeFile = file.slice(repositoryRoot.length + 1);
      if (testFile.test(relativeFile)) continue;
      assertNoHbbtznSubdomain(relativeFile, readFileSync(file, 'utf8'), approvedTenantOrigins);
    }
  }
  validateRequiredBindings(contract);
  validateOwnerManifest(contract, identityNodeManifest);
  validateIdentityEnvironmentText(
    readFileSync(resolve(repositoryRoot, '02_platform_pingtai/infrastructure/zhudatuan/aliyun/identity-registration-api.env.example'), 'utf8'),
    contract,
    identityNodeManifest.allowedBrowserOrigins,
  );
  const edgeSource = readFileSync(resolve(repositoryRoot, '02_platform_pingtai/infrastructure/zhudatuan/cloudflare/hbbtzn-alias/src/index.ts'), 'utf8');
  validateEdgeRedirects(edgeSource, contract);
  validateWranglerRoutes(contract);
}

function validateBuiltArtifacts(contract, identityNodeManifest, production) {
  const approvedTenantOrigins = identityNodeManifest.nodes.flatMap((node) => [
    node.accountsOrigin, node.apiOrigin, node.consumerApiOrigin, node.adminOrigin, node.storefrontOrigin,
    ...node.storefrontHosts.map((host) => `https://${host}`),
  ]).filter(Boolean);
  for (const entry of builtEntries) {
    const files = filesFor(entry, builtExtensions);
    if (files.length === 0) fail('PRODUCTION_DOMAIN_BUILD_ENTRY_MISSING', entry);
    for (const file of files) {
      const relativeFile = file.slice(repositoryRoot.length + 1);
      if (inertDesignReference.test(relativeFile)) continue;
      assertNoHbbtznSubdomain(relativeFile, readFileSync(file, 'utf8'), approvedTenantOrigins);
    }
  }
  if (!production) return;
  const expectations = [
    ['01_core_hexin/apps/auth-web/dist', identityNodeManifest.nodes.flatMap((node) => [
      node.accountsOrigin, node.apiOrigin, node.adminOrigin, node.storefrontOrigin,
    ]).filter(Boolean)],
    ['01_core_hexin/apps/console/dist', [
      contract.controlPlane.accountsOrigin,
      contract.controlPlane.apiOrigin,
      contract.tenantControlPlanes.hongtai.accountsOrigin,
      contract.tenantControlPlanes.hongtai.apiOrigin,
    ]],
    ['01_core_hexin/apps/storefront-web/dist', identityNodeManifest.nodes.flatMap((node) => [
      node.accountsOrigin, node.consumerApiOrigin, node.storefrontOrigin,
    ])],
    ['01_core_hexin/services/commerce/dist', [
      identityNodeManifest.revision,
      contract.controlPlane.accountsOrigin,
      contract.controlPlane.consoleOrigin,
      contract.frontends.h5.publicOrigin,
    ]],
  ];
  for (const [entry, tokens] of expectations) {
    const corpus = filesFor(entry, builtExtensions).map((file) => readFileSync(file, 'utf8')).join('\n');
    for (const token of tokens) {
      if (!corpus.includes(token)) fail('PRODUCTION_DOMAIN_BUILD_BINDING_MISSING', `${entry}:${token}`);
    }
  }
}

function loadContract() {
  const source = readFileSync(contractPath, 'utf8');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  assertContractLock(source, lock);
  return validateDomainContract(JSON.parse(source));
}

function loadIdentityNodeManifest(contract) {
  return validateIdentityNodeManifest(JSON.parse(readFileSync(identityNodeManifestPath, 'utf8')), contract);
}

function run() {
  const args = process.argv.slice(2);
  const contract = loadContract();
  const identityNodeManifest = loadIdentityNodeManifest(contract);
  validateRuntimeSources(contract, identityNodeManifest);
  const built = args.includes('--built');
  const production = args.includes('--production');
  if (production && !built) fail('PRODUCTION_DOMAIN_BUILD_MODE_REQUIRED');
  if (built) validateBuiltArtifacts(contract, identityNodeManifest, production);
  const environmentIndex = args.indexOf('--identity-env');
  if (environmentIndex >= 0) {
    const environmentPath = args[environmentIndex + 1];
    if (!environmentPath) fail('PRODUCTION_DOMAIN_ENV_FILE_MISSING');
    const environmentSource = environmentPath === '-'
      ? readFileSync(0, 'utf8')
      : readFileSync(resolve(environmentPath), 'utf8');
    validateIdentityEnvironmentText(environmentSource, contract);
  }
  console.log(`Production domain boundary verified: source, identity=${identityNodeManifest.revision}${built ? ', bundles' : ''}${production ? ', production bindings' : ''}${environmentIndex >= 0 ? ', environment' : ''}.`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) run();
