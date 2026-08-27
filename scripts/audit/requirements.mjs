import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';

import { loadRequirementAuthority } from '../../tools/requirementgen/src/Authority.ts';
import { report } from './report.mjs';

const root = resolve(import.meta.dirname, '../..');
const names = {
  mapping: 'docs/requirements/mapping.json',
  requirements: 'docs/requirements/requirements.yml',
  mvp: 'docs/requirements/mvp.yml',
  providers: 'docs/requirements/providers.yml',
  frontend: 'docs/requirements/frontend.yml',
  contract: 'packages/contract/src/RequirementCatalog.generated.ts',
};
const documents = Object.fromEntries(Object.entries(names)
  .filter(([key]) => key !== 'contract')
  .map(([key, name]) => [key, parse(readFileSync(join(root, name), 'utf8'))]));
const full = documents.requirements;
const mapping = documents.mapping;
const mvp = documents.mvp;
const providerDocument = documents.providers;
const frontendDocument = documents.frontend;
const { authority } = await loadRequirementAuthority(root);
const operations = parse(readFileSync(join(root, 'packages/contract/definitions/operations.yml'), 'utf8')).operations;
const operationById = new Map(operations.map((operation) => [operation.id, operation]));
const contractType = readFileSync(join(root, names.contract), 'utf8');
const workbookHash = authority.sha256;
const violations = [];
const fail = (code, location, detail) => violations.push({ code, location, detail });
const statusRank = new Map(['Missing', 'Designed', 'Implemented', 'Integrated', 'Accepted', 'Released'].map((status, index) => [status, index]));

const definitions = [
  ['PLAT', '1-平台层', 68, Array.from({ length: 68 }, (_, index) => index + 4)],
  ['DIST', '2-分销层', 41, Array.from({ length: 41 }, (_, index) => index + 4)],
  ['GROUP', '3-集团', 68, Array.from({ length: 68 }, (_, index) => index + 4)],
  ['MALL', '4-、商城', 52, Array.from({ length: 53 }, (_, index) => index + 4).filter((row) => row !== 54)],
  ['STORE', '门店后台', 20, Array.from({ length: 20 }, (_, index) => index + 4)],
  ['SUPPLY', '供应链后台', 20, Array.from({ length: 21 }, (_, index) => index + 4).filter((row) => row !== 22)],
  ['CHAIN', '供应链平台', 7, [7, 8, 10, 11, 12, 13, 14]],
  ['INTEG', '接口', 20, Array.from({ length: 20 }, (_, index) => index + 2)],
];
const expectedSheetCounts = Object.fromEntries(definitions.map(([prefix, , count]) => [prefix, count]));
const fullRequirements = full?.requirements ?? [];
if (mapping?.source !== full?.source || mapping?.count !== authority.sheets.requirements || mapping?.workbookSha256 !== workbookHash
  || JSON.stringify(mapping?.requirements) !== JSON.stringify(fullRequirements)) {
  fail('REQUIREMENT_MAPPING_DRIFT', names.mapping, `${mapping?.count ?? 'missing'}/${authority.sheets.requirements}`);
}
if (workbookHash !== authority.sha256) fail('REQUIREMENT_AUTHORITY_HASH_INVALID', 'config/authorities.yml', workbookHash);
if (full?.source !== authority.logicalSource) fail('REQUIREMENT_SOURCE_INVALID', names.requirements, String(full?.source));
if (full?.count !== authority.sheets.requirements || fullRequirements.length !== authority.sheets.requirements) {
  fail('REQUIREMENT_COUNT_INVALID', names.requirements, full?.count + '/' + fullRequirements.length);
}
if (JSON.stringify(full?.sheetCounts) !== JSON.stringify(expectedSheetCounts)) fail('REQUIREMENT_SHEET_COUNTS_INVALID', names.requirements, JSON.stringify(full?.sheetCounts));
checkHash(full, names.requirements);

