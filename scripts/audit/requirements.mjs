import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';

import { loadRequirementAuthority } from '../../tools/requirementgen/src/Authority.ts';
import { loadJourneySource } from '../../tools/requirementgen/src/JourneySource.ts';
import { DELIVERY_STATUSES } from '../../tools/requirementgen/src/DeliveryStatus.ts';
import { isRequirementReleaseEvidence } from '../../tools/requirementgen/src/ReleaseEvidence.ts';
import { report } from './report.mjs';

const root = resolve(import.meta.dirname, '../..');
const names = Object.freeze({
  source: 'docs/requirements/source.yml',
  mapping: 'docs/requirements/mapping.json',
  requirements: 'docs/requirements/requirements.yml',
  mvp: 'docs/requirements/mvp.yml',
  providers: 'docs/requirements/providers.yml',
  frontend: 'docs/requirements/frontend.yml',
  trace: 'docs/requirements/trace.yml',
  contract: 'packages/contract/src/RequirementCatalog.ts',
});
const readYaml = (name) => parse(readFileSync(join(root, name), 'utf8'), { merge: true });
const documents = Object.fromEntries(
  Object.entries(names)
    .filter(([key]) => !['mapping', 'contract'].includes(key))
    .map(([key, name]) => [key, readYaml(name)])
);
const mapping = JSON.parse(readFileSync(join(root, names.mapping), 'utf8'));
const contractType = readFileSync(join(root, names.contract), 'utf8');
const { authority } = await loadRequirementAuthority(root);
const journeySource = await loadJourneySource(root);
const journeyCatalogHash = createHash('sha256').update(journeySource.bytes).digest('hex');
const operations = readYaml('packages/contract/definitions/operations.yml').operations ?? [];
const clients = readYaml('config/clients.yml').clients ?? [];
const navigationEvidence = JSON.parse(readFileSync(join(root, 'evidence/navigation/catalog.json'), 'utf8'));
const operationById = new Map(operations.map((operation) => [operation.id, operation]));
const validClients = new Set(clients.map(({ id }) => id));
const scopedClients = new Set(clients.filter(({ audience }) => audience === 'console').map(({ id }) => id));
const violations = [];
const fail = (code, location, detail = '') => violations.push({ code, location, detail });
const statusRank = new Map(DELIVERY_STATUSES.map((status, index) => [status, index]));
const requiredOperationFields = [
  'id',
  'owner',
  'method',
  'path',
  'audience',
  'permission',
  'capability',
  'scopeKinds',
  'assuranceLevel',
  'makerChecker',
  'originPolicy',
  'csrfPolicy',
  'responseMode',
  'cachePolicy',
  'targetPolicy',
  'idempotencyPolicy',
  'requestSchema',
  'responseSchema',
  'errorUnion',
  'idempotencyScope',
  'expectedVersion',
  'timeout',
  'rateClass',
  'risk',
  'resourceResolver',
  'requirements',
];

checkDocumentHeaders();
checkSource();
checkRequirements();
checkMvp();
checkProviders();
checkFrontend();
checkTrace();

report('requirement graph', violations, {
  requirements: documents.requirements.requirements?.length ?? 0,
  mvp: documents.mvp.requirements?.length ?? 0,
  providers: documents.providers.providers?.length ?? 0,
  traces: documents.trace.requirements?.length ?? 0,
});

function checkDocumentHeaders() {
  const documentsWithSource = [mapping, documents.requirements, documents.mvp, documents.providers, documents.frontend, documents.trace];
  for (const document of documentsWithSource) {
    if (document.workbookSha256 !== authority.sha256) fail('REQUIREMENT_HASH_DRIFT', 'docs/requirements', String(document.workbookSha256));
    if (typeof document.source !== 'string' || !document.source.includes(authority.repositoryRelativePath)) {
      fail('REQUIREMENT_SOURCE_DRIFT', 'docs/requirements', String(document.source));
    }
    if (document.navigationCatalogSha256 !== navigationEvidence.hash) fail('NAVIGATION_HASH_DRIFT', 'docs/requirements', String(document.navigationCatalogSha256));
    if (typeof document.contractSha256 !== 'string' || document.contractSha256.length !== 64) fail('CONTRACT_HASH_MISSING', 'docs/requirements');
    if (document.journeyCatalogSha256 !== journeyCatalogHash) fail('JOURNEY_HASH_DRIFT', 'docs/requirements', String(document.journeyCatalogSha256));
  }
  if (mapping.parserVersion !== authority.parserVersion || mapping.generatorVersion !== authority.generatorVersion || mapping.generatedAt !== authority.generatedAt) fail('REQUIREMENT_GENERATOR_METADATA_DRIFT', names.mapping);
  const coverage = mapping.coverage;
  if (coverage?.modules?.count !== 33 || coverage?.clients?.count !== 6 || coverage?.richVoucherOperations !== 57 || coverage?.approvalOperations !== 10 || coverage?.runtimeImportOperations !== 4 || coverage?.journeys !== 44) {
    fail('REQUIREMENT_COVERAGE_INVALID', names.mapping);
  }
}

