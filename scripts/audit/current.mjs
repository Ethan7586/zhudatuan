#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';

import { JOB_CATALOG } from '../../services/commerce/src/pipeline/JobCatalog.ts';
import { generateCurrentFunctionTrace } from '../../tools/requirementgen/src/CurrentTrace.ts';
import { CURRENT_SOURCE_STATUSES, loadCurrentFunctionSource } from '../../tools/requirementgen/src/CurrentSource.ts';
import { DELIVERY_STATUSES } from '../../tools/requirementgen/src/DeliveryStatus.ts';
import { report } from './report.mjs';

const root = resolve(import.meta.dirname, '../..');
const { config, source } = await loadCurrentFunctionSource(root);
const expected = await generateCurrentFunctionTrace(root);
const tracePath = resolve(root, config.source.trace);
const traceText = readFileSync(tracePath, 'utf8');
const trace = parse(traceText);
const operations = parse(readFileSync(resolve(root, 'packages/contract/definitions/operations.yml'), 'utf8'), { merge: true }).operations ?? [];
const navigation = parse(readFileSync(resolve(root, 'config/navigation.yml'), 'utf8'));
const objects = parse(readFileSync(resolve(root, 'database/contracts/objects.yml'), 'utf8')).objects ?? [];
const events = parse(readFileSync(resolve(root, 'packages/contract/definitions/events.yml'), 'utf8')).events ?? [];
const operationById = index(operations, 'id');
const routeById = index(navigation.routes ?? [], 'id');
const objectById = index(objects, 'id');
const eventById = index(events, 'id');
const jobById = index(JOB_CATALOG, 'id');
const rowsById = index(source.rows, 'id');
const violations = [];
const fail = (code, location, detail = '') => violations.push({ code, location, detail: String(detail) });

checkHeader();
checkRecords();
checkOutcomeSets();

report('current function reconciliation', violations, {
  source: source.count,
  traced: trace.records?.length ?? 0,
  replaced: trace.dispositionCounts?.Replaced ?? 0,
  richVoucher: trace.records?.filter(({ source: item }) => String(item.section).startsWith('18.')).length ?? 0,
  providers: trace.providerExtensions?.length ?? 0,
});

function checkHeader() {
  if (trace.schema !== 'zhudatuan.current-function-trace.v1' || trace.generated !== true) fail('CURRENT_TRACE_SCHEMA_INVALID', config.source.trace);
  if (traceText !== expected.content) fail('CURRENT_TRACE_GENERATION_DRIFT', config.source.trace);
  if (trace.source?.path !== config.source.path || trace.source?.sha256 !== config.source.sha256 || trace.source?.commit !== config.source.commit) fail('CURRENT_TRACE_AUTHORITY_INVALID', config.source.trace);
  if (trace.sourceSnapshot !== config.source.snapshot || trace.count !== source.count || trace.records?.length !== source.count) fail('CURRENT_TRACE_COUNT_INVALID', config.source.trace);
  const chain = ['LIFunction', 'Disposition', 'Route', 'Operation', 'Handler', 'Module', 'DataObjectOrPort', 'EventOrJob', 'Journey', 'Runbook', 'Evidence'];
  if (JSON.stringify(trace.chain) !== JSON.stringify(chain)) fail('CURRENT_TRACE_CHAIN_INVALID', config.source.trace);
  for (const status of CURRENT_SOURCE_STATUSES) if (trace.sourceStatusCounts?.[status] !== config.statusCounts[status]) fail('CURRENT_TRACE_SOURCE_STATUS_COUNT_INVALID', config.source.trace, status);
}

