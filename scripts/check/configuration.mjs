#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const names = ['authorities', 'bundles', 'cache', 'capacity', 'clients', 'identityproviders', 'licenses', 'naming', 'navigation', 'providers', 'requirements', 'telemetry', 'visuals'];
const documents = Object.fromEntries(names.map((name) => [name, load(name)]));
const surfaces = ['auth', 'console', 'storefront', 'miniapp', 'store', 'supplier'];
const providerIds = ['jdproduct', 'jdfresh', 'tmall', 'supplier', 'cake', 'flower', 'book', 'charge', 'foodvoucher', 'movie', 'meal'];

for (const [name, value] of Object.entries(documents)) {
  required(value?.version, `CONFIG_VERSION_MISSING:${name}`);
  required(value?.owner, `CONFIG_OWNER_MISSING:${name}`);
}

exact(documents.clients.clients.map(({ id }) => id), surfaces, 'CLIENT_SURFACE_SET_INVALID');
unique(documents.clients.clients.map(({ workspace }) => workspace), 'CLIENT_WORKSPACE_DUPLICATE');
unique(documents.clients.clients.map(({ path }) => path), 'CLIENT_PATH_DUPLICATE');
unique(documents.clients.clients.map(({ localPort }) => localPort), 'CLIENT_PORT_DUPLICATE');
if (documents.clients.clients.some((client) => client.path !== `apps/${client.id}` || client.route !== client.id || !['browser', 'wechat'].includes(client.transport))) fail('CLIENT_RECORD_INVALID');

const imports = documents.capacity.imports;
exact(imports.kinds, ['member', 'product', 'inventory', 'vouchercredential', 'finance', 'order'], 'IMPORT_KIND_SET_INVALID');
if (documents.capacity.model.voucherCredentials < 1_000_000 || imports.maximumRows < 1_000_000 || imports.chunkRows > 10_000 ||
  imports.maximumConcurrentRows > imports.chunkRows || imports.chunkLeaseSeconds < 30 || imports.chunkLeaseSeconds > 900) fail('IMPORT_CAPACITY_INVALID');
const upload = documents.capacity.runtime.upload;
exact(Object.keys(upload), ['authorizationSeconds', 'maximumAuthorizationSeconds', 'maximumChunkBytes', 'maximumAttachmentBytes', 'maximumRetentionDays', 'retentionDays'], 'UPLOAD_CAPACITY_KEY_SET_INVALID');
exact(Object.keys(upload.retentionDays), ['import', 'aftersale', 'support', 'qualification'], 'UPLOAD_RETENTION_CLASS_SET_INVALID');
if (upload.authorizationSeconds < 60 || upload.authorizationSeconds > upload.maximumAuthorizationSeconds || upload.maximumAuthorizationSeconds > 900 ||
  upload.maximumChunkBytes < 65_536 || upload.maximumChunkBytes > imports.maximumFileBytes || upload.maximumAttachmentBytes < 1_048_576 ||
  upload.maximumAttachmentBytes > imports.maximumFileBytes || upload.maximumRetentionDays < 1 || upload.maximumRetentionDays > 3650 ||
  Object.values(upload.retentionDays).some((days) => !Number.isSafeInteger(days) || days < 1 || days > upload.maximumRetentionDays)) fail('UPLOAD_CAPACITY_INVALID');
const queue = documents.capacity.runtime.queue;
exact(Object.keys(queue), ['maximumDepth', 'reservedDepth', 'lowPriority', 'deferred', 'protected'], 'QUEUE_CAPACITY_KEY_SET_INVALID');
unique(queue.deferred, 'QUEUE_DEFERRED_DUPLICATE');
unique(queue.protected, 'QUEUE_PROTECTED_DUPLICATE');
if (!Number.isSafeInteger(queue.maximumDepth) || queue.maximumDepth < 1 || !Number.isSafeInteger(queue.reservedDepth) || queue.reservedDepth < 1 ||
  queue.reservedDepth >= queue.maximumDepth || !Number.isSafeInteger(queue.lowPriority) || queue.lowPriority < 0 || queue.lowPriority > 1000 ||
  queue.deferred.some((name) => queue.protected.includes(name))) fail('QUEUE_CAPACITY_INVALID');
