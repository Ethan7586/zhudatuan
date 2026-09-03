#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');
const cache = parse(await readFile(resolve(root, 'config/cache.yml'), 'utf8'));
const capacity = parse(await readFile(resolve(root, 'config/capacity.yml'), 'utf8'));
const telemetry = parse(await readFile(resolve(root, 'config/telemetry.yml'), 'utf8'));
const network = parse(await readFile(resolve(root, 'infrastructure/network/Edge.yml'), 'utf8'));
const identity = parse(await readFile(resolve(root, 'config/identityproviders.yml'), 'utf8'));
validate(cache, capacity, telemetry, network, identity);

const source =
  `// Generated from config/cache.yml and config/capacity.yml. Do not edit.\n` +
  `export const CONFIG_CHECKSUM = '${createHash('sha256').update(JSON.stringify({ cache, capacity })).digest('hex')}' as const;\n\n` +
  `export const CACHE_CATALOG = Object.freeze(${JSON.stringify(cache.caches, null, 2)} as const);\n\n` +
  `export const CAPACITY_MODEL = Object.freeze(${JSON.stringify(capacity.model, null, 2)} as const);\n\n` +
  `export const PROVIDER_CAPACITY = Object.freeze(${JSON.stringify(capacity.provider, null, 2)} as const);\n\n` +
  `export const RUNTIME_LIMITS = Object.freeze(${JSON.stringify(capacity.runtime, null, 2)} as const);\n`;
await emit(resolve(root, 'packages/config/src/RuntimeCatalog.ts'), source);

const redactionSource =
  `// Generated from config/telemetry.yml. Do not edit.\n` +
  `export const REDACTION_KEYS = Object.freeze(${JSON.stringify(telemetry.redaction.deny, null, 2)} as const);\n\n` +
  `export const REDACTION_KEY_PATTERN = new RegExp(\`(?:\${REDACTION_KEYS.join('|')})\`, 'i');\n`;
await emit(resolve(root, 'packages/telemetry/src/RedactionCatalog.ts'), redactionSource);

const origins = Object.freeze({
  api: origin(network.routes.api.host),
  auth: origin(network.routes.auth.host),
  console: origin(network.routes.console.host),
  storefront: origin(network.routes.storefront.host),
});
const networkSource =
  `// Generated from infrastructure/network/Edge.yml. Do not edit.\n` +
  `export const NETWORK_CHECKSUM = '${createHash('sha256').update(JSON.stringify(network)).digest('hex')}' as const;\n\n` +
  `export const NETWORK_CATALOG = Object.freeze(${JSON.stringify({ origins, storefront: { entryPath: network.routes.storefront.entryPath, fallback: network.routes.storefront.fallback } }, null, 2)} as const);\n`;
await emit(resolve(root, 'packages/config/src/NetworkCatalog.ts'), networkSource);

