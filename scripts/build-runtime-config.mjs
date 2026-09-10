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
const clients = parse(await readFile(resolve(root, 'config/clients.yml'), 'utf8'));
const events = parse(await readFile(resolve(root, 'packages/contract/definitions/events.yml'), 'utf8'));
validate(cache, capacity, telemetry, network, identity, clients, events);
const serviceLevels = Object.fromEntries(Object.entries(telemetry.serviceLevels).map(([id, level]) => {
  const { targetKey, ...definition } = level;
  return [id, { ...definition, target: telemetry.slo[targetKey] }];
}));

const source =
  `// Generated from config/cache.yml and config/capacity.yml. Do not edit.\n` +
  `export const CONFIG_CHECKSUM = '${createHash('sha256').update(JSON.stringify({ cache, capacity })).digest('hex')}' as const;\n\n` +
  `export const BROWSER_QUERY_POLICY = Object.freeze(${JSON.stringify(cache.browser, null, 2)} as const);\n\n` +
  `export const CACHE_CATALOG = Object.freeze(${JSON.stringify(cache.caches, null, 2)} as const);\n\n` +
  `export const CAPACITY_MODEL = Object.freeze(${JSON.stringify(capacity.model, null, 2)} as const);\n\n` +
  `export const PROVIDER_CAPACITY = Object.freeze(${JSON.stringify(capacity.provider, null, 2)} as const);\n\n` +
  `export const IMPORT_CAPACITY = Object.freeze(${JSON.stringify(capacity.imports, null, 2)} as const);\n\n` +
  `export const WORKER_CAPACITY = Object.freeze(${JSON.stringify(capacity.workers, null, 2)} as const);\n\n` +
  `export const CLIENT_BUNDLE_CAPACITY = Object.freeze(${JSON.stringify(capacity.clients, null, 2)} as const);\n\n` +
  `export const NAVIGATION_CAPACITY = Object.freeze(${JSON.stringify(capacity.navigation, null, 2)} as const);\n\n` +
  `export const RUNTIME_LIMITS = Object.freeze(${JSON.stringify(capacity.runtime, null, 2)} as const);\n`;
await emit(resolve(root, 'packages/config/src/RuntimeCatalog.ts'), source);

const redactionSource =
  `// Generated from config/telemetry.yml. Do not edit.\n` +
  `export const REDACTION_KEYS = Object.freeze(${JSON.stringify(telemetry.redaction.deny, null, 2)} as const);\n\n` +
  `export const REDACTION_KEY_PATTERN = new RegExp(\`(?:\${REDACTION_KEYS.join('|')})\`, 'i');\n\n` +
  `export const TELEMETRY_METRICS = Object.freeze(${JSON.stringify(telemetry.metrics, null, 2)} as const);\n\n` +
  `export const TELEMETRY_BUFFER = Object.freeze(${JSON.stringify(telemetry.buffer, null, 2)} as const);\n\n` +
  `export const TELEMETRY_HEALTH = Object.freeze(${JSON.stringify(telemetry.health, null, 2)} as const);\n\n` +
  `export const TELEMETRY_SLO = Object.freeze(${JSON.stringify(telemetry.slo, null, 2)} as const);\n\n` +
  `export const TELEMETRY_SERVICE_LEVELS = Object.freeze(${JSON.stringify(serviceLevels, null, 2)} as const);\n\n` +
  `export const TELEMETRY_ALERTS = Object.freeze(${JSON.stringify(telemetry.alerts, null, 2)} as const);\n\n` +
  `export const TELEMETRY_SAMPLING = Object.freeze(${JSON.stringify(telemetry.sampling, null, 2)} as const);\n\n` +
  `export const TELEMETRY_RETENTION = Object.freeze(${JSON.stringify(telemetry.retention, null, 2)} as const);\n\n` +
  `export const TELEMETRY_EXPORT = Object.freeze(${JSON.stringify(telemetry.export, null, 2)} as const);\n`;
await emit(resolve(root, 'packages/telemetry/src/RedactionCatalog.ts'), redactionSource);

