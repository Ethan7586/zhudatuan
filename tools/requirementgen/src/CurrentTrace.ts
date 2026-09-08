import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse, stringify } from 'yaml';
import { JOB_CATALOG } from '../../../services/commerce/src/pipeline/JobCatalog';

import { deriveDeliveryStatus, type DeliveryStatus } from './DeliveryStatus';
import { primaryOperation } from './CurrentMatcher';
import { loadCurrentFunctionSource, type CurrentDisposition, type CurrentFunctionRow, type FusionProfile } from './CurrentSource';
import { loadJourneySource } from './JourneySource';
import { loadRouteTraces, type RouteTrace } from './RouteTrace';

interface Operation {
  readonly id: string;
  readonly title: string;
  readonly owner: string;
  readonly method: string;
  readonly handler: string;
}

interface Event {
  readonly id: string;
  readonly owner: string;
  readonly serializer: string;
  readonly schemaRegistry: string;
}

interface DataObject {
  readonly id: string;
  readonly kind: string;
  readonly source: string;
}

export interface CurrentFunctionTrace {
  readonly id: string;
  readonly source: Readonly<{ line: number; section: string; heading: string; status: string; qualifier: string | null; text: string }>;
  readonly disposition: CurrentDisposition;
  readonly deliveryStatus: DeliveryStatus;
  readonly modules: readonly string[];
  readonly primaryOperation: string;
  readonly primaryHandler: string;
  readonly operations: readonly string[];
  readonly handlers: readonly string[];
  readonly ports: readonly string[];
  readonly routes: readonly Readonly<Pick<RouteTrace, 'id' | 'surface' | 'path' | 'source' | 'manifest' | 'viewmodel' | 'test'>>[];
  readonly dataObjects: readonly Readonly<{ id: string; kind: string; source: string }> [];
  readonly events: readonly Readonly<{ id: string; serializer: string; schemaRegistry: string }> [];
  readonly jobs: readonly Readonly<{ id: string; worker: string; runbook: string }> [];
  readonly journeys: readonly Readonly<{ id: string; test: string }> [];
  readonly runbooks: readonly string[];
  readonly extensions: readonly string[];
  readonly evidence: readonly string[];
}

export async function generateCurrentFunctionTrace(root: string): Promise<
  Readonly<{ content: string; source: Readonly<{ path: string; sha256: string; commit: string }>; records: readonly CurrentFunctionTrace[] }>