const fullIds = new Set();
for (const [prefix, sheet, count, rows] of definitions) {
  const records = fullRequirements.filter(({ id }) => typeof id === 'string' && id.startsWith(prefix));
  const expectedIds = Array.from({ length: count }, (_, index) => prefix + String(index + 1).padStart(3, '0'));
  if (records.map(({ id }) => id).join(',') !== expectedIds.join(',')) fail('REQUIREMENT_IDS_INVALID', names.requirements + ':' + prefix, records.map(({ id }) => id).join(','));
  if (records.map(({ source }) => source?.row).join(',') !== rows.join(',')) fail('REQUIREMENT_ROWS_INVALID', names.requirements + ':' + prefix, records.map(({ source }) => source?.row).join(','));
  for (const requirement of records) {
    const location = names.requirements + ':' + requirement.id;
    if (fullIds.has(requirement.id)) fail('REQUIREMENT_ID_DUPLICATE', location, requirement.id);
    fullIds.add(requirement.id);
    if (requirement.source?.sheet !== sheet) fail('REQUIREMENT_SHEET_INVALID', location, String(requirement.source?.sheet));
    for (const field of ['id', 'section', 'title', 'description', 'role', 'level', 'scope', 'audit', 'module', 'capability', 'api',
      'commandOrQuery', 'tableOrProjection', 'client', 'feature', 'uiRoute', 'performance', 'owner', 'status', 'disposition']) {
      if (typeof requirement[field] !== 'string' || !requirement[field]) fail('REQUIREMENT_FIELD_MISSING', location, field);
    }
    for (const field of ['prerequisites', 'inputs', 'mainFlow', 'stateTransitions', 'exceptionFlow', 'tests', 'externalDependencies', 'evidence']) {
      if (!Array.isArray(requirement[field])) fail('REQUIREMENT_FIELD_MISSING', location, field);
    }
    if (!statusRank.has(requirement.status)) fail('REQUIREMENT_STATUS_INVALID', location, String(requirement.status));
    if (statusRank.get(requirement.status) > statusRank.get('Designed') && requirement.evidence.length === 0) {
      fail('REQUIREMENT_STATUS_WITHOUT_EVIDENCE', location, requirement.status);
    }
    const frontend = requirement.frontend;
    if (!frontend || frontend.client !== requirement.client || frontend.route !== requirement.uiRoute
      || frontend.feature !== requirement.feature || frontend.operation !== requirement.capability
      || !Array.isArray(frontend.evidence) || frontend.status !== 'Missing') {
      fail('REQUIREMENT_FRONTEND_TRACE_INVALID', location, JSON.stringify(frontend));
    }
    const operation = operationById.get(requirement.capability);
    if (!operation) fail('REQUIREMENT_OPERATION_MISSING', location, requirement.capability);
    else if (requirement.api !== operation.method + ' ' + operation.path || requirement.owner !== operation.owner || requirement.module !== operation.owner) {
      fail('REQUIREMENT_OPERATION_TRACE_INVALID', location, requirement.api + '/' + requirement.owner);
    }
    if (!existsSync(join(root, 'services/commerce/src/modules', requirement.module))) fail('REQUIREMENT_MODULE_MISSING', location, requirement.module);
    for (const path of requirement.tests ?? []) if (!existsSync(join(root, path))) fail('REQUIREMENT_TEST_MISSING', location, path);
    if (!contractType.includes("'" + requirement.id + "'") && !contractType.includes('"' + requirement.id + '"')) {
      fail('REQUIREMENT_CONTRACT_TYPE_MISSING', location, requirement.id);
    }
  }
}