function checkSource() {
  const source = documents.source;
  if (
    source.authority?.path !== authority.repositoryRelativePath ||
    source.authority?.sheet !== authority.sheet ||
    source.authority?.sourceRange !== authority.range ||
    source.authority?.selectedRange !== authority.selectionRange ||
    source.authority?.sha256 !== authority.sha256 ||
    source.authority?.readAt !== authority.reviewedAt ||
    JSON.stringify(source.authority?.order) !== JSON.stringify(authority.authorityOrder)
  )
    fail('REQUIREMENT_SOURCE_AUTHORITY_INVALID', names.source);
  if (source.counts?.mvp !== 22 || source.counts?.blocking !== 22 || source.counts?.providerRequired !== 11) fail('REQUIREMENT_SOURCE_COUNT_INVALID', names.source);
  if ((source.mvp ?? []).some(({ release }) => release !== 'blocking') || 'clarifications' in source) fail('REQUIREMENT_SOURCE_POLICY_INVALID', names.source);
}

function checkRequirements() {
  const requirements = documents.requirements.requirements ?? [];
  if (requirements.length !== authority.sheets.requirements || mapping.requirements?.length !== requirements.length) {
    fail('REQUIREMENT_COUNT_INVALID', names.requirements, String(requirements.length));
  }
  if (JSON.stringify(mapping.requirements) !== JSON.stringify(requirements)) fail('REQUIREMENT_MAPPING_DRIFT', names.mapping);
  const ids = new Set();
  for (const requirement of requirements) {
    const location = `${names.requirements}:${requirement.id}`;
    if (ids.has(requirement.id)) fail('REQUIREMENT_ID_DUPLICATE', location);
    ids.add(requirement.id);
    checkStatus(requirement, location);
    if (!Array.isArray(requirement.clients) || requirement.clients.length === 0) fail('REQUIREMENT_CLIENT_MISSING', location);
    for (const client of requirement.clients ?? []) {
      if (!validClients.has(client)) fail('REQUIREMENT_CLIENT_INVALID', location, client);
    }
    if (!Array.isArray(requirement.uiRoutes) || requirement.uiRoutes.length === 0) fail('REQUIREMENT_ROUTE_MISSING', location);
    if (!Array.isArray(requirement.frontend) || requirement.frontend.length === 0) fail('REQUIREMENT_FRONTEND_TRACE_MISSING', location);
    for (const frontend of requirement.frontend ?? []) {
      if (!validClients.has(frontend.client)) fail('REQUIREMENT_CLIENT_INVALID', location, frontend.client);
      if (!String(frontend.route).startsWith('/')) fail('REQUIREMENT_ROUTE_INVALID', location, frontend.route);
      if (scopedClients.has(frontend.client) && !String(frontend.route).startsWith('/scopes/:scopeKind/:scopeId/')) {
        fail('ROUTE_OUTSIDE_SCOPE_WORKSPACE', location, frontend.route);
      }
    }
    const operation = operationById.get(requirement.capability);
    if (!operation) {
      fail('REQUIREMENT_OPERATION_MISSING', location, requirement.capability);
      continue;
    }
    if (operation.owner !== requirement.owner || `${operation.method} ${operation.path}` !== requirement.api) {
      fail('REQUIREMENT_OPERATION_TRACE_INVALID', location, requirement.capability);
    }
    for (const field of requiredOperationFields) if (!(field in operation)) fail('OPERATION_FIELD_MISSING', operation.id, field);
    if (!contractType.includes(`'${requirement.id}'`) && !contractType.includes(`"${requirement.id}"`)) {
      fail('REQUIREMENT_CONTRACT_TYPE_MISSING', location);
    }
  }
}

