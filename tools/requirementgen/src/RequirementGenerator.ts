import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { parse, stringify } from 'yaml';

import { loadRequirementAuthority } from './Authority';
import { executionTrace } from './FrontendTrace';
import { loadRequirementSource } from './RequirementSource';
import { journeyFor, moduleFor, operationFor, priorityFrom, routeFor, stepupFor, TABLE_BY_MODULE, type OperationDefinition } from './RequirementTrace';
import { sharedStrings, worksheet } from './WorkbookReader';

const root = resolve(import.meta.dirname, '../../..');
const { authority, bytes: workbookBytes } = await loadRequirementAuthority(root);
const requirementSource = await loadRequirementSource(root);
const workbookHash = authority.sha256;
const archive = unzipSync(workbookBytes);
const shared = sharedStrings(xml('xl/sharedStrings.xml'));
const operationDocument = parse(await readFile(resolve(root, 'packages/contract/definitions/operations.yml'), 'utf8'), { merge: true }) as {
  readonly operations: readonly OperationDefinition[];
};
const navigationDocument = parse(await readFile(resolve(root, 'config/navigation.yml'), 'utf8')) as {
  readonly nodes: readonly NavigationDefinition[];
};
const navigationEvidence = JSON.parse(await readFile(resolve(root, 'evidence/navigation/catalog.json'), 'utf8')) as { readonly hash: string };
const contractHash = sha256(await Promise.all(['operations.yml', 'events.yml', 'errors.yml', 'capabilities.yml'].map((name) => readFile(resolve(root, 'packages/contract/definitions', name)))));