const origins = Object.freeze({ api: origin(network.routes.api.host), ...Object.fromEntries(clients.clients.map((client) => [client.id, origin(network.routes[client.route].host)])) });
const networkSource =
  `// Generated from infrastructure/network/Edge.yml. Do not edit.\n` +
  `export const NETWORK_CHECKSUM = '${createHash('sha256').update(JSON.stringify(network)).digest('hex')}' as const;\n\n` +
  `export const NETWORK_CATALOG = Object.freeze(${JSON.stringify({ origins, storefront: { entryPath: network.routes.storefront.entryPath, fallback: network.routes.storefront.fallback } }, null, 2)} as const);\n`;
await emit(resolve(root, 'packages/config/src/NetworkCatalog.ts'), networkSource);

const clientCatalog = clients.clients.map((client) => ({
  ...client,
  origin: origins[client.id],
  localOrigin: `http://127.0.0.1:${client.localPort}`,
}));
const clientSource =
  `// Generated from config/clients.yml and infrastructure/network/Edge.yml. Do not edit.\n` +
  `export const CLIENT_CATALOG_CHECKSUM = '${createHash('sha256').update(JSON.stringify({ clients, routes: network.routes })).digest('hex')}' as const;\n` +
  `const CLIENT_SOURCE = ${JSON.stringify(clientCatalog, null, 2)} as const;\n` +
  `export const CLIENT_CATALOG = Object.freeze(CLIENT_SOURCE.map((client) => Object.freeze({ ...client, domains: Object.freeze([...client.domains]) })));\n` +
  `export type ClientSurface = (typeof CLIENT_CATALOG)[number]['id'];\n` +
  `export type ClientTarget = Exclude<(typeof CLIENT_CATALOG)[number]['target'], null>;\n` +
  `export const CLIENT_BY_ID: ReadonlyMap<ClientSurface, (typeof CLIENT_CATALOG)[number]> = new Map(CLIENT_CATALOG.map((client) => [client.id, client]));\n` +
  `export const CLIENT_TARGETS = Object.freeze(CLIENT_CATALOG.flatMap((client) => client.target === null ? [] : [client.target])) as readonly ClientTarget[];\n` +
  `export const CLIENT_ORIGINS = Object.freeze(Object.fromEntries(CLIENT_CATALOG.map((client) => [client.id, client.origin]))) as Readonly<Record<ClientSurface, string>>;\n` +
  `export const CLIENT_LOCAL_ORIGINS = Object.freeze(Object.fromEntries(CLIENT_CATALOG.map((client) => [client.id, client.localOrigin]))) as Readonly<Record<ClientSurface, string>>;\n`;
await emit(resolve(root, 'packages/config/src/ClientCatalog.ts'), clientSource);

const providerTypes = Object.keys(identity.types).sort();
const providerSource =
  `// Generated from config/identityproviders.yml and infrastructure/network/Edge.yml. Do not edit.\n` +
  `export const IDENTITY_PROVIDER_CHECKSUM = '${createHash('sha256').update(JSON.stringify({ identity, auth: origins.auth })).digest('hex')}' as const;\n\n` +
  `export const IDENTITY_PROVIDER_TYPES = Object.freeze(${JSON.stringify(providerTypes)} as const);\n` +
  `export type IdentityProviderType = (typeof IDENTITY_PROVIDER_TYPES)[number];\n\n` +
  `export const IDENTITY_PROVIDER_CONFIGURATION = Object.freeze({\n` +
  `  schemaVersion: ${identity.version},\n` +
  `  schema: Object.freeze(${JSON.stringify(identity.schema, null, 2)} as const),\n` +
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
  `  redirectAllowlist: Object.freeze(${JSON.stringify(identity.security.redirectAllowlist)} as const),\n` +
  `  bindingConflict: '${identity.security.bindingConflict}',\n` +
  `  accountLink: '${identity.security.accountLink}',\n` +
  `  keyRotationDays: ${identity.security.keyRotationDays},\n` +
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