function checkMvp() {
  const records = documents.mvp.requirements ?? [];
  const expectedIds = [
    'MVPPLATFORM',
    'MVPDISTRIBUTION',
    'MVPGROUPDASHBOARD',
    'MVPGROUPAPPLICATION',
    'MVPGROUPPOOL',
    'MVPGROUPORDER',
    'MVPGROUPVOUCHER',
    'MVPGROUPFINANCE',
    'MVPGROUPREPORT',
    'MVPGROUPSUPPORT',
    'MVPGROUPSETTING',
    'MVPMALLDASHBOARD',
    'MVPMALLDESIGN',
    'MVPMALLPOOL',
    'MVPMALLORDER',
    'MVPMALLVOUCHER',
    'MVPMALLFINANCE',
    'MVPMALLREPORT',
    'MVPMALLSUPPORT',
    'MVPMALLSETTING',
    'MVPIDENTITY',
    'MVPPROVIDER',
  ];
  if (records.length !== expectedIds.length) fail('MVP_COUNT_INVALID', names.mvp, String(records.length));
  records.forEach((record, index) => {
    const expected = expectedIds[index];
    const location = `${names.mvp}:${record.id}`;
    if (record.id !== expected || record.row !== index + 3) fail('MVP_SEQUENCE_INVALID', location, expected);
    if (record.release !== 'blocking') fail('MVP_RELEASE_POLICY_INVALID', location, record.release);
    checkStatus(record, location);
    if (record.status === 'Designed') fail('MVP_DESIGNED_ONLY', location);
    if (!Array.isArray(record.navigation) || record.navigation.length === 0) fail('MVP_NAVIGATION_MISSING', location);
    if (!Array.isArray(record.routes) || record.routes.length === 0) fail('MVP_ROUTE_MISSING', location);
    for (const route of record.routes ?? []) if (!String(route).startsWith('/')) fail('MVP_ROUTE_INVALID', location, route);
    for (const operationId of record.operations ?? []) {
      const operation = operationById.get(operationId);
      if (!operation || !operation.requirements?.includes(record.id)) fail('MVP_OPERATION_TRACE_INVALID', location, operationId);
    }
    if (!Array.isArray(record.journeys) || record.journeys.length === 0) fail('MVP_JOURNEY_MISSING', location);
    if (!Array.isArray(record.journeyTests) || record.journeyTests.length === 0) fail('MVP_JOURNEY_TEST_MISSING', location);
    if (!Array.isArray(record.events) || record.events.length === 0) fail('MVP_EVENT_MISSING', location);
    if (record.status === 'Released') checkSignedEvidence(record.releaseEvidence, location, record.id);
  });
  if (documents.mvp.releasePolicy !== 'blocking' || documents.mvp.statusPolicy !== 'derived-from-code-and-signed-release-evidence') fail('MVP_DELIVERY_POLICY_INVALID', names.mvp);
}

function checkProviders() {
  const providers = documents.providers.providers ?? [];
  if (providers.length !== authority.sheets.providers) fail('PROVIDER_COUNT_INVALID', names.providers, String(providers.length));
  const required = providers.filter(({ priority }) => priority === 1);
  if (required.length !== 11) fail('P1_PROVIDER_COUNT_INVALID', names.providers, String(required.length));
  for (const provider of providers) {
    const location = `${names.providers}:${provider.id}`;
    checkStatus(provider, location);
    if (provider.priority === 1 && provider.extension !== `extensions/channel/${provider.id}`) {
      fail('P1_PROVIDER_EXTENSION_INVALID', location, provider.extension);
    }
    if (provider.priority !== 1 && provider.extension !== null) fail('DEFERRED_PROVIDER_EXPOSED', location, provider.extension);
  }
}

function checkFrontend() {
  const records = documents.frontend.requirements ?? [];
  if (records.length !== documents.frontend.count) fail('FRONTEND_COUNT_INVALID', names.frontend, String(records.length));
  if (new Set(records.map(({ requirement }) => requirement)).size !== authority.sheets.requirements) fail('FRONTEND_REQUIREMENT_COVERAGE_INVALID', names.frontend);
  for (const record of records) {
    const location = `${names.frontend}:${record.requirement}`;
    checkStatus(record, location);
    if (!validClients.has(record.client)) fail('NON_MVP_CLIENT', location, record.client);
    if (!Array.isArray(record.callers) || !Array.isArray(record.callees) || !record.files) fail('FRONTEND_TRACE_INCOMPLETE', location);
  }
}

function checkTrace() {
  const records = documents.trace.requirements ?? [];
  if (records.length !== 22) fail('MVP_TRACE_COUNT_INVALID', names.trace, String(records.length));
  const expectedChain = ['WorkbookCell', 'Requirement', 'Journey', 'Route', 'Operation', 'Schema', 'Permission', 'Capability', 'Scope', 'Handler', 'Owner', 'Table', 'Event', 'Job', 'Test', 'Runbook', 'SignedEvidence'];
  if (JSON.stringify(documents.trace.chain) !== JSON.stringify(expectedChain)) fail('MVP_TRACE_CHAIN_INVALID', names.trace);
  for (const record of records) {
    const location = `${names.trace}:${record.requirement}`;
    for (const field of [
      'workbookCell',
      'requirement',
      'journeys',
      'navigation',
      'routeids',
      'routes',
      'operations',
      'schemas',
      'permissions',
      'capabilities',
      'scopes',
      'handlers',
      'owners',
      'modules',
      'tables',
      'events',
      'eventSchemas',
      'jobs',
      'tests',
      'runbook',
      'signedEvidence',
    ]) {
      if (!(field in record)) fail('MVP_TRACE_FIELD_MISSING', location, field);
    }
  }
}

function checkStatus(record, location) {
  const rank = statusRank.get(record.status);
  if (rank === undefined) fail('REQUIREMENT_STATUS_INVALID', location, record.status);
  if ((rank ?? 0) > 0 && (!Array.isArray(record.evidence) || record.evidence.length === 0)) {
    fail('REQUIREMENT_STATUS_WITHOUT_EVIDENCE', location, record.status);
  }
}

function checkSignedEvidence(path, location, requirement) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) return fail('SIGNED_EVIDENCE_MISSING', location, path);
  const evidence = JSON.parse(readFileSync(absolute, 'utf8'));
  if (!isRequirementReleaseEvidence(evidence, requirement)) fail('SIGNED_EVIDENCE_INVALID', location, path);
}
