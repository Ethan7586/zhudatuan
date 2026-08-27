import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { parse, stringify } from 'yaml';

import { loadRequirementAuthority } from './Authority';
import { executionTrace } from './FrontendTrace';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import { loadOrderRequirementProfile, orderRequirementYaml, type OrderRequirementProfile } from './OrderRequirementProfile';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { loadOrderRequirementProfile, orderRequirementYaml, type OrderRequirementProfile } from './OrderRequirementProfile';
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
import { MVP_JOURNEYS, MVP_LABELS, MVP_ROUTES, MVP_RUNBOOKS, PROVIDERS, SHEETS, type ProviderDefinition } from './RequirementSource';
import { journeyFor, moduleFor, operationFor, priorityFrom, routeFor, stepupFor, TABLE_BY_MODULE, type OperationDefinition } from './RequirementTrace';
import { sharedStrings, worksheet } from './WorkbookReader';

const root = resolve(import.meta.dirname, '../../..');
const { authority, bytes: workbookBytes } = await loadRequirementAuthority(root);
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
const orderProfile = await loadOrderRequirementProfile(root);
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
const orderProfile = await loadOrderRequirementProfile(root);
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
const workbookHash = authority.sha256;
const archive = unzipSync(workbookBytes);
const shared = sharedStrings(xml('xl/sharedStrings.xml'));
const operationDocument = parse(await readFile(resolve(root, 'packages/contract/definitions/operations.yml'), 'utf8')) as {
  readonly operations: readonly OperationDefinition[];
};

const requirements: Record<string, unknown>[] = [];
for (const sheet of SHEETS) {
  const cells = sheetCells(sheet.name);
  let section = sheet.label;
  for (let ordinal = 0; ordinal < sheet.rows.length; ordinal += 1) {
    const row = sheet.rows[ordinal]!;
    const values = ['A', 'B', 'C', 'D'].map((column) => cells.get(column + row) ?? '');
    const first = values[0]!;
    const second = values[1]!;
    const third = values[2]!;
    const fourth = values[3]!;
    if (first) section = first;
    const provider = sheet.prefix === 'INTEG' ? PROVIDERS[ordinal] : undefined;
    const title = provider?.label ?? (first || second || third || fourth || sheet.label + '第' + row + '行');
    const description = sheet.prefix === 'INTEG' ? title : [second, third, fourth]
      .filter((value, index, items) => value && value !== title && items.indexOf(value) === index).join('；') || title;
    const text = section + ' ' + title + ' ' + description;
    const module = moduleFor(sheet.prefix, text);
    const operation = operationFor(operationDocument.operations, module, text);
    const excluded = sheet.prefix === 'GROUP' && [62, 66, 67].includes(row) && third === '不需要';
    const uiRoute = routeFor(sheet.prefix, module);
    const journeyTest = journeyFor(sheet.prefix, module);
    const frontend = executionTrace({ prefix: sheet.prefix, module, route: uiRoute, operation: operation.id, test: journeyTest });
    requirements.push({
      id: sheet.prefix + String(ordinal + 1).padStart(3, '0'),
      version: 1,
      source: { sheet: sheet.name, row, columns: sheet.prefix === 'INTEG' ? ['A', 'B', 'D'] : ['A', 'B', 'C', 'D'] },
      section,
      title,
      description,
      priority: provider?.priority ?? priorityFrom(text),
      role: sheet.role,
      level: sheet.level,
      scope: sheet.scope,
      prerequisites: ['authenticated session', 'active membership', 'granted capability', 'authorized scope'],
      inputs: operation.method === 'GET' ? ['scope', 'cursor', 'filters'] : ['scope', 'idempotency key', 'command'],
      mainFlow: ['client route', operation.id, module + ' application', TABLE_BY_MODULE[module]],
      stateTransitions: operation.method === 'GET' ? ['none-query-only'] : ['validated', 'committed', 'outbox-recorded'],
      exceptionFlow: ['validation rejected', 'authorization denied', 'conflict or retry', 'dependency failure surfaced'],
      permission: operation.permission ?? null,
      stepup: stepupFor(text),
      audit: operation.method === 'GET' ? 'sensitive reads and denials' : 'before and after state with actor and scope',
      module,
      capability: operation.id,
      api: operation.method + ' ' + operation.path,
      commandOrQuery: operation.method === 'GET' ? 'query' : 'command',
      tableOrProjection: TABLE_BY_MODULE[module],
      client: frontend.client,
      feature: frontend.feature,
      uiRoute,
      tests: ['services/commerce/src/modules/ModuleCatalog.test.ts', 'services/commerce/src/modules/DomainPolicy.test.ts',
        'tests/integration/registry.spec.ts', journeyTest],
      performance: operation.method === 'GET' ? 'p95<=300ms; bounded cursor page' : 'p95<=500ms; idempotent retry',
      externalDependencies: module === 'channel' || module === 'extension' ? ['signed provider contract'] : [],
      owner: module,
      status: 'Designed',
      disposition: excluded ? 'NotRequired' : 'InScope',
      inScope: !excluded,
      evidence: [],
      frontend,
    });
  }
}
if (requirements.length !== authority.sheets.requirements) throw new Error('REQUIREMENT_COUNT_INVALID:' + requirements.length);