function checkRecords() {
  const seen = new Set();
  for (const record of trace.records ?? []) {
    const location = `${config.source.trace}:${record.id}`;
    const row = rowsById.get(record.id);
    if (!row || seen.has(record.id)) {
      fail(row ? 'CURRENT_TRACE_DUPLICATE' : 'CURRENT_TRACE_SOURCE_UNKNOWN', location);
      continue;
    }
    seen.add(record.id);
    if (record.source.line !== row.line || record.source.section !== row.section || record.source.heading !== row.heading || record.source.status !== row.sourceStatus || record.source.qualifier !== row.qualifier || record.source.text !== row.text) fail('CURRENT_TRACE_SOURCE_DRIFT', location);
    if (record.disposition !== config.dispositions[row.sourceStatus]) fail('CURRENT_TRACE_DISPOSITION_INVALID', location, record.disposition);
    if (!DELIVERY_STATUSES.includes(record.deliveryStatus) || record.deliveryStatus === 'Designed') fail('CURRENT_TRACE_DELIVERY_STATUS_INVALID', location, record.deliveryStatus);
    if (CURRENT_SOURCE_STATUSES.includes(record.deliveryStatus)) fail('CURRENT_TRACE_LEGACY_RELEASE_STATUS', location, record.deliveryStatus);
    if (!Array.isArray(record.modules) || record.modules.length === 0 || !Array.isArray(record.operations) || record.operations.length === 0 || !Array.isArray(record.routes) || record.routes.length === 0) fail('CURRENT_TRACE_TARGET_EMPTY', location);

    for (const id of record.operations ?? []) {
      const operation = operationById.get(id);
      if (!operation || !record.modules.includes(operation.owner) || operation.handler !== record.handlers.find((handler) => handler === operation.handler) || !exists(operation.handler)) fail('CURRENT_TRACE_OPERATION_INVALID', location, id);
    }
    const primary = operationById.get(record.primaryOperation);
    if (!primary || primary.handler !== record.primaryHandler || !record.operations.includes(record.primaryOperation)) fail('CURRENT_TRACE_PRIMARY_INVALID', location, record.primaryOperation);
    for (const route of record.routes ?? []) {
      const authority = routeById.get(route.id);
      if (!authority || authority.surface !== route.surface || authority.path !== route.path || ![route.source, route.manifest, route.viewmodel, route.test].every(exists)) fail('CURRENT_TRACE_ROUTE_INVALID', location, route.id);
    }
    for (const port of record.ports ?? []) if (!exists(port) || !record.modules.some((module) => port === `services/commerce/src/modules/${module}/public/index.ts`)) fail('CURRENT_TRACE_PORT_INVALID', location, port);
    if ((record.dataObjects?.length ?? 0) + (record.ports?.length ?? 0) === 0) fail('CURRENT_TRACE_DATA_OR_PORT_MISSING', location);
    for (const item of record.dataObjects ?? []) {
      const authority = objectById.get(item.id);
      if (!authority || authority.kind !== item.kind || authority.source !== item.source || !exists(item.source)) fail('CURRENT_TRACE_DATA_INVALID', location, item.id);
    }
    for (const item of record.events ?? []) {
      const authority = eventById.get(item.id);
      if (!authority || authority.serializer !== item.serializer || authority.schemaRegistry !== item.schemaRegistry || !exists(item.serializer) || !exists(item.schemaRegistry)) fail('CURRENT_TRACE_EVENT_INVALID', location, item.id);
    }
    for (const item of record.jobs ?? []) {
      const authority = jobById.get(item.id);
      if (!authority || authority.worker !== item.worker || authority.runbook !== item.runbook || !exists(item.worker) || !exists(item.runbook)) fail('CURRENT_TRACE_JOB_INVALID', location, item.id);
    }
    for (const item of record.journeys ?? []) if (!/^J(?:0[1-9]|[1-3][0-9]|4[0-4])$/.test(item.id) || !exists(item.test)) fail('CURRENT_TRACE_JOURNEY_INVALID', location, item.id);
    for (const runbook of record.runbooks ?? []) if (!exists(runbook)) fail('CURRENT_TRACE_RUNBOOK_INVALID', location, runbook);
    for (const extension of record.extensions ?? []) if (!exists(extension)) fail('CURRENT_TRACE_EXTENSION_INVALID', location, extension);
    for (const evidence of record.evidence ?? []) if (!exists(evidence)) fail('CURRENT_TRACE_EVIDENCE_INVALID', location, evidence);
  }
  if (seen.size !== source.count) fail('CURRENT_TRACE_COVERAGE_INVALID', config.source.trace, seen.size);
}

function checkOutcomeSets() {
  const records = trace.records ?? [];
  const placeholders = records.filter(({ source: item }) => item.status === '占位');
  const designed = records.filter(({ source: item }) => item.status === '仅设计');
  const providers = records.filter(({ source: item }) => item.section === '11.2');
  if (placeholders.length !== 29 || placeholders.some(({ disposition }) => disposition !== 'Replaced')) fail('CURRENT_PLACEHOLDER_NOT_REPLACED', config.source.trace);
  if (designed.length !== 29 || designed.some(({ disposition, modules }) => disposition !== 'Implemented' || !modules.includes('voucher'))) fail('CURRENT_RICH_VOUCHER_NOT_IMPLEMENTED', config.source.trace);
  const richOperations = new Set(designed.flatMap(({ operations }) => operations).filter((id) => operationById.get(id)?.owner === 'voucher'));
  if (richOperations.size !== 57) fail('CURRENT_RICH_VOUCHER_OPERATION_COVERAGE_INVALID', config.source.trace, richOperations.size);
  if (providers.length !== 11 || new Set(providers.flatMap(({ extensions }) => extensions)).size !== 11 || providers.some(({ extensions }) => extensions.length !== 1)) fail('CURRENT_PROVIDER_EXTENSION_COVERAGE_INVALID', config.source.trace);
  if (Object.keys(config.overrides).length !== 20 || !placeholders.filter(({ source: item }) => item.section === '19').every(({ id }) => config.overrides[id])) fail('CURRENT_VISIBLE_ENTRY_OVERRIDE_INVALID', 'config/fusion.yml');
}

function exists(path) {
  return typeof path === 'string' && existsSync(join(root, path));
}

function index(values, key) {
  return new Map(values.map((value) => [value[key], value]));
}
