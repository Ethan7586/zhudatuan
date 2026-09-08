import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { parse, stringify } from 'yaml';
import { JOB_CATALOG } from '../../../services/commerce/src/pipeline/JobCatalog';

import { loadRequirementAuthority } from './Authority';
import { currentCatalog, type FunctionalRequirement, type RequirementCoverage } from './CurrentCatalog';
import { generateCurrentFunctionTrace } from './CurrentTrace';
import { deriveDeliveryStatus } from './DeliveryStatus';
import { executionTraces, type FrontendExecutionTrace } from './FrontendTrace';
import { loadJourneySource, type JourneyDefinition } from './JourneySource';
import { loadRequirementSource } from './RequirementSource';
import { operationForBinding, priorityFrom, stepupFor, type OperationDefinition } from './RequirementTrace';
import { loadRouteTraces } from './RouteTrace';
import { sharedStrings, worksheet } from './WorkbookReader';

const root = resolve(import.meta.dirname, '../../..');
const { authority, bytes: workbookBytes } = await loadRequirementAuthority(root);
const requirementSource = await loadRequirementSource(root);
const journeySource = await loadJourneySource(root);
const routeTraces = await loadRouteTraces(root);
const currentFunctionTrace = await generateCurrentFunctionTrace(root);
const workbookHash = authority.sha256;
const archive = unzipSync(workbookBytes);
const shared = sharedStrings(xml('xl/sharedStrings.xml'));
const operationDocument = parse(await readFile(resolve(root, 'packages/contract/definitions/operations.yml'), 'utf8'), { merge: true }) as {
  readonly operations: readonly OperationDefinition[];
};
const eventDocument = parse(await readFile(resolve(root, 'packages/contract/definitions/events.yml'), 'utf8'), { merge: true }) as {
  readonly events: readonly EventDefinition[];
};
const operationById = new Map(operationDocument.operations.map((operation) => [operation.id, operation] as const));
const navigationDocument = parse(await readFile(resolve(root, 'config/navigation.yml'), 'utf8')) as {
  readonly routes: readonly NavigationRouteDefinition[];
  readonly nodes: readonly NavigationDefinition[];
};
const navigationEvidence = JSON.parse(await readFile(resolve(root, 'evidence/navigation/catalog.json'), 'utf8')) as { readonly hash: string };
const contractHash = sha256(await Promise.all(['operations.yml', 'events.yml', 'errors.yml', 'capabilities.yml'].map((name) => readFile(resolve(root, 'packages/contract/definitions', name)))));
const journeyCatalogHash = sha256([journeySource.bytes]);
const moduleIds = [...new Set(operationDocument.operations.map(({ owner }) => owner))].sort();
const clientIds = [...new Set(routeTraces.map(({ surface }) => surface))].sort();
const coverage: RequirementCoverage = Object.freeze({
  modules: Object.freeze({ count: moduleIds.length, ids: Object.freeze(moduleIds) }),
  clients: Object.freeze({ count: clientIds.length, ids: Object.freeze(clientIds) }),
  richVoucherOperations: operationDocument.operations.filter(({ owner }) => owner === 'voucher').length,
  approvalOperations: operationDocument.operations.filter(({ owner }) => owner === 'approval').length,
  runtimeImportOperations: operationDocument.operations.filter(({ id, owner }) => owner === 'runtime' && id.startsWith('runtime.imports.')).length,
  journeys: journeySource.journeys.length,
});
if (coverage.modules.count !== 33 || coverage.clients.count !== 6 || coverage.richVoucherOperations !== 57 || coverage.approvalOperations !== 10 || coverage.runtimeImportOperations !== 4 || coverage.journeys !== 44)
  throw new Error('REQUIREMENT_COVERAGE_INVALID:' + JSON.stringify(coverage));

