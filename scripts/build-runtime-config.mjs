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
validate(cache, capacity, telemetry, network);

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

function validate(cacheDocument, capacityDocument, telemetryDocument, networkDocument) {
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
  const otp = capacityDocument.runtime.authentication.otp;
  if (otp.validMinutes !== 10 || otp.resendSeconds !== 30) throw new Error('OTP_POLICY_INVALID');
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