const requirements: Record<string, unknown>[] = [];
for (const sheet of requirementSource.sheets) {
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
    const providerSource = sheet.prefix === 'INTEG' ? requirementSource.providers[ordinal] : undefined;
    const provider =
      providerSource === undefined
        ? undefined
        : {
            id: providerSource.id,
            row: providerSource.row,
            label: second,
            priority: providerPriority(cells.get('D' + row)),
          };
    const title = provider?.label ?? (first || second || third || fourth || sheet.label + '第' + row + '行');
    const description = sheet.prefix === 'INTEG' ? title : [second, third, fourth].filter((value, index, items) => value && value !== title && items.indexOf(value) === index).join('；') || title;
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
      tests: ['services/commerce/src/modules/ModuleCatalog.test.ts', 'services/commerce/src/modules/DomainPolicy.test.ts', 'tests/integration/registry.spec.ts', journeyTest],
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
const mvpRequirements = requirementSource.mvp.map((definition) => {
  const { id } = definition;
  const { row } = definition.source;
  const sourceValues = ['A', 'B', 'C', 'D', 'E', 'F'].map((column) => mvpCells.get(column + row) ?? '');
  const label = sourceValues[1] || sourceValues[0] || definition.title;
  const operations = operationDocument.operations.filter((operation) => operation.requirements.includes(id));
  const navigation = navigationDocument.nodes.filter((node) => node.requirements.includes(id));
  const releaseBlockers = requirementSource.clarifications.filter(({ requirements, blocking }) => blocking && requirements.includes(id));
  return {
    id,
    row,
    title: definition.title,
    requirementSource: definition.source,
    label,
    source: sourceValues,
    release: definition.release,
    providers: definition.providers,
    clarifications: definition.clarifications,
    navigation: navigation.map(({ id: navigationId }) => navigationId),
    routes: navigation.map(({ route }) => route),
    operations: [...new Set([...definition.operations, ...operations.map(({ id: operation }) => operation)])].sort(),
    modules: [...new Set([...definition.modules, ...operations.map(({ owner }) => owner)])].sort(),
    tables: definition.tables,
    moduleSources: [...new Set(operations.map(({ owner }) => 'services/commerce/src/modules/' + owner))].sort(),
    unitTests: ['services/commerce/src/modules/ModuleCatalog.test.ts', 'services/commerce/src/modules/DomainPolicy.test.ts'],
    contractTest: id === 'MVPPROVIDER' ? 'tests/contract/providers.spec.ts' : 'tests/integration/registry.spec.ts',
    journeyTest: definition.journeys[0]!,
    dashboard: 'docs/metrics/catalog.md',
    runbook: 'docs/operations/' + definition.runbook + '.md',
    releaseEvidence: 'docs/evidence/releases/' + id + '.json',
    releaseBlockers,
    status: definition.status,
    evidence: [],
  };
});
if (mvpRequirements.length !== authority.sheets.mvp) throw new Error('MVP_REQUIREMENT_COUNT_INVALID');

const providerCells = sheetCells('接口');
const providers = requirementSource.providers.map((provider, index) => {
  const row = provider.row;
  const priority = providerPriority(providerCells.get('D' + row));
  return {
    requirement: 'INTEG' + String(index + 1).padStart(3, '0'),
    row,
    id: provider.id,
    label: providerCells.get('B' + row) ?? '',
    priority,
    delivery: priority === 1 ? 'required' : 'deferred-contract',
    available: priority === 1,
    status: 'Designed',
    evidence: [],
    extension: priority === 1 ? 'extensions/channel/' + provider.id : null,
    core: priority === 1 ? requiredCore(provider.core, provider.id) : null,
  };
});

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
  [
    resolve(root, 'docs/requirements/mapping.json'),
    JSON.stringify(
      {
        source: authority.logicalSource,
        workbookSha256: workbookHash,
        navigationCatalogSha256: navigationEvidence.hash,
        contractSha256: contractHash,
        parserVersion: authority.parserVersion,
        generatorVersion: authority.generatorVersion,
        generatedAt: authority.generatedAt,
        generated: true,
        count: requirements.length,
        requirements,
      },
      null,
      2
    ) + '\n',
  ],
  [
    resolve(root, 'docs/requirements/requirements.yml'),
    stringify(
      {
        source: authority.logicalSource,
        workbookSha256: workbookHash,
        navigationCatalogSha256: navigationEvidence.hash,
        contractSha256: contractHash,
        generated: true,
        count: authority.sheets.requirements,
        sheetCounts: Object.fromEntries(requirementSource.sheets.map((sheet) => [sheet.prefix, sheet.rows.length])),
        requirements,
      },
      { lineWidth: 0 }
    ),
  ],
  [
    resolve(root, 'docs/requirements/mvp.yml'),
    stringify(
      {
        source: authority.logicalSource + '#MVP上线功能清单!A3:F24',
        workbookSha256: workbookHash,
        navigationCatalogSha256: navigationEvidence.hash,
        contractSha256: contractHash,
        generated: true,
        count: authority.sheets.mvp,
        requirements: mvpRequirements,
      },
      { lineWidth: 0 }
    ),
  ],
  [
    resolve(root, 'docs/requirements/providers.yml'),
    stringify(
      {
        source: authority.logicalSource + '#接口!A2:D21',
        workbookSha256: workbookHash,
        navigationCatalogSha256: navigationEvidence.hash,
        contractSha256: contractHash,
        generated: true,
        count: authority.sheets.providers,
        priorities: { 1: 11, 3: 5, 4: 4 },
        providers,
      },
      { lineWidth: 0 }
    ),
  ],
  [
    resolve(root, 'docs/requirements/frontend.yml'),
    stringify(
      {
        source: authority.logicalSource,
        workbookSha256: workbookHash,
        navigationCatalogSha256: navigationEvidence.hash,
        contractSha256: contractHash,
        generated: true,
        count: authority.sheets.requirements,
        chain: ['Requirement', 'Client', 'Route', 'Feature', 'Operation', 'Test', 'Evidence'],
        requirements: frontendRequirements,
      },
      { lineWidth: 0 }
    ),
  ],
  [
    resolve(root, 'docs/requirements/trace.yml'),
    stringify(
      {
        source: authority.logicalSource,
        workbookSha256: workbookHash,
        navigationCatalogSha256: navigationEvidence.hash,
        contractSha256: contractHash,
        generated: true,
        chain: ['WorkbookCell', 'Requirement', 'Route', 'Operation', 'Schema', 'Permission', 'Capability', 'Scope', 'Handler', 'Owner', 'Table', 'Test', 'Runbook', 'SignedEvidence'],
        clarifications: requirementSource.clarifications,
        requirements: mvpRequirements.map((record) => ({
          workbookCell: authority.sheet + '!A' + record.row + ':F' + record.row,
          requirement: record.id,
          navigation: record.navigation,
          routes: record.routes,
          operations: record.operations,
          schemas: record.operations.map((operation) => 'packages/contract/definitions/operations.yml#' + operation),
          modules: record.modules,
          tables: record.tables,
          tests: [...record.unitTests, record.contractTest, record.journeyTest],
          runbook: record.runbook,
          signedEvidence: record.releaseEvidence,
          releaseBlockers: record.releaseBlockers,
        })),
      },
      { lineWidth: 0 }
    ),
  ],
  [resolve(root, 'config/providers.yml'), providerConfiguration(providers)],
  [
    resolve(root, 'packages/contract/src/RequirementCatalog.ts'),
    contractType(
      requirements.map(({ id }) => String(id)),
      mvpRequirements.map(({ id }) => id),
      providers
    ),
  ],
]);
for (const [path, content] of outputs) {
  if (process.argv.includes('--check')) {
    const current = await readFile(path, 'utf8').catch(() => '');
    if (current !== content) throw new Error('GENERATED_REQUIREMENTS_DRIFT:' + path);
  } else {
    await writeFile(path, content, 'utf8');
  }
}