const providerTypes = Object.keys(identity.types).sort();
const providerSource =
  `// Generated from config/identityproviders.yml and infrastructure/network/Edge.yml. Do not edit.\n` +
  `export const IDENTITY_PROVIDER_CHECKSUM = '${createHash('sha256').update(JSON.stringify({ identity, auth: origins.auth })).digest('hex')}' as const;\n\n` +
  `export const IDENTITY_PROVIDER_TYPES = Object.freeze(${JSON.stringify(providerTypes)} as const);\n` +
  `export type IdentityProviderType = (typeof IDENTITY_PROVIDER_TYPES)[number];\n\n` +
  `export const IDENTITY_PROVIDER_CONFIGURATION = Object.freeze({\n` +
  `  schemaVersion: ${identity.version},\n` +
  `  callbackOrigin: '${origins.auth}',\n` +
  `  discoveryPath: '${identity.security.discoveryPath}',\n` +
  `  discoveryTtlSeconds: ${identity.security.discoveryTtlSeconds},\n` +
  `  jwksTtlSeconds: ${identity.security.jwksTtlSeconds},\n` +
  `  clockSkewSeconds: ${identity.security.clockSkewSeconds},\n` +
  `  transactionTtlSeconds: ${identity.security.transactionTtlSeconds},\n` +
  `  ticketTtlSeconds: ${identity.security.ticketTtlSeconds},\n` +
  `  preauthTtlSeconds: ${identity.security.preauthTtlSeconds},\n` +
  `  pkce: '${identity.security.pkce}',\n` +
  `  stateBytes: ${identity.security.stateBytes},\n` +
  `  nonceBytes: ${identity.security.nonceBytes},\n` +
  `  maximumProviders: ${identity.security.maximumProviders},\n` +
  `  maximumScopes: ${identity.security.maximumScopes},\n` +
  `  maximumResponseBytes: ${identity.security.maximumResponseBytes},\n` +
  `  retryAttempts: ${identity.security.retryAttempts},\n` +
  `  allowedAlgorithms: Object.freeze(${JSON.stringify(identity.security.allowedAlgorithms)} as const),\n` +
  `  typePolicies: Object.freeze(${JSON.stringify(identity.types, null, 2)} as const),\n` +
  `  secretReference: new RegExp(${JSON.stringify(identity.security.secretReference)}),\n` +
  `});\n\n` +
  `export function identityCallback(provider: string): string {\n` +
  `  if (!/^[0-9a-f-]{36}$/.test(provider)) throw new Error('IDENTITY_PROVIDER_ID_INVALID');\n` +
  `  return \`${'${IDENTITY_PROVIDER_CONFIGURATION.callbackOrigin}'}/api/v1/identity/federations/${'${provider}'}/callback\`;\n` +
  `}\n\n` +
  `export function oidcIssuer(value: string): string {\n` +
  `  let issuer: URL;\n` +
  `  try { issuer = new URL(value); } catch { throw new Error('OIDC_ISSUER_INVALID'); }\n` +
  `  if (issuer.protocol !== 'https:' || issuer.username || issuer.password || issuer.search || issuer.hash || (issuer.port && issuer.port !== '443')) throw new Error('OIDC_ISSUER_INVALID');\n` +
  `  return issuer.toString().replace(/\\\/$/, '');\n` +
  `}\n`;
await emit(resolve(root, 'packages/config/src/IdentityProvider.ts'), providerSource);

