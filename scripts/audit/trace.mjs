#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';

import { loadRequirementAuthority } from '../../tools/requirementgen/src/Authority.ts';
import { loadJourneySource } from '../../tools/requirementgen/src/JourneySource.ts';
import { isRequirementReleaseEvidence } from '../../tools/requirementgen/src/ReleaseEvidence.ts';
import { JOB_CATALOG } from '../../services/commerce/src/pipeline/JobCatalog.ts';
import { report } from './report.mjs';

const root = resolve(import.meta.dirname, '../..');
const readYaml = (path) => parse(readFileSync(join(root, path), 'utf8'), { merge: true });
const trace = readYaml('docs/requirements/trace.yml');
const mvp = readYaml('docs/requirements/mvp.yml');
const operations = readYaml('packages/contract/definitions/operations.yml').operations ?? [];
const events = readYaml('packages/contract/definitions/events.yml').events ?? [];
const permissions = readYaml('packages/contract/definitions/permissions.yml').permissions ?? [];
const capabilities = readYaml('packages/contract/definitions/capabilities.yml').capabilities ?? [];
const navigation = readYaml('config/navigation.yml');
const objects = readYaml('database/contracts/objects.yml').objects ?? [];
const openapi = JSON.parse(readFileSync(join(root, 'packages/contract/openapi.json'), 'utf8'));
const { authority } = await loadRequirementAuthority(root);
const journeySource = await loadJourneySource(root);
const journeyHash = createHash('sha256').update(journeySource.bytes).digest('hex');

const violations = [];
const fail = (code, location, detail = '') => violations.push({ code, location, detail: String(detail) });
const operationById = index(operations, 'id', 'OPERATION');
const eventById = index(events, 'id', 'EVENT');
const permissionById = index(permissions, 'code', 'PERMISSION');
const capabilityById = index(capabilities, 'code', 'CAPABILITY');
const routeById = index(navigation.routes ?? [], 'id', 'ROUTE');
const nodeById = index(navigation.nodes ?? [], 'id', 'NAVIGATION');
const objectById = index(objects, 'id', 'DATABASE_OBJECT');
const mvpById = index(mvp.requirements ?? [], 'id', 'MVP');
const journeyById = index(journeySource.journeys, 'id', 'JOURNEY');
const jobById = index(JOB_CATALOG, 'id', 'JOB');

checkAuthority();
checkJourneys();
checkRequirements();

report('trace authority', violations, {
  workbook: authority.sheets.mvp,
  requirements: mvp.requirements?.length ?? 0,
  journeys: journeySource.journeys.length,
  operations: operations.length,
  events: events.length,
});

function checkAuthority() {
  const expectedChain = ['WorkbookCell', 'Requirement', 'Journey', 'Route', 'Operation', 'Schema', 'Permission', 'Capability', 'Scope', 'Handler', 'Owner', 'Table', 'Event', 'Job', 'Test', 'Runbook', 'SignedEvidence'];
  if (trace.workbookSha256 !== authority.sha256 || mvp.workbookSha256 !== authority.sha256) fail('TRACE_WORKBOOK_HASH_DRIFT', 'docs/requirements');
  if (trace.journeyCatalogSha256 !== journeyHash || mvp.journeyCatalogSha256 !== journeyHash) fail('TRACE_JOURNEY_HASH_DRIFT', 'docs/requirements');
  if (JSON.stringify(trace.chain) !== JSON.stringify(expectedChain)) fail('TRACE_CHAIN_INVALID', 'docs/requirements/trace.yml');
  if (trace.requirements?.length !== authority.sheets.mvp || mvp.requirements?.length !== authority.sheets.mvp) fail('TRACE_REQUIREMENT_COUNT_INVALID', 'docs/requirements');
}