const mvpCells = sheetCells('MVP上线功能清单');
const mvpTables: readonly (readonly string[])[] = Object.freeze([
  ['organization.organization', 'catalog.poolbinding', 'voucher.cardpool'], ['channel.distributor', 'channel.tenantbinding', 'catalog.poolbinding'],
  ['reporting.metric', 'reporting.fact', 'reporting.orderprojection'], ['experience.application', 'experience.version', 'experience.release', 'experience.publication'],
  ['catalog.pool', 'catalog.product', 'catalog.listing', 'pricing.rule'], ['ordering.orderrecord', 'ordering.aftersale', 'fulfillment.fulfillmentorder', 'payment.refund'],
  ['voucher.program', 'voucher.reserverequest', 'voucher.voucher', 'voucher.redemption'], ['finance.journal', 'finance.entry', 'finance.statement', 'invoice.request'],
  ['reporting.metric', 'reporting.fact', 'reporting.export'], ['support.case', 'support.message', 'support.assignment', 'support.sla'],
  ['access.role', 'member.membership', 'partner.partner', 'notification.template', 'risk.policy'], ['reporting.metric', 'reporting.fact', 'reporting.orderprojection'],
  ['experience.application', 'experience.version', 'experience.release', 'experience.publication'], ['catalog.product', 'catalog.listing', 'pricing.rule'],
  ['ordering.orderrecord', 'ordering.aftersale', 'fulfillment.fulfillmentorder', 'payment.refund'], ['voucher.voucher', 'voucher.redemption', 'voucher.reversal'],
  ['finance.account', 'finance.statement', 'invoice.request'], ['reporting.metric', 'reporting.fact', 'reporting.export'],
  ['support.case', 'support.message', 'support.assignment', 'support.sla'], ['access.role', 'member.membership', 'partner.relationship', 'notification.template', 'risk.policy'],
  ['channel.connection', 'channel.syncrun', 'channel.provideroperation', 'extension.installation'],
]);
const mvpRequirements = MVP_LABELS.map((label, index) => {
  const row = index + 3;
  const id = 'MVP' + String(row).padStart(2, '0');
  const operations = operationDocument.operations.filter((operation) => operation.requirements.includes(id));
  return {
    id,
    row,
    label,
    source: ['A', 'B', 'C', 'D', 'E', 'F'].map((column) => mvpCells.get(column + row) ?? ''),
    route: MVP_ROUTES[index],
    operations: operations.map(({ id: operation }) => operation),
    modules: [...new Set(operations.map(({ owner }) => owner))].sort(),
    tables: mvpTables[index],
    moduleSources: [...new Set(operations.map(({ owner }) => 'services/commerce/src/modules/' + owner))].sort(),
    unitTests: ['services/commerce/src/modules/ModuleCatalog.test.ts', 'services/commerce/src/modules/DomainPolicy.test.ts'],
    contractTest: row === 23 ? 'tests/contracts/providers.spec.ts' : 'tests/integration/registry.spec.ts',
    journeyTest: 'tests/journeys/mvp' + String(row).padStart(2, '0') + '_' + MVP_JOURNEYS[index] + '.spec.ts',
    dashboard: 'docs/metrics/catalog.md',
    runbook: 'docs/operations/' + MVP_RUNBOOKS[index] + '.md',
    releaseEvidence: 'evidence/releases/' + id + '.json',
    status: 'Designed',
    evidence: [],
  };
});
if (mvpRequirements.length !== authority.sheets.mvp) throw new Error('MVP_REQUIREMENT_COUNT_INVALID');