function validate(cacheDocument, capacityDocument, telemetryDocument, networkDocument, identityDocument, clientDocument, eventDocument) {
  if (cacheDocument?.version !== 1 || cacheDocument.owner !== 'platform' || typeof cacheDocument.caches !== 'object') throw new Error('CACHE_CATALOG_INVALID');
  const browser = cacheDocument.browser;
  const query = browser?.query;
  if (
    typeof browser !== 'object' ||
    !Number.isSafeInteger(query?.staleMilliseconds) ||
    !Number.isSafeInteger(query?.garbageCollectionMilliseconds) ||
    !Number.isSafeInteger(query?.retryCount) ||
    typeof query?.refetchOnWindowFocus !== 'boolean' ||
    typeof query?.refetchOnReconnect !== 'boolean' ||
    !Array.isArray(browser.identity?.parts) ||
    !Array.isArray(browser.storefrontIdentity?.parts) ||
    browser.scopeChange?.cancelPending !== true ||
    browser.scopeChange?.removePrevious !== true
  ) throw new Error('BROWSER_CACHE_POLICY_INVALID');
  const eventIds = new Set((eventDocument?.events ?? []).map(({ id }) => id));
  const requiredCaches = ['publishedexperience', 'listing', 'accessversion', 'navigation', 'providerhealth', 'reportingwatermark'];
  if (requiredCaches.some((name) => cacheDocument.caches[name] === undefined)) throw new Error('CACHE_REQUIRED_ENTRY_MISSING');
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
      typeof value.commandRevalidate !== 'boolean' ||
      !Array.isArray(value.invalidatedBy) ||
      value.invalidatedBy.length === 0 ||
      new Set(value.invalidatedBy).size !== value.invalidatedBy.length ||
      value.invalidatedBy.some((event) => !eventIds.has(event))
    )
      throw new Error(`CACHE_ENTRY_INVALID:${name}`);
  }
  if (
    capacityDocument?.version !== 1 ||
    capacityDocument.owner !== 'platform' ||
    typeof capacityDocument.model !== 'object' ||
    typeof capacityDocument.provider !== 'object' ||
    typeof capacityDocument.imports !== 'object' ||
    typeof capacityDocument.workers !== 'object' ||
    typeof capacityDocument.clients !== 'object' ||
    typeof capacityDocument.navigation !== 'object' ||
    typeof capacityDocument.runtime?.cart !== 'object' ||
    typeof capacityDocument.runtime?.checkout !== 'object' ||
    typeof capacityDocument.runtime?.authentication?.otp !== 'object' ||
    typeof capacityDocument.runtime?.external !== 'object' ||
    typeof capacityDocument.runtime?.http !== 'object' ||
    typeof capacityDocument.runtime?.stream !== 'object' ||
    typeof capacityDocument.runtime?.pool !== 'object' ||
    typeof capacityDocument.runtime?.poolBudget !== 'object' ||
    typeof capacityDocument.runtime?.sql !== 'object'
    || typeof capacityDocument.runtime?.queue !== 'object'
    || typeof capacityDocument.runtime?.cleanup !== 'object'
    || typeof capacityDocument.runtime?.worker !== 'object'
  ) {
    throw new Error('CAPACITY_CATALOG_INVALID');
  }
  const cart = capacityDocument.runtime.cart;
  const queue = capacityDocument.runtime.queue;
  if (Object.keys(queue).sort().join(',') !== 'deferred,lowPriority,maximumDepth,protected,reservedDepth'
    || !Number.isSafeInteger(queue.maximumDepth) || queue.maximumDepth < 256
    || !Number.isSafeInteger(queue.reservedDepth) || queue.reservedDepth < 1 || queue.reservedDepth >= queue.maximumDepth
    || !Number.isSafeInteger(queue.lowPriority) || queue.lowPriority < 1 || queue.lowPriority > 1000
    || queue.deferred?.join(',') !== 'export,import,maintenance'
    || queue.protected?.join(',') !== 'transaction,payment,inventory,identity,risk'
    || queue.deferred.some(value => queue.protected.includes(value))) throw new Error('QUEUE_CAPACITY_INVALID');
  const cleanup = capacityDocument.runtime.cleanup;
  if (Object.keys(cleanup).sort().join(',') !== 'batch,inboxDays,objectConcurrency,outboxDays'
    || !Number.isSafeInteger(cleanup.batch) || cleanup.batch < 1 || cleanup.batch > 5000
    || !Number.isSafeInteger(cleanup.objectConcurrency) || cleanup.objectConcurrency < 1 || cleanup.objectConcurrency > 32
    || !Number.isSafeInteger(cleanup.inboxDays) || cleanup.inboxDays < 1 || cleanup.inboxDays > 365
    || !Number.isSafeInteger(cleanup.outboxDays) || cleanup.outboxDays < 1 || cleanup.outboxDays > 365) throw new Error('CLEANUP_CAPACITY_INVALID');
  const runtimeWorker = capacityDocument.runtime.worker;
  if (Object.keys(runtimeWorker).sort().join(',') !== 'outbox,scheduler'
    || Object.keys(runtimeWorker.outbox ?? {}).sort().join(',') !== 'batch,concurrency,pollMilliseconds'
    || !Number.isSafeInteger(runtimeWorker.outbox.batch) || runtimeWorker.outbox.batch < 1 || runtimeWorker.outbox.batch > 1000
    || !Number.isSafeInteger(runtimeWorker.outbox.concurrency) || runtimeWorker.outbox.concurrency < 1 || runtimeWorker.outbox.concurrency > runtimeWorker.outbox.batch
    || !Number.isSafeInteger(runtimeWorker.outbox.pollMilliseconds) || runtimeWorker.outbox.pollMilliseconds < 50 || runtimeWorker.outbox.pollMilliseconds > 60_000
    || Object.keys(runtimeWorker.scheduler ?? {}).sort().join(',') !== 'leaseSeconds,pollMilliseconds'
    || !Number.isSafeInteger(runtimeWorker.scheduler.leaseSeconds) || runtimeWorker.scheduler.leaseSeconds < 5 || runtimeWorker.scheduler.leaseSeconds > 900
    || !Number.isSafeInteger(runtimeWorker.scheduler.pollMilliseconds) || runtimeWorker.scheduler.pollMilliseconds < 1_000 || runtimeWorker.scheduler.pollMilliseconds > 300_000) {
    throw new Error('RUNTIME_WORKER_CAPACITY_INVALID');
  }
  const voucherExport = capacityDocument.runtime.voucherExport;
  const voucherTender = capacityDocument.runtime.voucherTender;
  if (!voucherTender || Object.keys(voucherTender).join(',') !== 'holdTtlSeconds' ||
    !Number.isSafeInteger(voucherTender.holdTtlSeconds) || voucherTender.holdTtlSeconds <= 0) {
    throw new Error('CAPACITY_VOUCHER_TENDER_INVALID');
  }
  if (!voucherExport || Object.keys(voucherExport).sort().join(',') !== 'downloadTtlSeconds,pageRows,revealConcurrency,snapshotTtlSeconds' ||
    Object.values(voucherExport).some(value => !Number.isSafeInteger(value) || value <= 0) ||
    voucherExport.pageRows > capacityDocument.model.voucherBatch || voucherExport.revealConcurrency > voucherExport.pageRows ||
    voucherExport.downloadTtlSeconds < 60 || voucherExport.downloadTtlSeconds > 300 ||
    voucherExport.snapshotTtlSeconds < voucherExport.downloadTtlSeconds || voucherExport.snapshotTtlSeconds > 86400) {
    throw new Error('VOUCHER_EXPORT_CAPACITY_INVALID');
  }
  if (
    !Number.isSafeInteger(cart.maximumLines) ||
    cart.maximumLines < 1 ||
    cart.maximumLines > capacityDocument.runtime.sql.maximumRows ||
    !Number.isSafeInteger(cart.maximumBatchItems) ||
    cart.maximumBatchItems < 1 ||
    cart.maximumBatchItems > cart.maximumLines ||
    !Number.isSafeInteger(cart.maximumQuantity) ||
    cart.maximumQuantity < 1 ||
    !Number.isSafeInteger(cart.tokenBytes) ||
    cart.tokenBytes < 32
  ) throw new Error('CART_CAPACITY_INVALID');
  const checkout = capacityDocument.runtime.checkout;
  if (
    !Number.isSafeInteger(checkout.quoteTtlSeconds) ||
    checkout.quoteTtlSeconds < 60 ||
    checkout.quoteTtlSeconds > 3600 ||
    !Number.isSafeInteger(checkout.dependencyTimeoutMilliseconds) ||
    checkout.dependencyTimeoutMilliseconds < 50 ||
    checkout.dependencyTimeoutMilliseconds > capacityDocument.runtime.http.totalDeadlineMilliseconds ||
    !Number.isSafeInteger(checkout.parallelConcurrency) ||
    checkout.parallelConcurrency < 2 ||
    checkout.parallelConcurrency > 16 ||
    !Number.isSafeInteger(checkout.maximumPriceDriftMinor) ||
    checkout.maximumPriceDriftMinor < 0 ||
    !Number.isSafeInteger(checkout.confirmationTokenBytes) ||
    checkout.confirmationTokenBytes < 32
  ) throw new Error('CHECKOUT_CAPACITY_INVALID');
  const imports = capacityDocument.imports;
  if (capacityDocument.model.voucherCredentials < 1_000_000 ||
    Object.keys(imports).sort().join(',') !== 'chunkLeaseSeconds,chunkRows,kinds,maximumColumns,maximumCompressionRatio,maximumConcurrentChunks,maximumConcurrentJobs,maximumConcurrentRows,maximumExpandedBytes,maximumFileBytes,maximumRows,maximumSpreadsheetBytes,maximumSpreadsheetEntries,previewRows' ||
    imports.kinds?.join(',') !== 'member,product,inventory,vouchercredential,finance,order' ||
    [imports.maximumRows,imports.previewRows,imports.chunkRows,imports.maximumConcurrentJobs,imports.maximumConcurrentChunks,
      imports.maximumConcurrentRows,imports.chunkLeaseSeconds,imports.maximumFileBytes,imports.maximumSpreadsheetBytes,
      imports.maximumExpandedBytes,imports.maximumCompressionRatio,imports.maximumSpreadsheetEntries,imports.maximumColumns].some(value => !Number.isSafeInteger(value) || value < 1) ||
    imports.previewRows > imports.chunkRows || imports.chunkRows > imports.maximumRows ||
    imports.maximumConcurrentRows > imports.chunkRows || imports.maximumConcurrentChunks > imports.maximumConcurrentJobs ||
    imports.maximumSpreadsheetBytes > imports.maximumFileBytes || imports.maximumExpandedBytes < imports.maximumSpreadsheetBytes ||
    imports.maximumCompressionRatio > 1000 || imports.maximumSpreadsheetEntries > 100000 || imports.maximumColumns > 256 ||
    imports.chunkLeaseSeconds < 30 || imports.chunkLeaseSeconds > 900) throw new Error('IMPORT_CAPACITY_INVALID');
  for (const worker of ['provider', 'report', 'notification']) {
    const policy = capacityDocument.workers[worker];
    if (!Number.isSafeInteger(policy?.concurrency) || policy.concurrency < 1 || !Number.isSafeInteger(policy.queue) || policy.queue < policy.concurrency || !Number.isSafeInteger(policy.deadlineMilliseconds) || policy.deadlineMilliseconds < 1) throw new Error(`WORKER_CAPACITY_INVALID:${worker}`);
  }
  if (Object.keys(capacityDocument.clients).join(',') !== 'auth,console,storefront,miniapp,store,supplier') throw new Error('CLIENT_CAPACITY_INVALID');
  if (
    Object.keys(capacityDocument.navigation).sort().join(',') !== 'maximumNodes,maximumRoutes' ||
    !Number.isSafeInteger(capacityDocument.navigation.maximumRoutes) ||
    capacityDocument.navigation.maximumRoutes < 1 ||
    !Number.isSafeInteger(capacityDocument.navigation.maximumNodes) ||
    capacityDocument.navigation.maximumNodes < 1
  ) throw new Error('NAVIGATION_CAPACITY_INVALID');
  const redaction = telemetryDocument?.redaction?.deny;
  const telemetryBuffer = telemetryDocument?.buffer;
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
  if (Object.keys(telemetryBuffer ?? {}).sort().join(',') !== 'capacity,maximumRead,retentionSeconds'
    || !Number.isSafeInteger(telemetryBuffer.capacity) || telemetryBuffer.capacity < 1000 || telemetryBuffer.capacity > 100000
    || !Number.isSafeInteger(telemetryBuffer.retentionSeconds) || telemetryBuffer.retentionSeconds < 60 || telemetryBuffer.retentionSeconds > 86400
    || !Number.isSafeInteger(telemetryBuffer.maximumRead) || telemetryBuffer.maximumRead < 100 || telemetryBuffer.maximumRead > telemetryBuffer.capacity) {
    throw new Error('TELEMETRY_BUFFER_INVALID');
  }
  const health = telemetryDocument?.health;
  if (Object.keys(health ?? {}).sort().join(',') !== 'checks,freshnessSeconds,queueBacklogDepth'
    || !Number.isSafeInteger(health.freshnessSeconds) || health.freshnessSeconds < 60 || health.freshnessSeconds > telemetryBuffer.retentionSeconds
    || !Number.isSafeInteger(health.queueBacklogDepth) || health.queueBacklogDepth < 1
    || health.checks?.join(',') !== 'dependency,queue,provider,servicelevel,release') throw new Error('TELEMETRY_HEALTH_INVALID');
  for (const [id, level] of Object.entries(telemetryDocument.serviceLevels ?? {})) {
    const indicator = level?.indicator;
    const indicatorKeys = indicator?.type === 'ratio' ? 'goodResult,metric,type' : 'metric,percentile,type';
    if (!/^[a-z][a-z0-9]*$/.test(id)
      || Object.keys(level ?? {}).sort().join(',') !== 'direction,indicator,owner,runbook,severity,targetKey,title,unit,windowSeconds'
      || Object.keys(indicator ?? {}).sort().join(',') !== indicatorKeys
      || !['ratio', 'percentile'].includes(indicator.type)
      || !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(indicator.metric)
      || (indicator.type === 'ratio' && (typeof indicator.goodResult !== 'string' || !indicator.goodResult))
      || (indicator.type === 'percentile' && ![50, 90, 95, 99].includes(indicator.percentile))
      || !['minimum', 'maximum'].includes(level.direction)
      || !['percent', 'milliseconds', 'seconds'].includes(level.unit)
      || !['warning', 'critical'].includes(level.severity)
      || typeof level.title !== 'string' || !level.title.trim()
      || !/^[a-z][a-z0-9]*$/.test(level.owner)
      || !/^docs\/operations\/[a-z0-9]+\.md$/.test(level.runbook)
      || !Number.isSafeInteger(level.windowSeconds) || level.windowSeconds < 60 || level.windowSeconds > telemetryBuffer.retentionSeconds
      || typeof level.targetKey !== 'string' || typeof telemetryDocument.slo?.[level.targetKey] !== 'number'
      || telemetryDocument.slo[level.targetKey] <= 0
      || (level.unit === 'percent' && telemetryDocument.slo[level.targetKey] >= 100)) throw new Error(`TELEMETRY_SERVICE_LEVEL_INVALID:${id}`);
  }
  if (Object.keys(telemetryDocument.serviceLevels ?? {}).length < 1) throw new Error('TELEMETRY_SERVICE_LEVEL_MISSING');
  const alertFields = 'dashboard,measure,mitigation,owner,recentChanges,runbook,severity,signal,threshold,title,traceQuery,windowSeconds';
  const dashboards = new Set(['identity', 'salechain', 'transaction', 'voucher', 'finance', 'provider', 'runtime', 'clients']);
  for (const [id, rule] of Object.entries(telemetryDocument.alerts ?? {})) {
    if (!/^[a-z][a-z0-9]*$/.test(id)
      || Object.keys(rule ?? {}).sort().join(',') !== alertFields
      || typeof rule.title !== 'string' || !rule.title.trim()
      || !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(rule.signal)
      || !['count', 'percent', 'burnrate', 'inversepercent', 'failurepercent', 'seconds'].includes(rule.measure)
      || !Number.isFinite(rule.threshold) || rule.threshold < 0
      || !Number.isSafeInteger(rule.windowSeconds) || rule.windowSeconds < 60 || rule.windowSeconds > telemetryBuffer.retentionSeconds
      || !['warning', 'critical'].includes(rule.severity)
      || !/^[a-z][a-z0-9]*$/.test(rule.owner)
      || !/^docs\/operations\/[a-z0-9]+\.md$/.test(rule.runbook)
      || !dashboards.has(rule.dashboard)
      || !/^[a-z][a-z0-9]*$/.test(rule.recentChanges)
      || !/^[a-z][a-z0-9]*$/.test(rule.traceQuery)
      || !/^[a-z][a-z0-9]*$/.test(rule.mitigation)) throw new Error(`TELEMETRY_ALERT_INVALID:${id}`);
  }
  const requiredAlerts = ['servicelevelburn', 'paymentunknown', 'inventoryconflict', 'ledgerimbalance', 'voucherbatchfailure', 'importfailure', 'outboxbacklog', 'providercapabilityfailure', 'releasefailure', 'securityincident'];
  if (requiredAlerts.some((id) => telemetryDocument.alerts?.[id] === undefined)) throw new Error('TELEMETRY_ALERT_MISSING');
  for (const metric of ['operation', 'job', 'provider', 'resource', 'approval', 'voucherbatch', 'importing', 'reconciliation', 'providercapability', 'webvitals']) {
    const dimensions = telemetryDocument.metrics?.[metric];
    if (!Array.isArray(dimensions) || dimensions.length === 0 || new Set(dimensions).size !== dimensions.length) throw new Error(`TELEMETRY_METRIC_INVALID:${metric}`);
  }
  for (const [name, ratio] of Object.entries(telemetryDocument.sampling ?? {})) if (typeof ratio !== 'number' || ratio < 0 || ratio > 1) throw new Error(`TELEMETRY_SAMPLING_INVALID:${name}`);
  const retention = telemetryDocument.retention;
  if (Object.keys(retention ?? {}).sort().join(',') !== 'errorTraceDays,highRiskTraceDays,metricsDays,operationalLogDays,securityLogDays,successfulTraceDays'
    || Object.values(retention ?? {}).some((days) => !Number.isSafeInteger(days) || days < 1)
    || retention.errorTraceDays < retention.successfulTraceDays
    || retention.highRiskTraceDays < retention.errorTraceDays
    || retention.securityLogDays < retention.operationalLogDays) throw new Error('TELEMETRY_RETENTION_INVALID');
  const telemetryExport = telemetryDocument.export;
  if (Object.keys(telemetryExport ?? {}).sort().join(',') !== 'metricUnknownLabel,onRedactionFailure,piiAllowed,redactionOrder,traceIdentifiersAs'
    || telemetryExport.redactionOrder !== 'before-buffer-and-export'
    || telemetryExport.onRedactionFailure !== 'drop-and-alert'
    || telemetryExport.piiAllowed !== false
    || telemetryExport.metricUnknownLabel !== 'reject-and-alert'
    || telemetryExport.traceIdentifiersAs !== 'exemplar') throw new Error('TELEMETRY_EXPORT_INVALID');
  if (
    networkDocument?.version !== 1 ||
    networkDocument.owner !== 'platform' ||
    !networkDocument.routes ||
    !['api', 'auth', 'console', 'storefront', 'miniapp', 'store', 'supplier'].every((name) => /^[a-z0-9.-]+$/.test(networkDocument.routes[name]?.host ?? '')) ||
    networkDocument.routes.storefront.entryPath !== '/s' ||
    networkDocument.routes.storefront.fallback !== 'index.html' ||
    new Set(['api', 'auth', 'console', 'storefront', 'miniapp', 'store', 'supplier'].map((name) => networkDocument.routes[name].host)).size !== 7
  ) {
    throw new Error('NETWORK_CATALOG_INVALID');
  }
  const expectedClients = ['auth', 'console', 'storefront', 'miniapp', 'store', 'supplier'];
  if (
    clientDocument?.version !== 1 ||
    clientDocument.owner !== 'platform' ||
    !Array.isArray(clientDocument.clients) ||
    clientDocument.clients.map(({ id }) => id).join(',') !== expectedClients.join(',') ||
    clientDocument.clients.some(
      (client) =>
        client.route !== client.id ||
        networkDocument.routes[client.route]?.artifact !== client.id ||
        !Number.isSafeInteger(client.localPort) ||
        !['src', 'miniprogram'].includes(client.sourceRoot) ||
        (client.id === 'miniapp') !== (client.sourceRoot === 'miniprogram')
    )
  ) {
    throw new Error('CLIENT_CATALOG_INVALID');
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
    identityDocument?.version !== 3 ||
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
  const providerSchema = identityDocument.schema?.provider;
  const wechatSchema = identityDocument.schema?.wechatapplication;
  if (
    providerSchema?.required?.join(',') !== 'id,type,issuer,audiences,clientId,secretRef,keyVersion,enabled' ||
    providerSchema.issuer !== 'httpsurl' ||
    providerSchema.audiences !== 'nonemptyunique' ||
    providerSchema.clientId !== 'publicidentifier' ||
    providerSchema.secretRef !== 'secretreference' ||
    providerSchema.keyVersion !== 'positiveinteger' ||
    wechatSchema?.required?.join(',') !== 'scene,appId,secretRef,keyVersion' ||
    wechatSchema.scenes?.join(',') !== 'miniapp,jsapi' ||
    wechatSchema.appId !== 'wechatapplicationid' ||
    wechatSchema.secretRef !== 'secretreference' ||
    wechatSchema.keyVersion !== 'positiveinteger' ||
    identitySecurity.redirectAllowlist?.join(',') !== origin(networkDocument.routes.auth.host) ||
    identitySecurity.bindingConflict !== 'reject' ||
    identitySecurity.accountLink !== 'explicitproof' ||
    identitySecurity.keyRotationDays !== 90
  ) throw new Error('IDENTITY_PROVIDER_SCHEMA_INVALID');
  for (const [name, policy] of Object.entries(identityTypes)) {
    if (!expectedTypes.includes(name) || !Number.isSafeInteger(policy.timeoutMilliseconds) || policy.timeoutMilliseconds < 1 || !Number.isSafeInteger(policy.circuitFailureThreshold) || policy.circuitFailureThreshold < 1 || !Number.isSafeInteger(policy.circuitRecoveryMilliseconds) || policy.circuitRecoveryMilliseconds < 1) {
      throw new Error(`IDENTITY_PROVIDER_TYPE_INVALID:${name}`);
    }
  }
  for (const name of ['discoveryTtlSeconds', 'jwksTtlSeconds', 'clockSkewSeconds', 'transactionTtlSeconds', 'ticketTtlSeconds', 'preauthTtlSeconds', 'stateBytes', 'nonceBytes', 'maximumProviders', 'maximumScopes', 'maximumResponseBytes', 'retryAttempts']) {
    if (!Number.isSafeInteger(identitySecurity[name]) || identitySecurity[name] < 1) throw new Error(`IDENTITY_PROVIDER_SECURITY_INVALID:${name}`);
  }
  const otp = capacityDocument.runtime.authentication.otp;
  if (otp.validMinutes !== 10 || otp.resendSeconds !== 30 || otp.maximumAttempts !== 10) throw new Error('OTP_POLICY_INVALID');
  const authentication = capacityDocument.runtime.authentication;
  const password = authentication.password;
  if (
    !Number.isSafeInteger(authentication.bootstrap?.ttlSeconds) ||
    authentication.bootstrap.ttlSeconds < 60 ||
    authentication.bootstrap.ttlSeconds > 900 ||
    !Number.isSafeInteger(authentication.session?.ttlSeconds) ||
    authentication.session.ttlSeconds !== 7200 ||
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
      value.idleTransactionTimeoutMilliseconds < 0 ||
      typeof value.jit !== 'boolean'
    ) {
      throw new Error(`POOL_CAPACITY_INVALID:${name}`);
    }
  }
  const budget = capacityDocument.runtime.poolBudget;
  const connections = Object.values(capacityDocument.runtime.pool).reduce((sum, profile) => sum + profile.maximumConnections, 0);
  const sessionConnections = Math.max(capacityDocument.runtime.pool.query.maximumConnections + capacityDocument.runtime.pool.command.maximumConnections, capacityDocument.runtime.pool.worker.maximumConnections, capacityDocument.runtime.pool.migration.maximumConnections);
  if (
    !Number.isSafeInteger(budget.databaseMaximumConnections) ||
    budget.databaseMaximumConnections < 1 ||
    !Number.isSafeInteger(budget.sessionMaximumConnections) ||
    budget.sessionMaximumConnections < 1 ||
    !Number.isSafeInteger(budget.maximumUtilizationPercent) ||
    budget.maximumUtilizationPercent < 1 ||
    budget.maximumUtilizationPercent > 70 ||
    connections * 100 > budget.databaseMaximumConnections * budget.maximumUtilizationPercent ||
    sessionConnections * 100 > budget.sessionMaximumConnections * budget.maximumUtilizationPercent
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