function checkJourneys() {
  const expectedIds = Array.from({ length: 44 }, (_, index) => `J${String(index + 1).padStart(2, '0')}`);
  if (JSON.stringify(journeySource.journeys.map(({ id }) => id)) !== JSON.stringify(expectedIds)) fail('JOURNEY_SEQUENCE_INVALID', 'config/journeys.yml');
  const covered = new Set();
  for (const journey of journeySource.journeys) {
    const location = `config/journeys.yml:${journey.id}`;
    const target = `tests/e2e/${journey.suite}.spec.ts`;
    for (const requirement of journey.requirements) {
      covered.add(requirement);
      if (!mvpById.has(requirement)) fail('JOURNEY_REQUIREMENT_UNKNOWN', location, requirement);
    }
    if (!existsSync(join(root, target))) {
      fail('JOURNEY_TEST_MISSING', location, target);
      continue;
    }
    const source = readFileSync(join(root, target), 'utf8');
    if (!source.includes(`'${journey.scenario}'`) && !source.includes(`"${journey.scenario}"`)) fail('JOURNEY_SCENARIO_MISSING', target, journey.scenario);
    for (const assertion of journey.assertions) if (!source.includes(assertion)) fail('JOURNEY_ASSERTION_EVIDENCE_MISSING', target, `${journey.id}:${assertion}`);
  }
  if (JSON.stringify([...covered].sort()) !== JSON.stringify([...mvpById.keys()].sort())) fail('JOURNEY_MVP_COVERAGE_INVALID', 'config/journeys.yml');
}

