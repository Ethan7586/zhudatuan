import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const contractPath = resolve(repositoryRoot, 'config/production-domain-boundary.json');
const lockPath = resolve(repositoryRoot, 'config/production-domain-boundary.lock.json');

const runtimeEntries = Object.freeze([
  'apps/auth-web/src',
  'apps/auth-web/index.html',
  'apps/auth-web/.env.example',
  'apps/auth-web/vite.config.ts',
  'apps/console/src',
  'apps/console/index.html',
  'apps/console/vite.config.ts',
  'apps/miniapp/miniprogram',
  'apps/storefront-web/src',
  'apps/storefront-web/vite.config.ts',
  'config/owner-approved-ui.json',
  'infrastructure/zhudatuan/aliyun',
  'packages/config/src',
  'services/commerce/src',
]);

const builtEntries = Object.freeze([
  'apps/auth-web/dist',
  'apps/console/dist',
  'apps/storefront-web/dist',
  'services/commerce/dist',
]);

const sourceExtensions = new Set(['.cjs', '.html', '.js', '.json', '.jsx', '.mjs', '.ts', '.tsx', '.yaml', '.yml']);
const builtExtensions = new Set(['.html', '.js', '.json', '.map', '.mjs']);
const testFile = /(?:^|\/)(?:__tests__\/|[^/]+\.(?:spec|test)\.[cm]?[jt]sx?$)/;
const inertDesignReference = /(?:^|\/)design-references\//;
const hbbtznSubdomain = /(?:[a-z0-9-]+\.)+hbbtzn\.com/i;

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

  const h5Origin = exactOrigin(h5.publicOrigin, 'PRODUCTION_DOMAIN_H5_ORIGIN_INVALID');
  const accountsOrigin = exactOrigin(controlPlane.accountsOrigin, 'PRODUCTION_DOMAIN_ACCOUNTS_ORIGIN_INVALID');
  const consoleOrigin = exactOrigin(controlPlane.consoleOrigin, 'PRODUCTION_DOMAIN_CONSOLE_ORIGIN_INVALID');
  const apiOrigin = exactOrigin(controlPlane.apiOrigin, 'PRODUCTION_DOMAIN_API_ORIGIN_INVALID');
  const storefrontOrigin = exactOrigin(canonicalOrigins.storefrontOrigin, 'PRODUCTION_DOMAIN_STOREFRONT_ORIGIN_INVALID');

  if (new URL(h5Origin).hostname !== 'hbbtzn.com' || miniProgram.publicDomain !== 'hbbtzn.com') {
    fail('PRODUCTION_DOMAIN_CONSUMER_FRONTEND_INVALID');
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
    storefront: h5Origin,
    store: `${consoleOrigin}/entrances/store`,
    supplier: `${consoleOrigin}/entrances/supplier`,
  };
  if (JSON.stringify(identityApi.returnTargets) !== JSON.stringify(expectedTargets)) {
    fail('PRODUCTION_DOMAIN_RETURN_TARGETS_DRIFT');
  }

  const approvedAliasTargets = new Set([accountsOrigin, apiOrigin, h5Origin]);
  for (const [alias, target] of Object.entries(aliases)) {
    exactOrigin(alias, 'PRODUCTION_DOMAIN_ALIAS_INVALID');
    exactOrigin(target, 'PRODUCTION_DOMAIN_ALIAS_TARGET_INVALID');
    if (!new URL(alias).hostname.endsWith('.hbbtzn.com') || !approvedAliasTargets.has(target)) {
      fail('PRODUCTION_DOMAIN_ALIAS_BOUNDARY_INVALID', `${alias}->${target}`);
    }
  }
  if (contract.changePolicy?.ownerApprovalRequired !== true
    || contract.changePolicy?.frontendDomainChangeDoesNotAuthorizeControlPlaneChange !== true
    || contract.changePolicy?.globalDomainReplacementForbidden !== true) {
    fail('PRODUCTION_DOMAIN_CHANGE_POLICY_INVALID');
  }
  return contract;
}