function validate(cacheDocument, capacityDocument, telemetryDocument, networkDocument, identityDocument) {
  if (cacheDocument?.version !== 1 || cacheDocument.owner !== 'platform' || typeof cacheDocument.caches !== 'object') throw new Error('CACHE_CATALOG_INVALID');
  for (const [name, value] of Object.entries(cacheDocument.caches)) {
    if (
      !/^[a-z][a-z0-9]*$/.test(name) ||
      typeof value?.key !== 'string' ||
      !value.key ||
      !Number.isSafeInteger(value.maximumSeconds) ||
      value.maximumSeconds < 1 ||
      !Number.isSafeInteger(value.staleSeconds) ||
      value.staleSeconds < 0 ||
      value.staleSeconds > value.maximumSeconds ||
      typeof value.commandRevalidate !== 'boolean'
    )
      throw new Error(`CACHE_ENTRY_INVALID:${name}`);
  }
  if (
    capacityDocument?.version !== 1 ||
    capacityDocument.owner !== 'platform' ||
    typeof capacityDocument.model !== 'object' ||
    typeof capacityDocument.provider !== 'object' ||
    typeof capacityDocument.runtime?.authentication?.otp !== 'object' ||
    typeof capacityDocument.runtime?.external !== 'object' ||
    typeof capacityDocument.runtime?.http !== 'object' ||
    typeof capacityDocument.runtime?.stream !== 'object' ||
    typeof capacityDocument.runtime?.pool !== 'object' ||
    typeof capacityDocument.runtime?.poolBudget !== 'object' ||
    typeof capacityDocument.runtime?.sql !== 'object'
  ) {
    throw new Error('CAPACITY_CATALOG_INVALID');
  }
  const redaction = telemetryDocument?.redaction?.deny;
  if (
    telemetryDocument?.version !== 1 ||
    telemetryDocument.owner !== 'reliability' ||
    !Array.isArray(redaction) ||
    redaction.length === 0 ||
    new Set(redaction).size !== redaction.length ||
    !redaction.every((value) => typeof value === 'string' && /^[a-z][a-z0-9]*$/.test(value))
  ) {
    throw new Error('TELEMETRY_REDACTION_INVALID');
  }
  if (
    networkDocument?.version !== 1 ||
    networkDocument.owner !== 'platform' ||
    !networkDocument.routes ||
    !['api', 'auth', 'console', 'storefront'].every((name) => /^[a-z0-9.-]+$/.test(networkDocument.routes[name]?.host ?? '')) ||
    networkDocument.routes.storefront.entryPath !== '/s' ||
    networkDocument.routes.storefront.fallback !== 'index.html' ||
    new Set(['api', 'auth', 'console', 'storefront'].map((name) => networkDocument.routes[name].host)).size !== 4
  ) {
    throw new Error('NETWORK_CATALOG_INVALID');
  }
  const headers = networkDocument.headers;
  const authCsp = headers?.auth?.contentSecurityPolicy;
  const apiCsp = headers?.api?.contentSecurityPolicy;
  if (
    headers?.hsts !== 'max-age=63072000; includeSubDomains' ||
    headers?.contentTypeOptions !== 'nosniff' ||
    headers?.crossOriginOpenerPolicy !== 'same-origin' ||
    headers?.permissions !== 'camera=(), microphone=(), geolocation=()' ||
    headers?.referrer !== 'no-referrer' ||
    JSON.stringify(apiCsp?.default) !== JSON.stringify(['none']) ||
    JSON.stringify(apiCsp?.frameAncestors) !== JSON.stringify(['none']) ||
    JSON.stringify(authCsp?.default) !== JSON.stringify(['none']) ||
    JSON.stringify(authCsp?.script) !== JSON.stringify(['self']) ||
    JSON.stringify(authCsp?.style) !== JSON.stringify(['self']) ||
    JSON.stringify(authCsp?.image) !== JSON.stringify(['self', 'data']) ||
    JSON.stringify(authCsp?.font) !== JSON.stringify(['self']) ||
    JSON.stringify(authCsp?.connectRoutes) !== JSON.stringify(['api']) ||
    JSON.stringify(authCsp?.formAction) !== JSON.stringify(['self']) ||
    JSON.stringify(authCsp?.base) !== JSON.stringify(['none']) ||
    JSON.stringify(authCsp?.object) !== JSON.stringify(['none']) ||
    JSON.stringify(authCsp?.frameAncestors) !== JSON.stringify(['none']) ||
    authCsp?.upgradeInsecureRequests !== true
  ) {
    throw new Error('NETWORK_SECURITY_HEADERS_INVALID');
  }
  const identityTypes = identityDocument?.types;
  const identitySecurity = identityDocument?.security;
  const expectedTypes = ['oidc', 'wechat', 'wecomcorp', 'wecomsuite'];
  if (
    identityDocument?.version !== 2 ||
    identityDocument.owner !== 'identity' ||
    typeof identityTypes !== 'object' ||
    Object.keys(identityTypes).sort().join(',') !== expectedTypes.join(',') ||
    typeof identitySecurity !== 'object' ||
    identitySecurity.discoveryPath !== '/.well-known/openid-configuration' ||
    identitySecurity.pkce !== 'S256' ||
    identitySecurity.secretReference !== '^[a-z][a-z0-9./]{2,127}$' ||
    !Array.isArray(identitySecurity.allowedAlgorithms) ||
    identitySecurity.allowedAlgorithms.join(',') !== 'RS256,ES256'
  ) {
    throw new Error('IDENTITY_PROVIDER_CATALOG_INVALID');
  }
  for (const [name, policy] of Object.entries(identityTypes)) {
    if (!expectedTypes.includes(name) || !Number.isSafeInteger(policy.timeoutMilliseconds) || policy.timeoutMilliseconds < 1 || !Number.isSafeInteger(policy.circuitFailureThreshold) || policy.circuitFailureThreshold < 1 || !Number.isSafeInteger(policy.circuitRecoveryMilliseconds) || policy.circuitRecoveryMilliseconds < 1) {
      throw new Error(`IDENTITY_PROVIDER_TYPE_INVALID:${name}`);
    }
  }
  for (const name of ['discoveryTtlSeconds', 'jwksTtlSeconds', 'clockSkewSeconds', 'transactionTtlSeconds', 'ticketTtlSeconds', 'preauthTtlSeconds', 'stateBytes', 'nonceBytes', 'maximumProviders', 'maximumScopes', 'maximumResponseBytes', 'retryAttempts']) {
    if (!Number.isSafeInteger(identitySecurity[name]) || identitySecurity[name] < 1) throw new Error(`IDENTITY_PROVIDER_SECURITY_INVALID:${name}`);
  }
  const otp = capacityDocument.runtime.authentication.otp;
  if (otp.validMinutes !== 10 || otp.resendSeconds !== 30) throw new Error('OTP_POLICY_INVALID');
  const authentication = capacityDocument.runtime.authentication;
  const password = authentication.password;
  if (
    !Number.isSafeInteger(authentication.bootstrap?.ttlSeconds) ||
    authentication.bootstrap.ttlSeconds < 60 ||
    authentication.bootstrap.ttlSeconds > 900 ||
    !Number.isSafeInteger(password?.minimumLength) ||
    !Number.isSafeInteger(password?.maximumLength) ||
    password.minimumLength < 12 ||
    password.maximumLength > 128 ||
    password.minimumLength > password.maximumLength ||
    !['uppercase', 'lowercase', 'number', 'symbol'].every((name) => typeof password[name] === 'boolean') ||
    !Number.isSafeInteger(password.maximumConcurrency) ||
    password.maximumConcurrency < 1 ||
    password.maximumConcurrency > 32 ||
    !Number.isSafeInteger(password.maximumQueue) ||
    password.maximumQueue < password.maximumConcurrency ||
    password.maximumQueue > 1024
  ) {
    throw new Error('AUTHENTICATION_POLICY_INVALID');
  }
  for (const [name, value] of Object.entries(capacityDocument.runtime.external)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`EXTERNAL_CAPACITY_INVALID:${name}`);
  }
  for (const [name, value] of Object.entries(capacityDocument.runtime.http)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`HTTP_CAPACITY_INVALID:${name}`);
  }
  const stream = capacityDocument.runtime.stream;
  for (const name of ['retentionEvents', 'blockMilliseconds', 'heartbeatMilliseconds', 'maximumConnections', 'maximumConnectionsPerScope', 'maximumEventBytes', 'readBatch', 'reconnectMinimumMilliseconds', 'reconnectMaximumMilliseconds']) {
    if (!Number.isSafeInteger(stream[name]) || stream[name] < 1) throw new Error(`STREAM_CAPACITY_INVALID:${name}`);
  }
  if (stream.maximumConnectionsPerScope > stream.maximumConnections || stream.reconnectMinimumMilliseconds > stream.reconnectMaximumMilliseconds || stream.blockMilliseconds >= stream.heartbeatMilliseconds) {
    throw new Error('STREAM_CAPACITY_RELATION_INVALID');
  }
  for (const [name, value] of Object.entries(capacityDocument.runtime.pool)) {
    if (
      !['query', 'command', 'worker', 'migration'].includes(name) ||
      !Number.isSafeInteger(value.maximumConnections) ||
      value.maximumConnections < 1 ||
      !Number.isSafeInteger(value.connectionTimeoutMilliseconds) ||
      value.connectionTimeoutMilliseconds < 1 ||
      !Number.isSafeInteger(value.idleTimeoutMilliseconds) ||
      value.idleTimeoutMilliseconds < 1 ||
      !Number.isSafeInteger(value.statementTimeoutMilliseconds) ||
      value.statementTimeoutMilliseconds < 0 ||
      !Number.isSafeInteger(value.idleTransactionTimeoutMilliseconds) ||
      value.idleTransactionTimeoutMilliseconds < 0
    ) {
      throw new Error(`POOL_CAPACITY_INVALID:${name}`);
    }
  }
  const budget = capacityDocument.runtime.poolBudget;
  const connections = Object.values(capacityDocument.runtime.pool).reduce((sum, profile) => sum + profile.maximumConnections, 0);
  if (
    !Number.isSafeInteger(budget.databaseMaximumConnections) ||
    budget.databaseMaximumConnections < 1 ||
    !Number.isSafeInteger(budget.maximumUtilizationPercent) ||
    budget.maximumUtilizationPercent < 1 ||
    budget.maximumUtilizationPercent > 70 ||
    connections * 100 > budget.databaseMaximumConnections * budget.maximumUtilizationPercent
  ) {
    throw new Error(`POOL_BUDGET_EXCEEDED:${connections}/${budget.databaseMaximumConnections}`);
  }
  const sql = capacityDocument.runtime.sql;
  if (sql.defaultRows !== 50 || sql.maximumRows !== 200 || !Number.isSafeInteger(sql.maximumResponseBytes) || sql.maximumResponseBytes < 1 || !Number.isSafeInteger(sql.maximumPlanCost) || sql.maximumPlanCost < 1) {
    throw new Error('SQL_BUDGET_INVALID');
  }
}

function origin(host) {
  return `https://${host}`;
}

async function emit(file, content) {
  if (check) {
    const current = await readFile(file, 'utf8').catch(() => '');
    if (current !== content) throw new Error(`GENERATED_RUNTIME_CONFIG_DRIFT:${file}`);
    return;
  }
  await writeFile(file, content);
}