function checkRequirements() {
  for (const record of trace.requirements ?? []) {
    const location = `docs/requirements/trace.yml:${record.requirement}`;
    const source = mvpById.get(record.requirement);
    if (!source) {
      fail('TRACE_MVP_UNKNOWN', location);
      continue;
    }
    if (record.workbookCell !== `${authority.sheet}!A${source.row}:F${source.row}`) fail('TRACE_WORKBOOK_CELL_INVALID', location, record.workbookCell);
    exact(
      record.journeys,
      journeySource.journeys.filter(({ requirements }) => requirements.includes(record.requirement)).map(({ id }) => id),
      'TRACE_JOURNEYS_INVALID',
      location
    );
    for (const journey of record.journeys ?? []) if (!journeyById.has(journey)) fail('TRACE_JOURNEY_UNKNOWN', location, journey);
    exact(record.navigation, source.navigation, 'TRACE_NAVIGATION_INVALID', location);
    exact(record.routeids, source.routeids, 'TRACE_ROUTE_IDS_INVALID', location);
    exact(record.routes, source.routes, 'TRACE_ROUTES_INVALID', location);
    for (const id of record.navigation ?? []) if (!nodeById.has(id)) fail('TRACE_NAVIGATION_UNKNOWN', location, id);
    for (const id of record.routeids ?? []) if (!routeById.has(id)) fail('TRACE_ROUTE_UNKNOWN', location, id);
    for (const path of record.routes ?? []) if (![...(navigation.routes ?? [])].some((route) => route.path === path)) fail('TRACE_ROUTE_PATH_UNKNOWN', location, path);

    const resolvedOperations = [];
    for (const id of record.operations ?? []) {
      const operation = operationById.get(id);
      if (!operation) {
        fail('TRACE_OPERATION_UNKNOWN', location, id);
        continue;
      }
      resolvedOperations.push(operation);
      if (!operation.requirements?.includes(record.requirement)) fail('TRACE_OPERATION_REQUIREMENT_INVALID', location, id);
      if (!existsSync(join(root, operation.handler))) fail('TRACE_HANDLER_MISSING', location, operation.handler);
      if (!capabilityById.has(operation.capability)) fail('TRACE_CAPABILITY_UNKNOWN', location, operation.capability);
      if (operation.permission !== null && !permissionById.has(operation.permission)) fail('TRACE_PERMISSION_UNKNOWN', location, operation.permission);
      if (!openapi.components?.schemas?.[operation.requestSchema] || !openapi.components?.schemas?.[operation.responseSchema]) fail('TRACE_SCHEMA_UNKNOWN', location, id);
    }
    exact(record.schemas, unique(resolvedOperations.flatMap(({ requestSchema, responseSchema }) => [requestSchema, responseSchema])), 'TRACE_SCHEMAS_INVALID', location);
    exact(record.permissions, unique(resolvedOperations.map(({ permission }) => permission).filter(Boolean)), 'TRACE_PERMISSIONS_INVALID', location);
    exact(record.capabilities, unique(resolvedOperations.map(({ capability }) => capability)), 'TRACE_CAPABILITIES_INVALID', location);
    exact(record.scopes, unique(resolvedOperations.flatMap(({ scopeKinds }) => scopeKinds)), 'TRACE_SCOPES_INVALID', location);
    exact(record.handlers, unique(resolvedOperations.map(({ handler }) => handler)), 'TRACE_HANDLERS_INVALID', location);
    exact(record.owners, unique(resolvedOperations.map(({ owner }) => owner)), 'TRACE_OWNERS_INVALID', location);
    exact(record.modules, source.modules, 'TRACE_MODULES_INVALID', location);

    for (const table of record.tables ?? []) if (!objectById.has(table)) fail('TRACE_TABLE_UNKNOWN', location, table);
    const resolvedEvents = [];
    for (const id of record.events ?? []) {
      const event = eventById.get(id);
      if (!event) {
        fail('TRACE_EVENT_UNKNOWN', location, id);
        continue;
      }
      resolvedEvents.push(event);
      if (!record.modules?.includes(event.owner)) fail('TRACE_EVENT_OWNER_INVALID', location, id);
      if (!existsSync(join(root, event.serializer)) || !existsSync(join(root, event.schemaRegistry))) fail('TRACE_EVENT_RUNTIME_MISSING', location, id);
    }
    exact(record.events, source.events, 'TRACE_EVENTS_INVALID', location);
    exact(
      record.eventSchemas,
      resolvedEvents.map(({ schema }) => schema),
      'TRACE_EVENT_SCHEMAS_INVALID',
      location
    );
    exact(record.jobs, source.jobs, 'TRACE_JOBS_INVALID', location);
    for (const id of record.jobs ?? []) {
      const job = jobById.get(id);
      if (!job || !record.modules?.includes(job.owner) || !existsSync(join(root, job.worker)) || !existsSync(join(root, job.runbook))) fail('TRACE_JOB_INVALID', location, id);
    }
    for (const test of record.tests ?? []) if (!existsSync(join(root, test))) fail('TRACE_TEST_MISSING', location, test);
    if (!existsSync(join(root, record.runbook))) fail('TRACE_RUNBOOK_MISSING', location, record.runbook);
    checkEvidence(record, source, location);
  }
}

function checkEvidence(record, source, location) {
  if (record.signedEvidence !== source.releaseEvidence) fail('TRACE_EVIDENCE_PATH_INVALID', location, record.signedEvidence);
  const absolute = join(root, record.signedEvidence);
  if (source.status !== 'Released') return;
  if (!existsSync(absolute)) return fail('TRACE_SIGNED_EVIDENCE_MISSING', location, record.signedEvidence);
  const evidence = JSON.parse(readFileSync(absolute, 'utf8'));
  if (!isRequirementReleaseEvidence(evidence, record.requirement)) fail('TRACE_SIGNED_EVIDENCE_INVALID', location, record.signedEvidence);
}

function index(values, key, code) {
  const result = new Map();
  for (const value of values) {
    if (result.has(value[key])) fail(`${code}_DUPLICATE`, value[key]);
    result.set(value[key], value);
  }
  return result;
}

function unique(values) {
  return [...new Set(values)].sort();
}

function exact(actual, expected, code, location) {
  if (JSON.stringify([...(actual ?? [])].sort()) !== JSON.stringify([...(expected ?? [])].sort())) fail(code, location);
}