const frontendRequirements = frontendDocument?.requirements ?? [];
if (frontendDocument?.source !== authority.logicalSource || frontendDocument?.workbookSha256 !== workbookHash
  || frontendDocument?.count !== authority.sheets.requirements || frontendRequirements.length !== authority.sheets.requirements) {
  fail('FRONTEND_REQUIREMENT_INDEX_INVALID', names.frontend, String(frontendDocument?.count));
}
if (JSON.stringify(frontendDocument?.chain) !== JSON.stringify(['Requirement', 'Client', 'Route', 'Feature', 'Operation', 'Test', 'Evidence'])) {
  fail('FRONTEND_REQUIREMENT_CHAIN_INVALID', names.frontend, JSON.stringify(frontendDocument?.chain));
}
for (const [index, trace] of frontendRequirements.entries()) {
  const requirement = fullRequirements[index];
  const location = names.frontend + ':' + String(trace?.requirement ?? index);
  if (!requirement || trace.requirement !== requirement.id || trace.client !== requirement.client || trace.route !== requirement.uiRoute
    || trace.feature !== requirement.feature || trace.operation !== requirement.capability || trace.test !== requirement.frontend?.test) {
    fail('FRONTEND_REQUIREMENT_TRACE_DRIFT', location, String(requirement?.id));
  }
  for (const field of ['callers', 'callees', 'evidence']) {
    if (!Array.isArray(trace[field])) fail('FRONTEND_REQUIREMENT_FIELD_MISSING', location, field);
  }
  if (!trace.files || typeof trace.files.route !== 'string' || typeof trace.files.feature !== 'string' || typeof trace.files.sdk !== 'string') {
    fail('FRONTEND_REQUIREMENT_FIELD_MISSING', location, 'files');
  }
  if (trace.status !== 'Missing' || trace.evidence.length !== 0) {
    fail('FRONTEND_REQUIREMENT_PREMATURE_EVIDENCE', location, trace.status);
  }
}

const excluded = fullRequirements.filter(({ disposition }) => disposition === 'NotRequired');
if (excluded.map(({ source }) => source?.row).join(',') !== '62,66,67'
  || excluded.some(({ source, inScope, status }) => source?.sheet !== '3-集团' || inScope !== false || status !== 'Designed')) {
  fail('REQUIREMENT_NOT_REQUIRED_INVALID', names.requirements, excluded.map(({ id }) => id).join(','));
}
if (fullRequirements.some(({ disposition, inScope }) => disposition === 'InScope' && inScope !== true)) {
  fail('REQUIREMENT_SCOPE_INVALID', names.requirements, 'InScope requirement is not enabled');
}

const mvpRequirements = mvp?.requirements ?? [];
const expectedMvpIds = Array.from({ length: 21 }, (_, index) => 'MVP' + String(index + 3).padStart(2, '0'));
if (mvp?.source !== authority.logicalSource + '#MVP上线功能清单!A3:F23') fail('MVP_SOURCE_INVALID', names.mvp, String(mvp?.source));
if (mvp?.count !== authority.sheets.mvp || mvpRequirements.length !== authority.sheets.mvp) {
  fail('MVP_COUNT_INVALID', names.mvp, mvp?.count + '/' + mvpRequirements.length);
}
if (mvpRequirements.map(({ id }) => id).join(',') !== expectedMvpIds.join(',')) fail('MVP_IDS_INVALID', names.mvp, mvpRequirements.map(({ id }) => id).join(','));
checkHash(mvp, names.mvp);
for (const requirement of mvpRequirements) {
  const location = names.mvp + ':' + requirement.id;
  if (requirement.row !== Number(requirement.id.slice(3))) fail('MVP_ROW_INVALID', location, String(requirement.row));
  for (const field of ['label', 'route', 'contractTest', 'journeyTest', 'dashboard', 'runbook', 'releaseEvidence', 'status']) {
    if (typeof requirement[field] !== 'string' || !requirement[field]) fail('MVP_FIELD_MISSING', location, field);
  }
  for (const field of ['operations', 'modules', 'tables', 'moduleSources', 'unitTests']) {
    if (!Array.isArray(requirement[field]) || requirement[field].length === 0) fail('MVP_FIELD_MISSING', location, field);
  }
  if (!Array.isArray(requirement.evidence)) fail('MVP_FIELD_MISSING', location, 'evidence');
  if (statusRank.get(requirement.status) > statusRank.get('Designed') && requirement.evidence.length === 0) {
    fail('MVP_STATUS_WITHOUT_EVIDENCE', location, requirement.status);
  }
  for (const operation of requirement.operations ?? []) if (!operationById.has(operation)) fail('MVP_OPERATION_MISSING', location, operation);
  const evidencePaths = [...(requirement.moduleSources ?? []), ...(requirement.unitTests ?? []), requirement.contractTest, requirement.journeyTest, requirement.dashboard, requirement.runbook];
  for (const path of evidencePaths) if (typeof path !== 'string' || !existsSync(join(root, path))) fail('MVP_EVIDENCE_MISSING', location, String(path));
  const releaseExists = existsSync(join(root, requirement.releaseEvidence ?? ''));
  if (requirement.status === 'Released' && !releaseExists) fail('MVP_RELEASE_EVIDENCE_MISSING', location, requirement.releaseEvidence);
  if (requirement.status !== 'Released' && releaseExists) fail('MVP_PREMATURE_RELEASE_EVIDENCE', location, requirement.releaseEvidence);
}