exact(Object.keys(documents.capacity.workers), ['provider', 'report', 'notification'], 'WORKER_POOL_SET_INVALID');
exact(Object.keys(documents.capacity.clients), surfaces, 'CLIENT_BUDGET_SET_INVALID');

const requiredCaches = ['publishedexperience', 'listing', 'accessversion', 'navigation', 'providerhealth', 'reportingwatermark'];
for (const cache of requiredCaches) required(documents.cache.caches[cache], `CACHE_REQUIRED_ENTRY_MISSING:${cache}`);
unique(Object.values(documents.cache.caches).map(({ key }) => key), 'CACHE_KEY_TEMPLATE_DUPLICATE');
for (const [name, cache] of Object.entries(documents.cache.caches)) {
  if (!cache.key || cache.maximumSeconds < 1 || cache.staleSeconds < 0 || cache.staleSeconds > cache.maximumSeconds || !Array.isArray(cache.invalidatedBy) || cache.invalidatedBy.length === 0) fail(`CACHE_ENTRY_INVALID:${name}`);
  unique(cache.invalidatedBy, `CACHE_EVENT_DUPLICATE:${name}`);
}

exact(Object.keys(documents.telemetry.metrics), ['approval', 'voucherbatch', 'importing', 'reconciliation', 'providercapability', 'webvitals'], 'TELEMETRY_METRIC_SET_INVALID');
for (const [metric, dimensions] of Object.entries(documents.telemetry.metrics)) unique(dimensions, `TELEMETRY_DIMENSION_DUPLICATE:${metric}`);
for (const [name, ratio] of Object.entries(documents.telemetry.sampling)) if (typeof ratio !== 'number' || ratio < 0 || ratio > 1) fail(`TELEMETRY_SAMPLING_INVALID:${name}`);
for (const key of ['authorization', 'cardcode', 'cardsecret', 'credential', 'evidence', 'filename', 'mobile', 'password', 'privatekey', 'proof', 'secret', 'token']) if (!documents.telemetry.redaction.deny.includes(key)) fail(`REDACTION_KEY_MISSING:${key}`);

exact(documents.bundles.applications, surfaces, 'BUNDLE_APPLICATION_SET_INVALID');
exact(documents.bundles.services, ['api', 'jobs', 'provider', 'migration'], 'BUNDLE_SERVICE_SET_INVALID');
exact(Object.keys(documents.bundles.budgets.initialGzipKb), surfaces, 'BUNDLE_BUDGET_SET_INVALID');
if (documents.bundles.sourceMaps !== 'hidden' || documents.bundles.budgets.duplicateDependencyKb !== 0 || !['demo', 'mock', 'showcase', 'sourceMapSecret'].every((item) => documents.bundles.forbidden.includes(item))) fail('BUNDLE_POLICY_INVALID');

if (documents.providers.generated !== true || !documents.providers.source.includes('extensions/channel/*/Manifest.ts')) fail('PROVIDER_AUTHORITY_INVALID');
exact(documents.providers.providers.map(({ id }) => id), providerIds, 'PROVIDER_SET_INVALID');
for (const provider of documents.providers.providers) {
  const webhook = provider.capabilities.includes('Webhook');
  if (!provider.name || !/^\d+\.\d+\.\d+$/.test(provider.version) || provider.apiVersion !== '2026-08-21' || !provider.sandbox?.supported || !provider.health?.operation || provider.rateLimit?.requestsPerSecond < 1 || provider.timeout?.totalMs < provider.timeout?.responseMs || provider.retry?.maxAttempts > 5 || webhook !== Boolean(provider.webhook?.contract)) fail(`PROVIDER_RECORD_INVALID:${provider.id}`);
  unique(provider.capabilities, `PROVIDER_CAPABILITY_DUPLICATE:${provider.id}`);
  unique(provider.secretRefs, `PROVIDER_SECRET_REF_DUPLICATE:${provider.id}`);
}

if (documents.requirements.mvp.length !== 22 || documents.requirements.mvp.some((item) => item.release !== 'required')) fail('MVP_RELEASE_SET_INVALID');
unique(documents.requirements.mvp.map(({ id }) => id), 'MVP_ID_DUPLICATE');
if (documents.requirements.clarifications.some((item) => item.status !== 'resolved' || !item.acceptance || !item.resolvedby)) fail('MVP_CLARIFICATION_UNRESOLVED');