const requirements: FunctionalRequirement[] = [];
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
    const requirementId = sheet.prefix + String(ordinal + 1).padStart(3, '0');
    const binding = requirementSource.bindings[requirementId]!;
    const module = binding.module;
    const operation = operationForBinding(operationDocument.operations, requirementId, binding);
    const excluded = sheet.prefix === 'GROUP' && [62, 66, 67].includes(row) && third === '不需要';
    const uiRoute = binding.route;
    const journeyTest = binding.journey;
    const frontend = executionTraces({ route: uiRoute, operation: operation.id, test: journeyTest }, routeTraces);
    const tests = ['services/commerce/src/test/architecture/ModuleCatalog.test.ts', 'services/commerce/src/test/architecture/DomainPolicy.test.ts', 'tests/integration/registry.spec.ts', journeyTest];
    const jobs = JOB_CATALOG.filter(({ owner }) => owner === module)
      .map(({ id }) => id)
      .sort();
    const delivery = await deriveDeliveryStatus(root, requirementId, [operation.handler, ...tests, ...frontend.flatMap(({ evidence }) => evidence)]);
    requirements.push({
      id: requirementId,
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
      mainFlow: ['client route', operation.id, module + ' application', binding.table],
      stateTransitions: operation.method === 'GET' ? ['none-query-only'] : ['validated', 'committed', 'outbox-recorded'],
      exceptionFlow: ['validation rejected', 'authorization denied', 'conflict or retry', 'dependency failure surfaced'],
      permission: operation.permission ?? null,
      stepup: stepupFor(text),
      audit: operation.method === 'GET' ? 'sensitive reads and denials' : 'before and after state with actor and scope',
      module,
      capability: operation.id,
      handler: operation.handler,
      api: operation.method + ' ' + operation.path,
      commandOrQuery: operation.method === 'GET' ? 'query' : 'command',
      tableOrProjection: binding.table,
      clients: [...new Set(frontend.map(({ client }) => client))],
      features: [...new Set(frontend.map(({ feature }) => feature))],
      uiRoutes: frontend.map(({ routeid }) => routeid),
      routePaths: [...new Set(frontend.map(({ route }) => route))],
      tests,
      jobs,
      performance: operation.method === 'GET' ? 'p95<=300ms; bounded cursor page' : 'p95<=500ms; idempotent retry',
      externalDependencies: module === 'channel' || module === 'extension' ? ['signed provider contract'] : [],
      owner: module,
      status: delivery.status,
      disposition: excluded ? 'NotRequired' : 'InScope',
      inScope: !excluded,
      evidence: delivery.evidence,
      frontend,
    });
  }
}
if (requirements.length !== authority.sheets.requirements) throw new Error('REQUIREMENT_COUNT_INVALID:' + requirements.length);

const mvpCells = sheetCells('MVP上线功能清单');
const mvpRequirements = await Promise.all(
  requirementSource.mvp.map(async (definition) => {
    const { id } = definition;
    const { row } = definition.source;
    const sourceValues = ['A', 'B', 'C', 'D', 'E', 'F'].map((column) => mvpCells.get(column + row) ?? '');
    const label = sourceValues[1] || sourceValues[0] || definition.title;
    const operations = operationDocument.operations.filter((operation) => operation.requirements.includes(id));
    const directOperations = [...new Set(definition.directOperations)].sort();
    const transitiveOperations = [...new Set([...definition.transitiveOperations, ...operations.map(({ id: operation }) => operation).filter((operation) => !directOperations.includes(operation))])].sort();
    const modules = [...new Set([...definition.modules, ...operations.map(({ owner }) => owner)])].sort();
    const navigation = navigationDocument.nodes.filter((node) => {
      const operation = operationById.get(node.entry);
      if (operation === undefined) throw new Error('NAVIGATION_OPERATION_UNKNOWN:' + node.id + ':' + node.entry);
      return operation.requirements.includes(id);
    });
    const routes = navigationDocument.routes.filter((route) => route.requirements.includes(id));
    const journeys = journeySource.journeys.filter(({ requirements }) => requirements.includes(id));
    const unitTests = ['services/commerce/src/test/architecture/ModuleCatalog.test.ts', 'services/commerce/src/test/architecture/DomainPolicy.test.ts'];
    const contractTest = id === 'MVPPROVIDER' ? 'tests/contract/providers.spec.ts' : 'tests/integration/registry.spec.ts';
    const journeyTest = definition.journeys[0]!;
    const journeyTests = [...new Set(journeys.map(({ suite }) => `tests/e2e/${suite}.spec.ts`))].sort();
    const moduleSources = modules.map((owner) => 'services/commerce/src/modules/' + owner).sort();
    const operationIds = [...new Set([...directOperations, ...transitiveOperations])].sort();
    const handlers = operationIds.map((operation) => operationById.get(operation)?.handler).filter((handler): handler is string => handler !== undefined);
    const routeEvidence = routeTraces.filter(({ requirements }) => requirements.includes(id)).flatMap(({ source, manifest, viewmodel, test }) => [source, manifest, viewmodel, test]);
    const jobs = JOB_CATALOG.filter(({ owner }) => modules.includes(owner))
      .map(({ id: job }) => job)
      .sort();
    const runbook = 'docs/operations/' + definition.runbook + '.md';
    const releaseEvidence = 'evidence/releases/' + id + '.json';
    const delivery = await deriveDeliveryStatus(root, id, [...handlers, ...moduleSources, ...unitTests, contractTest, journeyTest, ...journeyTests, ...routeEvidence, runbook], releaseEvidence);
    return {
      id,
      row,
      title: definition.title,
      requirementSource: definition.source,
      label,
      release: definition.release,
      providers: definition.providers,
      navigation: navigation.map(({ id: navigationId }) => navigationId),
      routeids: routes.map(({ id: routeid }) => routeid).sort(),
      routes: routes.map(({ path }) => path).sort(),
      directOperations,
      transitiveOperations,
      operations: operationIds,
      modules,
      tables: definition.tables,
      journeys: journeys.map(({ id: journey }) => journey),
      journeyTests,
      events: [...new Set(eventDocument.events.filter(({ owner }) => modules.includes(owner)).map(({ id: event }) => event))].sort(),
      jobs,
      moduleSources,
      unitTests,
      contractTest,
      journeyTest,
      dashboard: 'docs/metrics/catalog.md',
      runbook,
      releaseEvidence,
      status: delivery.status,
      evidence: delivery.evidence,
    };
  })
);
if (mvpRequirements.length !== authority.sheets.mvp) throw new Error('MVP_REQUIREMENT_COUNT_INVALID');

