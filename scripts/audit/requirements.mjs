import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';

import { loadRequirementAuthority } from '../../tools/requirementgen/src/Authority.ts';
import { report } from './report.mjs';

const root = resolve(import.meta.dirname, '../..');
const names = Object.freeze({
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
const operations = readYaml('packages/contract/definitions/operations.yml').operations ?? [];
const navigationEvidence = JSON.parse(readFileSync(join(root, 'evidence/navigation/catalog.json'), 'utf8'));
const operationById = new Map(operations.map((operation) => [operation.id, operation]));
const violations = [];
const fail = (code, location, detail = '') => violations.push({ code, location, detail });
const statusRank = new Map(['Designed', 'Implemented', 'Integrated', 'Accepted', 'Released'].map((status, index) => [status, index]));
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
  }
  if (mapping.parserVersion !== authority.parserVersion || mapping.generatorVersion !== authority.generatorVersion || mapping.generatedAt !== authority.generatedAt) fail('REQUIREMENT_GENERATOR_METADATA_DRIFT', names.mapping);
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
    if (!['console', 'auth', 'storefront'].includes(requirement.client)) fail('NON_MVP_CLIENT', location, requirement.client);
    if (!String(requirement.uiRoute).startsWith('/scopes/:scopeKind/:scopeId/')) fail('ROUTE_OUTSIDE_SCOPE_WORKSPACE', location, requirement.uiRoute);
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
    checkStatus(record, location);
    if (!Array.isArray(record.navigation) || record.navigation.length === 0) fail('MVP_NAVIGATION_MISSING', location);
    if (!Array.isArray(record.routes) || record.routes.length === 0) fail('MVP_ROUTE_MISSING', location);
    for (const route of record.routes ?? []) if (!String(route).startsWith('/')) fail('MVP_ROUTE_INVALID', location, route);
    for (const operationId of record.operations ?? []) {
      const operation = operationById.get(operationId);
      if (!operation || !operation.requirements?.includes(record.id)) fail('MVP_OPERATION_TRACE_INVALID', location, operationId);
    }
    if (record.status === 'Released') checkSignedEvidence(record.releaseEvidence, location);
  });
  const blockers = records.flatMap((record) => (record.releaseBlockers ?? []).map((blocker) => ({ requirement: record.id, ...blocker })));
  const expected = ['MVPGROUPSETTING', 'MVPGROUPVOUCHER', 'MVPMALLVOUCHER'];
  if (
    blockers
      .map(({ requirement }) => requirement)
      .sort()
      .join() !== expected.join()
  )
    fail('MVP_RELEASE_BLOCKERS_INVALID', names.mvp);
  for (const blocker of blockers) if (!['open', 'resolved'].includes(blocker.status) || !blocker.owner) fail('MVP_RELEASE_BLOCKER_POLICY_INVALID', names.mvp, blocker.requirement);
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
  if (records.length !== authority.sheets.requirements) fail('FRONTEND_COUNT_INVALID', names.frontend, String(records.length));
  for (const record of records) {
    const location = `${names.frontend}:${record.requirement}`;
    checkStatus(record, location);
    if (!['console', 'auth', 'storefront'].includes(record.client)) fail('NON_MVP_CLIENT', location, record.client);
    if (!Array.isArray(record.callers) || !Array.isArray(record.callees) || !record.files) fail('FRONTEND_TRACE_INCOMPLETE', location);
  }
}

function checkTrace() {
  const records = documents.trace.requirements ?? [];
  if (records.length !== 22) fail('MVP_TRACE_COUNT_INVALID', names.trace, String(records.length));
  const expectedChain = ['WorkbookCell', 'Requirement', 'Route', 'Operation', 'Schema', 'Permission', 'Capability', 'Scope', 'Handler', 'Owner', 'Table', 'Test', 'Runbook', 'SignedEvidence'];
  if (JSON.stringify(documents.trace.chain) !== JSON.stringify(expectedChain)) fail('MVP_TRACE_CHAIN_INVALID', names.trace);
  for (const record of records) {
    const location = `${names.trace}:${record.requirement}`;
    for (const field of ['workbookCell', 'requirement', 'navigation', 'routes', 'operations', 'schemas', 'modules', 'tables', 'tests', 'runbook', 'signedEvidence', 'releaseBlockers']) {
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

function checkSignedEvidence(path, location) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) return fail('SIGNED_EVIDENCE_MISSING', location, path);
  const evidence = JSON.parse(readFileSync(absolute, 'utf8'));
  if (evidence.requirement !== location.split(':').at(-1) || !evidence.signature || !evidence.sourceTreeHash || !evidence.contractHash || !evidence.migrationHead || !evidence.artifactDigest) fail('SIGNED_EVIDENCE_INVALID', location, path);
}