exact(Object.keys(documents.visuals.breakpoints), ['mobile', 'tablet', 'desktop', 'wide'], 'VISUAL_BREAKPOINT_SET_INVALID');
exact(documents.visuals.themes, ['shop', 'market', 'governance'], 'VISUAL_THEME_SET_INVALID');
if (documents.visuals.journeys.count !== 44 || documents.visuals.authority.policy.forbidMockRoutes !== true) fail('VISUAL_POLICY_INVALID');

const providerSchema = documents.identityproviders.schema.provider;
const wechatSchema = documents.identityproviders.schema.wechatapplication;
if (providerSchema.secretRef !== 'secretreference' || providerSchema.keyVersion !== 'positiveinteger' || wechatSchema.secretRef !== 'secretreference' || wechatSchema.keyVersion !== 'positiveinteger') fail('IDENTITY_SECRET_SCHEMA_INVALID');
if (documents.identityproviders.security.pkce !== 'S256' || documents.identityproviders.security.bindingConflict !== 'reject' || documents.identityproviders.security.accountLink !== 'explicitproof' || documents.identityproviders.security.redirectAllowlist.some((value) => !value.startsWith('https://'))) fail('IDENTITY_SECURITY_POLICY_INVALID');

for (const term of ['approval', 'credential', 'importing']) if (!documents.naming.requiredTerms.includes(term)) fail(`NAMING_TERM_MISSING:${term}`);
for (const name of ['auth-web', 'storefront-web', 'admin-web', 'commerce-api']) if (!documents.naming.forbidden.runtimeDirectories.includes(name)) fail(`NAMING_RETIRED_DIRECTORY_MISSING:${name}`);
if (!documents.licenses.assets.some(({ id }) => id === 'zhudatuanliwisdomwing') || !documents.licenses.nativeDependencies.some(({ id, secretBundling }) => id === 'wechatminiprogramruntime' && secretBundling === 'forbidden')) fail('LICENSE_PROVENANCE_INVALID');

const owners = documents.authorities.owners;
const expectedOwners = { approval: 'approval', vouchercredential: 'voucher', financeimport: 'finance', storeaudience: 'identity', supplieraudience: 'identity' };
exact(Object.keys(owners), Object.keys(expectedOwners), 'AUTHORITY_OWNER_SET_INVALID');
for (const [fact, module] of Object.entries(expectedOwners)) if (owners[fact].module !== module) fail(`AUTHORITY_OWNER_INVALID:${fact}`);
for (const authority of [...documents.authorities.architecture, documents.authorities.visuals, documents.authorities.navigation]) verifyHash(authority);

const serialized = names.map((name) => readFileSync(join(repositoryRoot, 'config', `${name}.yml`), 'utf8')).join('\n');
if (/AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bsk_(?:live|test)_[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./.test(serialized)) fail('CONFIG_SECRET_VALUE_DETECTED');
if (/[&*]a\d+\b/.test(readFileSync(join(repositoryRoot, 'config/providers.yml'), 'utf8'))) fail('PROVIDER_YAML_ALIAS_FORBIDDEN');

console.log(`configuration accepted=true catalogs=${names.length} surfaces=${surfaces.length} providers=${providerIds.length} requirements=${documents.requirements.mvp.length}`);

function load(name) {
  const file = join(repositoryRoot, 'config', `${name}.yml`);
  const document = parseDocument(readFileSync(file, 'utf8'), { strict: true, uniqueKeys: true });
  if (document.errors.length) fail(`CONFIG_YAML_INVALID:${name}:${document.errors.map(({ message }) => message).join('|')}`);
  return document.toJS();
}

function verifyHash(authority) {
  const actual = createHash('sha256').update(readFileSync(join(repositoryRoot, authority.repositoryRelativePath))).digest('hex');
  if (actual !== authority.sha256) fail(`AUTHORITY_HASH_INVALID:${authority.repositoryRelativePath}`);
}

function exact(actual, expected, code) {
  if (JSON.stringify([...actual].sort()) !== JSON.stringify([...expected].sort())) fail(code);
}

function unique(values, code) {
  if (new Set(values).size !== values.length) fail(code);
}

function required(value, code) {
  if (value === undefined || value === null || value === '') fail(code);
}

function fail(code) {
  throw new Error(code);
}