function providerConfiguration(records: readonly ProviderRecord[]): string {
  const document = stringify(
    {
      generated: true,
      source: 'config/requirements.yml#providers',
      workbookSha256: workbookHash,
      providers: records.filter(({ priority }) => priority === 1).map(({ id, core }) => ({ id, package: '@shop/provider' + id, factory: id[0]!.toUpperCase() + id.slice(1) + 'Provider', core })),
    },
    { lineWidth: 0 }
  );
  return document.replaceAll(/^(\s+package:) "([^"]+)"$/gm, "$1 '$2'");
}

function contractType(requirementIds: readonly string[], mvpIds: readonly string[], providerRecords: readonly ProviderRecord[]): string {
  const catalog = providerRecords.map((provider) => ({
    id: provider.id,
    label: provider.label,
    priority: provider.priority,
    delivery: provider.priority === 1 ? 'required' : 'deferred-contract',
  }));
  return [
    '// Generated by @shop/requirementgen. Do not edit.',
    "export const REQUIREMENT_WORKBOOK_SHA256 = '" + workbookHash + "' as const;",
    "export const REQUIREMENT_NAVIGATION_SHA256 = '" + navigationEvidence.hash + "' as const;",
    "export const REQUIREMENT_CONTRACT_SHA256 = '" + contractHash + "' as const;",
    'export const REQUIREMENT_IDS = ' + JSON.stringify(requirementIds) + ' as const;',
    'export type RequirementId = typeof REQUIREMENT_IDS[number];',
    'export const MVP_REQUIREMENT_IDS = ' + JSON.stringify(mvpIds) + ' as const;',
    'export type MvpRequirementId = typeof MVP_REQUIREMENT_IDS[number];',
    'export const PROVIDER_CATALOG_RECORDS = Object.freeze(' + JSON.stringify(catalog) + ' as const);',
    'export const PROVIDER_REQUIREMENT_IDS = Object.freeze(PROVIDER_CATALOG_RECORDS.map(({ id }) => id));',
    'export type ProviderRequirementId = typeof PROVIDER_REQUIREMENT_IDS[number];',
    '',
  ].join('\n');
}

interface NavigationDefinition {
  readonly id: string;
  readonly route: string;
  readonly requirements: readonly string[];
}

interface ProviderRecord {
  readonly id: string;
  readonly row: number;
  readonly label: string;
  readonly priority: 1 | 3 | 4;
  readonly core: string | null;
}

function sha256(values: readonly Uint8Array[]): string {
  const hash = createHash('sha256');
  for (const value of values) hash.update(value);
  return hash.digest('hex');
}

function providerPriority(value: string | undefined): 1 | 3 | 4 {
  const parsed = Number(value);
  if (parsed !== 1 && parsed !== 3 && parsed !== 4) throw new Error('PROVIDER_PRIORITY_INVALID:' + String(value));
  return parsed;
}

function requiredCore(value: string | undefined, provider: string): string {
  if (!value) throw new Error('PROVIDER_CORE_MISSING:' + provider);
  return value;
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
  const target = new RegExp('<Relationship[^>]*Id="' + escapePattern(relationship) + '"[^>]*Target="([^"]+)"').exec(xml('xl/_rels/workbook.xml.rels'))?.[1];
  if (!target) throw new Error('XLSX_SHEET_RELATION_MISSING:' + name);
  return target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
}

function escapePattern(value: string): string {
  return value.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
}