const providers = PROVIDERS.map((provider, index) => ({
  requirement: 'INTEG' + String(index + 1).padStart(3, '0'),
  row: index + 2,
  id: provider.id,
  label: provider.label,
  priority: provider.priority,
  delivery: provider.priority === 1 ? 'required' : 'deferred-contract',
  available: provider.priority === 1,
  status: 'Designed',
  evidence: [],
  extension: provider.priority === 1 ? 'extensions/providers/' + provider.id : null,
  vendor: provider.vendor ?? null,
}));

const frontendRequirements = requirements.map((requirement) => {
  const frontend = requirement.frontend as ReturnType<typeof executionTrace>;
  return {
    requirement: requirement.id,
    disposition: requirement.disposition,
    client: frontend.client,
    route: frontend.route,
    feature: frontend.feature,
    operation: frontend.operation,
    test: frontend.test,
    files: frontend.files,
    callers: frontend.callers,
    callees: frontend.callees,
    status: frontend.status,
    evidence: frontend.evidence,
  };
});

const outputs = new Map<string, string>([
  [resolve(root, 'docs/requirements/mapping.json'), JSON.stringify({
    source: authority.logicalSource,
    workbookSha256: workbookHash,
    generated: true,
    count: requirements.length,
    requirements,
  }, null, 2) + '\n'],
  [resolve(root, 'docs/requirements/requirements.yml'), stringify({
    source: authority.logicalSource,
    workbookSha256: workbookHash,
    generated: true,
    count: authority.sheets.requirements,
    sheetCounts: Object.fromEntries(SHEETS.map((sheet) => [sheet.prefix, sheet.rows.length])),
    requirements,
  }, { lineWidth: 0 })],
  [resolve(root, 'docs/requirements/mvp.yml'), stringify({
    source: authority.logicalSource + '#MVP上线功能清单!A3:F23',
    workbookSha256: workbookHash,
    generated: true,
    count: authority.sheets.mvp,
    requirements: mvpRequirements,
  }, { lineWidth: 0 })],
  [resolve(root, 'docs/requirements/providers.yml'), stringify({
    source: authority.logicalSource + '#接口!A2:D21',
    workbookSha256: workbookHash,
    generated: true,
    count: authority.sheets.providers,
    priorities: { 1: 11, 3: 5, 4: 4 },
    providers,
  }, { lineWidth: 0 })],
  [resolve(root, 'docs/requirements/frontend.yml'), stringify({
    source: authority.logicalSource,
    workbookSha256: workbookHash,
    generated: true,
    count: authority.sheets.requirements,
    chain: ['Requirement', 'Client', 'Route', 'Feature', 'Operation', 'Test', 'Evidence'],
    requirements: frontendRequirements,
  }, { lineWidth: 0 })],
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  [resolve(root, 'docs/requirements/order.yml'), orderRequirementYaml(orderProfile)],
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  [resolve(root, 'docs/requirements/order.yml'), orderRequirementYaml(orderProfile)],
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  [resolve(root, 'packages/contract/src/RequirementCatalog.generated.ts'), contractType(
    requirements.map(({ id }) => String(id)),
    mvpRequirements.map(({ id }) => id),
    PROVIDERS,
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    orderProfile,
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    orderProfile,
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  )],
]);
for (const [path, content] of outputs) {
  if (process.argv.includes('--check')) {
    const current = await readFile(path, 'utf8').catch(() => '');
    if (current !== content) throw new Error('GENERATED_REQUIREMENTS_DRIFT:' + path);
  } else {
    await writeFile(path, content, 'utf8');
  }
}

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
function contractType(
  requirementIds: readonly string[],
  mvpIds: readonly string[],
  providerRecords: readonly ProviderDefinition[],
  orderRequirements: Readonly<OrderRequirementProfile>,
): string {
<<<<<<< HEAD
=======
function contractType(requirementIds: readonly string[], mvpIds: readonly string[], providerRecords: readonly ProviderDefinition[]): string {
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
=======
function contractType(requirementIds: readonly string[], mvpIds: readonly string[], providerRecords: readonly ProviderDefinition[]): string {
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  const catalog = providerRecords.map((provider) => ({
    id: provider.id,
    label: provider.label,
    priority: provider.priority,
    delivery: provider.priority === 1 ? 'required' : 'deferred-contract',
    ...(provider.vendor === undefined ? {} : { vendor: provider.vendor }),
  }));
  return [
    '// Generated by @shop/requirementgen. Do not edit.',
    "export const REQUIREMENT_WORKBOOK_SHA256 = '" + workbookHash + "' as const;",
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
    "export const ORDER_REQUIREMENT_WORKBOOK_SHA256 = '" + orderRequirements.workbookSha256 + "' as const;",
    'export const REQUIREMENT_AUTHORITY_HASHES = Object.freeze(' + JSON.stringify({ requirements: workbookHash, orderRequirements: orderRequirements.workbookSha256 }) + ' as const);',
    'export const BASE_REQUIREMENT_IDS = ' + JSON.stringify(requirementIds) + ' as const;',
    'export const OMS_REQUIREMENT_IDS = ' + JSON.stringify(orderRequirements.requirements.map(({ id }) => id)) + ' as const;',
    'export type OmsRequirementId = typeof OMS_REQUIREMENT_IDS[number];',
    'export const OMS_REQUIREMENT_RECORDS = Object.freeze(' + JSON.stringify(orderRequirements.requirements.map(({ id, title, wave, priority, owner, lifecycleStatus, futureWorkPackages }) => ({ id, title, wave, priority, owner, lifecycleStatus, futureWorkPackages }))) + ' as const);',
    'export const REQUIREMENT_IDS = [...BASE_REQUIREMENT_IDS, ...OMS_REQUIREMENT_IDS] as const;',
<<<<<<< HEAD
=======
    'export const REQUIREMENT_IDS = ' + JSON.stringify(requirementIds) + ' as const;',
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
=======
    'export const REQUIREMENT_IDS = ' + JSON.stringify(requirementIds) + ' as const;',
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    'export type RequirementId = typeof REQUIREMENT_IDS[number];',
    'export const MVP_REQUIREMENT_IDS = ' + JSON.stringify(mvpIds) + ' as const;',
    'export type MvpRequirementId = typeof MVP_REQUIREMENT_IDS[number];',
    'export const PROVIDER_CATALOG_RECORDS = Object.freeze(' + JSON.stringify(catalog) + ' as const);',
    'export const PROVIDER_REQUIREMENT_IDS = Object.freeze(PROVIDER_CATALOG_RECORDS.map(({ id }) => id));',
    'export type ProviderRequirementId = typeof PROVIDER_REQUIREMENT_IDS[number];',
    '',
  ].join('\n');
}

function xml(path: string): string {
  const bytes = archive[path];
  if (!bytes) throw new Error('XLSX_ENTRY_MISSING:' + path);
  return strFromU8(bytes);
}

function sheetCells(name: string): Map<string, string> {
  return worksheet(xml(findSheet(name)), shared);
}

function findSheet(name: string): string {
  const workbookXml = xml('xl/workbook.xml');
  const relationship = new RegExp('<sheet[^>]*name="' + escapePattern(name) + '"[^>]*r:id="([^"]+)"').exec(workbookXml)?.[1];
  if (!relationship) throw new Error('XLSX_SHEET_MISSING:' + name);
  const target = new RegExp('<Relationship[^>]*Id="' + escapePattern(relationship) + '"[^>]*Target="([^"]+)"')
    .exec(xml('xl/_rels/workbook.xml.rels'))?.[1];
  if (!target) throw new Error('XLSX_SHEET_RELATION_MISSING:' + name);
  return target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
}

function escapePattern(value: string): string {
  return value.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
}