> {
  const [{ config, source }, routeTraces, journeySource, operationSource, eventSource, objectSource, telemetrySource] = await Promise.all([
    loadCurrentFunctionSource(root),
    loadRouteTraces(root),
    loadJourneySource(root),
    readFile(resolve(root, 'packages/contract/definitions/operations.yml'), 'utf8'),
    readFile(resolve(root, 'packages/contract/definitions/events.yml'), 'utf8'),
    readFile(resolve(root, 'database/contracts/objects.yml'), 'utf8'),
    readFile(resolve(root, 'config/telemetry.yml'), 'utf8'),
  ]);
  const operations = (parse(operationSource, { merge: true }).operations ?? []) as readonly Operation[];
  const events = (parse(eventSource).events ?? []) as readonly Event[];
  const objects = (parse(objectSource).objects ?? []) as readonly DataObject[];
  const alerts = Object.values((parse(telemetrySource).alerts ?? {}) as Record<string, { owner?: string; runbook?: string }>);
  const routeById = new Map(routeTraces.map((route) => [route.id, route] as const));
  const journeyById = new Map(journeySource.journeys.map((journey) => [journey.id, journey] as const));
  const operationById = new Map(operations.map((operation) => [operation.id, operation] as const));
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const records = await Promise.all(
    source.rows.map(async (row) => {
      const profile = config.overrides[row.id] ?? config.sections[row.section];
      if (!profile) throw new Error('CURRENT_FUNCTION_PROFILE_MISSING:' + row.id);
      const selectedOperations = operations.filter((operation) => profile.operationRoots.some((root) => operation.id === root || operation.id.startsWith(root + '.')));
      const configuredPrimary = config.primaryOperations[row.id];
      const primary = configuredPrimary ? required(selectedOperations.find(({ id }) => id === configuredPrimary), 'CURRENT_FUNCTION_PRIMARY_OUTSIDE_PROFILE:' + row.id) : primaryOperation(row, selectedOperations);
      const routes = profile.routes.map((id) => required(routeById.get(id), 'CURRENT_FUNCTION_ROUTE_UNKNOWN:' + row.id + ':' + id));
      const jobs = selectedJobs(profile).map((job) => ({ id: job.id, worker: job.worker, runbook: job.runbook }));
      const journeys = profile.journeys.map((id) => {
        const journey = required(journeyById.get(id), 'CURRENT_FUNCTION_JOURNEY_UNKNOWN:' + row.id + ':' + id);
        return { id, test: `tests/e2e/${journey.suite}.spec.ts` };
      });
      const dataObjects = selectDataObjects(primary, profile, objects);
      const selectedEvents = selectEvents(primary, profile, events);
      const runbooks = unique([
        ...jobs.map(({ runbook }) => runbook),
        ...alerts.filter(({ owner, runbook }) => owner && profile.modules.includes(owner) && runbook).map(({ runbook }) => runbook!),
        ...(jobs.length === 0 && alerts.every(({ owner, runbook }) => !owner || !profile.modules.includes(owner) || !runbook) ? ['docs/operations/deployment.md'] : []),
      ]);
      const extensions = row.qualifier ? [`extensions/channel/${required(config.providerAliases[row.qualifier], 'CURRENT_FUNCTION_PROVIDER_UNKNOWN:' + row.id)}/Manifest.ts`] : [];
      const handlers = unique(selectedOperations.map(({ handler }) => handler));
      const ports = profile.modules.map((module) => `services/commerce/src/modules/${module}/public/index.ts`);
      const evidence = unique([
        ...handlers,
        ...ports,
        ...routes.flatMap(({ source: route, manifest, viewmodel, test }) => [route, manifest, viewmodel, test]),
        ...dataObjects.map(({ source: path }) => path),
        ...selectedEvents.flatMap(({ serializer, schemaRegistry }) => [serializer, schemaRegistry]),
        ...jobs.flatMap(({ worker, runbook }) => [worker, runbook]),
        ...journeys.map(({ test }) => test),
        ...runbooks,
        ...extensions,
      ]);
      const delivery = await deriveDeliveryStatus(root, row.id, evidence);
      return Object.freeze({
        id: row.id,
        source: Object.freeze({ line: row.line, section: row.section, heading: row.heading, status: row.sourceStatus, qualifier: row.qualifier, text: row.text }),
        disposition: config.dispositions[row.sourceStatus],
        deliveryStatus: delivery.status,
        modules: Object.freeze([...profile.modules]),
        primaryOperation: primary.id,
        primaryHandler: primary.handler,
        operations: Object.freeze(selectedOperations.map(({ id }) => id)),
        handlers: Object.freeze(handlers),
        ports: Object.freeze(ports),
        routes: Object.freeze(routes.map(({ id, surface, path, source: route, manifest, viewmodel, test }) => Object.freeze({ id, surface, path, source: route, manifest, viewmodel, test }))),
        dataObjects: Object.freeze(dataObjects.map((item) => Object.freeze(item))),
        events: Object.freeze(selectedEvents.map(({ id, serializer, schemaRegistry }) => Object.freeze({ id, serializer, schemaRegistry }))),
        jobs: Object.freeze(jobs.map((item) => Object.freeze(item))),
        journeys: Object.freeze(journeys.map((item) => Object.freeze(item))),
        runbooks: Object.freeze(runbooks),
        extensions: Object.freeze(extensions),
        evidence: delivery.evidence,
      });
    })
  );
  validateRecords(source.rows, records, operationById, eventById);
  const document = {
    schema: 'zhudatuan.current-function-trace.v1',
    generated: true,
    source: source.source,
    sourceSnapshot: config.source.snapshot,
    count: records.length,
    chain: ['LIFunction', 'Disposition', 'Route', 'Operation', 'Handler', 'Module', 'DataObjectOrPort', 'EventOrJob', 'Journey', 'Runbook', 'Evidence'],
    sourceStatusCounts: source.statusCounts,
    dispositionCounts: counts(records, ({ disposition }) => disposition),
    deliveryStatusCounts: counts(records, ({ deliveryStatus }) => deliveryStatus),
    providerExtensions: Object.values(config.providerAliases).sort(),
    records,
  };
  return Object.freeze({ content: stringify(document, { lineWidth: 0 }), source: source.source, records: Object.freeze(records) });
}