const providerCells = sheetCells('接口');
const providers = await Promise.all(
  requirementSource.providers.map(async (provider, index) => {
    const row = provider.row;
    const priority = providerPriority(providerCells.get('D' + row));
    const extension = priority === 1 ? 'extensions/channel/' + provider.id : null;
    const delivery =
      extension === null ? Object.freeze({ status: 'Designed' as const, evidence: Object.freeze([] as string[]) }) : await deriveDeliveryStatus(root, provider.id, [`${extension}/Manifest.ts`, 'tests/contract/providers.spec.ts']);
    return {
      requirement: 'INTEG' + String(index + 1).padStart(3, '0'),
      row,
      id: provider.id,
      label: providerCells.get('B' + row) ?? '',
      priority,
      delivery: priority === 1 ? 'required' : 'deferred-contract',
      available: priority === 1,
      status: delivery.status,
      evidence: delivery.evidence,
      extension,
      core: priority === 1 ? requiredCore(provider.core, provider.id) : null,
    };
  })
);

const frontendRequirements = requirements.flatMap((requirement) => {
  const frontends = requirement.frontend as readonly FrontendExecutionTrace[];
  return frontends.map((frontend) => ({
    requirement: requirement.id,
    disposition: requirement.disposition,
    routeid: frontend.routeid,
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
  }));
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
        journeyCatalogSha256: journeyCatalogHash,
        parserVersion: authority.parserVersion,
        generatorVersion: authority.generatorVersion,
        generatedAt: authority.generatedAt,
        generated: true,
        coverage,
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
        journeyCatalogSha256: journeyCatalogHash,
        generated: true,
        count: requirements.length,
        frontendCount: frontendRequirements.length,
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
        journeyCatalogSha256: journeyCatalogHash,
        generated: true,
        releasePolicy: 'blocking',
        statusPolicy: 'derived-from-code-and-signed-release-evidence',
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
        journeyCatalogSha256: journeyCatalogHash,
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
        journeyCatalogSha256: journeyCatalogHash,
        generated: true,
        count: frontendRequirements.length,
        chain: ['Requirement', 'Client', 'Route', 'Feature', 'Operation', 'Test', 'Evidence'],
        requirements: frontendRequirements,
      },
      { lineWidth: 0 }
    ),
  ],
  [
    resolve(root, 'docs/requirements/currenttrace.yml'),
    currentFunctionTrace.content,
  ],
  [
    resolve(root, 'docs/requirements/trace.yml'),
    stringify(
      {
        source: authority.logicalSource,
        workbookSha256: workbookHash,
        navigationCatalogSha256: navigationEvidence.hash,
        contractSha256: contractHash,
        journeyCatalogSha256: journeyCatalogHash,
        generated: true,
        chain: ['WorkbookCell', 'Requirement', 'Journey', 'Route', 'Operation', 'Schema', 'Permission', 'Capability', 'Scope', 'Handler', 'Owner', 'Table', 'Event', 'Job', 'Test', 'Runbook', 'SignedEvidence'],
        requirements: mvpRequirements.map((record) => traceRecord(record)),
      },
      { lineWidth: 0 }
    ),
  ],
  [
    resolve(root, 'docs/当前代码业务功能清单-20260904.md'),
    currentCatalog(
      { path: authority.repositoryRelativePath, sheet: authority.sheet, range: authority.selectionRange, sha256: workbookHash, readAt: authority.reviewedAt },
      coverage,
      requirements,
      mvpRequirements,
      {
        ...currentFunctionTrace.source,
        records: currentFunctionTrace.records,
      }
    ),
  ],
  [
    resolve(root, 'packages/contract/src/RequirementCatalog.ts'),
    contractType(
      requirements.map(({ id }) => String(id)),
      mvpRequirements.map(({ id }) => id),
      providers
    ),
  ],
  [resolve(root, 'tests/journey/IdealJourneyCatalog.ts'), journeyCatalogSource(journeySource.journeys)],
]);
for (const [path, content] of outputs) {
  if (process.argv.includes('--check')) {
    const current = await readFile(path, 'utf8').catch(() => '');
    if (current !== content) throw new Error('GENERATED_REQUIREMENTS_DRIFT:' + path);
  } else {
    await writeFile(path, content, 'utf8');
  }
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
  readonly entry: string;
}