export function assertNoHbbtznSubdomain(file, source) {
  const match = source.match(hbbtznSubdomain);
  if (match) fail('HBBTZN_SUBDOMAIN_RUNTIME_FORBIDDEN', `${file}:${match[0]}`);
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

export function validateIdentityEnvironmentText(source, contract) {
  const values = parseEnvironment(source);
  const origins = values.get('API_ALLOWED_ORIGINS')?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
  if (!sameValues(origins, contract.identityApi.allowedOrigins)) fail('PRODUCTION_DOMAIN_ENV_ORIGINS_DRIFT');
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
  const h5Host = new URL(contract.frontends.h5.publicOrigin).hostname;
  const upstreamBlock = block(source, 'UPSTREAM_ORIGINS');
  if (!upstreamBlock.includes(`[ROOT_STOREFRONT_HOST]: '${contract.canonicalOrigins.storefrontOrigin}'`)) {
    fail('PRODUCTION_DOMAIN_EDGE_H5_UPSTREAM_DRIFT');
  }
  const upstreamAlias = upstreamBlock.match(hbbtznSubdomain);
  if (upstreamAlias) fail('PRODUCTION_DOMAIN_EDGE_ALIAS_PROXY_FORBIDDEN', upstreamAlias[0]);

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

function validateOwnerManifest(contract) {
  const manifest = JSON.parse(readFileSync(resolve(repositoryRoot, 'config/owner-approved-ui.json'), 'utf8'));
  if (manifest.surfaces?.accounts?.domain !== new URL(contract.controlPlane.accountsOrigin).hostname
    || manifest.surfaces?.console?.domain !== new URL(contract.controlPlane.consoleOrigin).hostname
    || manifest.surfaces?.storefront?.domain !== new URL(contract.canonicalOrigins.storefrontOrigin).hostname) {
    fail('PRODUCTION_DOMAIN_OWNER_MANIFEST_SURFACE_DRIFT');
  }
  const accountBuild = new Set(manifest.surfaces.accounts.requiredBuildEnvironment ?? []);
  for (const value of [
    `VITE_API_BASE_URL=${contract.controlPlane.apiOrigin}`,
    `VITE_ADMIN_ORIGIN=${contract.controlPlane.consoleOrigin}`,
    `VITE_STOREFRONT_ORIGIN=${contract.frontends.h5.publicOrigin}`,
  ]) {
    if (!accountBuild.has(value)) fail('PRODUCTION_DOMAIN_OWNER_MANIFEST_BUILD_DRIFT', value);
  }
  const runtime = new Set(manifest.deployment?.requiredRuntimeEnvironment ?? []);
  const allowedOrigins = `API_ALLOWED_ORIGINS=${contract.identityApi.allowedOrigins.join(',')}`;
  const returnTargets = `AUTH_RETURN_TARGETS=${JSON.stringify(contract.identityApi.returnTargets)}`;
  if (!runtime.has(allowedOrigins) || !runtime.has(returnTargets)) fail('PRODUCTION_DOMAIN_OWNER_MANIFEST_RUNTIME_DRIFT');
}

function validateWranglerRoutes(contract) {
  const config = JSON.parse(readFileSync(resolve(repositoryRoot, 'infrastructure/zhudatuan/cloudflare/hbbtzn-alias/wrangler.jsonc'), 'utf8'));
  const expected = [
    new URL(contract.frontends.h5.publicOrigin).hostname,
    ...Object.keys(contract.redirectOnlyAliases).map((origin) => new URL(origin).hostname),
  ];
  const routes = config.routes ?? [];
  if (!sameValues(routes.map((route) => route.pattern), expected)
    || routes.some((route) => route.custom_domain !== true)) {
    fail('PRODUCTION_DOMAIN_EDGE_ROUTES_DRIFT');
  }
}

function validateRequiredBindings(contract) {
  const { accountsOrigin, apiOrigin, consoleOrigin } = contract.controlPlane;
  const h5Origin = contract.frontends.h5.publicOrigin;
  requireTokens('apps/auth-web/src/services/canonicalIdentity.ts', [apiOrigin]);
  requireTokens('apps/auth-web/src/services/canonicalRegistration.ts', [apiOrigin]);
  requireTokens('apps/auth-web/src/services/auth.ts', [consoleOrigin, h5Origin]);
  requireTokens('apps/auth-web/src/buildEnvironment.ts', [apiOrigin, consoleOrigin, h5Origin]);
  requireTokens('apps/auth-web/index.html', [accountsOrigin]);
  requireTokens('apps/storefront-web/src/services/canonicalApiClient.ts', [apiOrigin]);
  requireTokens('apps/storefront-web/src/config/storefrontAuth.ts', [accountsOrigin]);
  requireTokens('apps/console/vite.config.ts', [apiOrigin, accountsOrigin]);
  requireTokens('packages/config/src/IdentityRegistrationApiEnvironment.ts', [accountsOrigin, consoleOrigin, h5Origin]);
}

function validateRuntimeSources(contract) {
  for (const entry of runtimeEntries) {
    const files = filesFor(entry, sourceExtensions);
    if (files.length === 0) fail('PRODUCTION_DOMAIN_RUNTIME_ENTRY_MISSING', entry);
    for (const file of files) {
      const relativeFile = file.slice(repositoryRoot.length + 1);
      if (testFile.test(relativeFile)) continue;
      assertNoHbbtznSubdomain(relativeFile, readFileSync(file, 'utf8'));
    }
  }
  validateRequiredBindings(contract);
  validateOwnerManifest(contract);
  validateIdentityEnvironmentText(
    readFileSync(resolve(repositoryRoot, 'infrastructure/zhudatuan/aliyun/identity-registration-api.env.example'), 'utf8'),
    contract,
  );
  const edgeSource = readFileSync(resolve(repositoryRoot, 'infrastructure/zhudatuan/cloudflare/hbbtzn-alias/src/index.ts'), 'utf8');
  validateEdgeRedirects(edgeSource, contract);
  validateWranglerRoutes(contract);
}

function validateBuiltArtifacts(contract, production) {
  for (const entry of builtEntries) {
    const files = filesFor(entry, builtExtensions);
    if (files.length === 0) fail('PRODUCTION_DOMAIN_BUILD_ENTRY_MISSING', entry);
    for (const file of files) {
      const relativeFile = file.slice(repositoryRoot.length + 1);
      if (inertDesignReference.test(relativeFile)) continue;
      assertNoHbbtznSubdomain(relativeFile, readFileSync(file, 'utf8'));
    }
  }
  if (!production) return;
  const expectations = [
    ['apps/auth-web/dist', [contract.controlPlane.accountsOrigin, contract.controlPlane.apiOrigin, contract.controlPlane.consoleOrigin, contract.frontends.h5.publicOrigin]],
    ['apps/console/dist', [contract.controlPlane.accountsOrigin, contract.controlPlane.apiOrigin]],
    ['apps/storefront-web/dist', [contract.controlPlane.accountsOrigin, contract.controlPlane.apiOrigin]],
    ['services/commerce/dist', [contract.controlPlane.accountsOrigin, contract.controlPlane.consoleOrigin, contract.frontends.h5.publicOrigin]],
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

function run() {
  const args = process.argv.slice(2);
  const contract = loadContract();
  validateRuntimeSources(contract);
  const built = args.includes('--built');
  const production = args.includes('--production');
  if (production && !built) fail('PRODUCTION_DOMAIN_BUILD_MODE_REQUIRED');
  if (built) validateBuiltArtifacts(contract, production);
  const environmentIndex = args.indexOf('--identity-env');
  if (environmentIndex >= 0) {
    const environmentPath = args[environmentIndex + 1];
    if (!environmentPath) fail('PRODUCTION_DOMAIN_ENV_FILE_MISSING');
    const environmentSource = environmentPath === '-'
      ? readFileSync(0, 'utf8')
      : readFileSync(resolve(environmentPath), 'utf8');
    validateIdentityEnvironmentText(environmentSource, contract);
  }
  console.log(`Production domain boundary verified: source${built ? ', bundles' : ''}${production ? ', production bindings' : ''}${environmentIndex >= 0 ? ', environment' : ''}.`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) run();