function selectedJobs(profile: FusionProfile) {
  if (profile.jobs === 'all') return [...JOB_CATALOG];
  return (profile.jobs ?? []).map((id) => required(JOB_CATALOG.find((job) => job.id === id), 'CURRENT_FUNCTION_JOB_UNKNOWN:' + id));
}

function selectDataObjects(operation: Operation, profile: FusionProfile, objects: readonly DataObject[]): readonly DataObject[] {
  const prefixes = new Set(profile.modules.flatMap((module) => (module === 'order' ? ['ordering'] : module === 'finance' ? ['finance', 'invoice'] : [module])));
  const candidates = objects.filter(({ id, kind }) => kind === 'table' && prefixes.has(id.split('.')[0]!));
  const terms = operation.id.split('.').slice(1).map(singular);
  const matched = candidates.filter(({ id }) => terms.some((term) => term.length > 3 && id.includes(term))).slice(0, 3);
  return Object.freeze(matched.length > 0 ? matched : candidates.slice(0, Math.min(3, candidates.length)));
}

function selectEvents(operation: Operation, profile: FusionProfile, events: readonly Event[]): readonly Event[] {
  const candidates = events.filter(({ owner }) => profile.modules.includes(owner));
  const terms = operation.id.split('.').slice(1).map(singular);
  const matched = candidates.filter(({ id }) => terms.some((term) => term.length > 3 && id.includes(term))).slice(0, 3);
  return Object.freeze(matched.length > 0 ? matched : candidates.slice(0, Math.min(2, candidates.length)));
}

function validateRecords(rows: readonly CurrentFunctionRow[], records: readonly CurrentFunctionTrace[], operations: ReadonlyMap<string, Operation>, events: ReadonlyMap<string, Event>): void {
  if (records.length !== 462 || records.length !== rows.length || new Set(records.map(({ id }) => id)).size !== records.length) throw new Error('CURRENT_FUNCTION_TRACE_COUNT_INVALID');
  for (const [index, record] of records.entries()) {
    if (record.id !== rows[index]!.id || record.operations.length === 0 || record.routes.length === 0 || record.handlers.length === 0 || record.ports.length === 0 || record.journeys.length === 0 || record.runbooks.length === 0 || record.evidence.length === 0) {
      throw new Error('CURRENT_FUNCTION_TRACE_INCOMPLETE:' + record.id);
    }
    const primary = operations.get(record.primaryOperation);
    if (!primary || primary.handler !== record.primaryHandler || !record.operations.includes(record.primaryOperation)) throw new Error('CURRENT_FUNCTION_PRIMARY_OPERATION_INVALID:' + record.id);
    for (const id of record.events.map(({ id }) => id)) if (!events.has(id)) throw new Error('CURRENT_FUNCTION_EVENT_UNKNOWN:' + record.id + ':' + id);
    if (record.deliveryStatus === 'Designed') throw new Error('CURRENT_FUNCTION_DESIGNED_ONLY:' + record.id);
  }
}

function counts<T extends string>(records: readonly CurrentFunctionTrace[], select: (record: CurrentFunctionTrace) => T): Record<T, number> {
  const result = {} as Record<T, number>;
  for (const record of records) {
    const key = select(record);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

function required<T>(value: T | undefined, code: string): T {
  if (value === undefined) throw new Error(code);
  return value;
}

function singular(value: string): string {
  return value.endsWith('ies') ? value.slice(0, -3) + 'y' : value.endsWith('s') ? value.slice(0, -1) : value;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}