interface EventDefinition {
  readonly id: string;
  readonly owner: string;
  readonly schema: string;
  readonly serializer: string;
  readonly schemaRegistry: string;
  readonly handlers: readonly string[];
}

interface NavigationRouteDefinition {
  readonly id: string;
  readonly path: string;
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

function traceRecord(record: (typeof mvpRequirements)[number]): Record<string, unknown> {
  const operations = record.operations.map((id) => operationById.get(id)).filter((operation): operation is OperationDefinition => operation !== undefined);
  const events = record.events.map((id) => eventDocument.events.find((event) => event.id === id)).filter((event): event is EventDefinition => event !== undefined);
  return {
    workbookCell: authority.sheet + '!A' + record.row + ':F' + record.row,
    requirement: record.id,
    journeys: record.journeys,
    navigation: record.navigation,
    routeids: record.routeids,
    routes: record.routes,
    directOperations: record.directOperations,
    transitiveOperations: record.transitiveOperations,
    operations: record.operations,
    schemas: [...new Set(operations.flatMap(({ requestSchema, responseSchema }) => [requestSchema, responseSchema]))].sort(),
    permissions: [...new Set(operations.map(({ permission }) => permission).filter((permission): permission is string => permission !== null))].sort(),
    capabilities: [...new Set(operations.map(({ capability }) => capability))].sort(),
    scopes: [...new Set(operations.flatMap(({ scopeKinds }) => scopeKinds))].sort(),
    handlers: [...new Set(operations.map(({ handler }) => handler))].sort(),
    owners: [...new Set(operations.map(({ owner }) => owner))].sort(),
    modules: record.modules,
    tables: record.tables,
    events: record.events,
    eventSchemas: events.map(({ schema }) => schema).sort(),
    jobs: record.jobs,
    tests: [...new Set([...record.unitTests, record.contractTest, record.journeyTest, ...record.journeyTests])].sort(),
    runbook: record.runbook,
    signedEvidence: record.releaseEvidence,
  };
}

function journeyCatalogSource(journeys: readonly JourneyDefinition[]): string {
  const records = journeys.map(({ id, title, requirements, suite, scenario, assertions }) => ({
    id,
    title,
    requirements,
    suite,
    scenario,
    assertions,
    test: `tests/e2e/${suite}.spec.ts`,
    status: 'required',
  }));
  return `// Generated from config/journeys.yml. Do not edit.\nexport const IDEAL_JOURNEYS = Object.freeze(${JSON.stringify(records, null, 2)} as const);\nexport type IdealJourney = (typeof IDEAL_JOURNEYS)[number];\nexport type IdealJourneyId = IdealJourney['id'];\n`;
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