const providers = providerDocument?.providers ?? [];
const expectedProviderIds = ['jdproduct', 'jdfresh', 'tmallmarket', 'private', 'cake', 'flower', 'book', 'directcharge', 'foodvoucher', 'movie', 'meal',
  'taobaonow', 'elephantmarket', 'meituan', 'privatehome', 'jdhome', 'laundry', 'errand', 'carservice', 'show'];
if (providerDocument?.source !== authority.logicalSource + '#接口!A2:D21') fail('PROVIDER_SOURCE_INVALID', names.providers, String(providerDocument?.source));
if (providerDocument?.count !== authority.sheets.providers || providers.length !== authority.sheets.providers) {
  fail('PROVIDER_COUNT_INVALID', names.providers, providerDocument?.count + '/' + providers.length);
}
if (providers.map(({ id }) => id).join(',') !== expectedProviderIds.join(',')) fail('PROVIDER_IDS_INVALID', names.providers, providers.map(({ id }) => id).join(','));
if (JSON.stringify(providerDocument?.priorities) !== JSON.stringify({ 1: 11, 3: 5, 4: 4 })) fail('PROVIDER_PRIORITIES_INVALID', names.providers, JSON.stringify(providerDocument?.priorities));
checkHash(providerDocument, names.providers);
for (const provider of providers) {
  const location = names.providers + ':' + provider.id;
  const required = provider.priority === 1;
  if (provider.requirement !== 'INTEG' + String(provider.row - 1).padStart(3, '0')) fail('PROVIDER_REQUIREMENT_INVALID', location, provider.requirement);
  if (required && (provider.delivery !== 'required' || provider.available !== true || provider.status !== 'Designed')) fail('PROVIDER_P1_STATE_INVALID', location, provider.status);
  if (!required && (provider.delivery !== 'deferred-contract' || provider.available !== false || provider.status !== 'Designed')) fail('PROVIDER_DEFERRED_STATE_INVALID', location, provider.status);
  if (!Array.isArray(provider.evidence) || provider.evidence.length !== 0) fail('PROVIDER_EVIDENCE_INVALID', location, JSON.stringify(provider.evidence));
  if (required && (!provider.extension || !existsSync(join(root, provider.extension, 'manifest.ts')))) fail('PROVIDER_EXTENSION_MISSING', location, String(provider.extension));
  if (!required && (provider.extension !== null || existsSync(join(root, 'extensions/providers', provider.id)))) fail('PROVIDER_EMPTY_EXTENSION_FORBIDDEN', location, String(provider.extension));
  if (!contractType.includes('"' + provider.id + '"')) fail('PROVIDER_CONTRACT_TYPE_MISSING', location, provider.id);
}

const sensitiveProjection = JSON.stringify({
  interfaceRequirements: fullRequirements.filter(({ id }) => id.startsWith('INTEG')),
  providers: providerDocument,
});
for (const pattern of [/https?:\/\//i, /@王敏/i, /clientid/i, /鉴权token/i, /采购账号/i, /对接渠道\/公司/i]) {
  if (pattern.test(sensitiveProjection)) fail('REQUIREMENT_SENSITIVE_SOURCE_COPIED', names.providers, String(pattern));
}
if (!contractType.includes(workbookHash)) fail('REQUIREMENT_CONTRACT_HASH_INVALID', names.contract, workbookHash);

report('requirements', violations);

function checkHash(document, location) {
  if (document?.workbookSha256 !== workbookHash) fail('REQUIREMENT_WORKBOOK_HASH_INVALID', location, String(document?.workbookSha256));
}
