import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { OperationCatalog, type OperationId } from '@shop/contract';
import { PERMISSION_CATALOG } from '@shop/authz';
import { SDK_OPERATION_IDS } from '@shop/sdk';

export interface JourneyEvidence {
  readonly workstation: string;
  readonly operations: readonly OperationId[];
  readonly tables: readonly string[];
  readonly event?: string;
}

const root = process.cwd();
const commerceModuleFiles = files(join(root, '01_core_hexin/services/commerce/src/modules'), '.ts');
const migrationText = sourceTree('02_platform_pingtai/database/supabase/migrations', '.sql');
const objectContract = source('02_platform_pingtai/database/contracts/objects.yml');
const operationController = source('01_core_hexin/services/commerce/src/foundation/interface/OperationController.ts');
const moduleOperations = source('01_core_hexin/services/commerce/src/foundation/application/ModuleOperations.ts');
const eventDefinitions = source('01_core_hexin/packages/contract/definitions/events.yml');
const permissionCodes = new Set(PERMISSION_CATALOG.map(({ code }) => code));
const sdkOperations = new Set<OperationId>(SDK_OPERATION_IDS);

export function journey(requirement: `MVP${number}`, evidence: JourneyEvidence): void {
  test(`${requirement} ${evidence.workstation} main path reaches the named SDK and owner module`, () => {
    assert.ok(evidence.operations.length > 0);
    for (const id of evidence.operations) {
      const operation = OperationCatalog.get(id);
      assert.ok(sdkOperations.has(id), `${id} has no generated named SDK method`);
      assert.ok(operation.requirements.includes(requirement), `${id} does not trace to ${requirement}`);
      assert.match(source(ownerModulePath(operation.module)), new RegExp(operation.module, 'i'));
    }
  });

  test(`${requirement} forbidden path is protected by audience, permission and scope policy`, () => {
    const protectedOperations = evidence.operations.map((id) => OperationCatalog.get(id)).filter(({ audience }) => audience !== 'public' && audience !== 'provider');
    assert.ok(protectedOperations.length > 0);
    for (const operation of protectedOperations) {
      assert.ok(operation.permission && permissionCodes.has(operation.permission), `${operation.id} permission is not canonical`);
    }
    assert.match(operationController, /authorizer\.authorize/);
    assert.match(source('01_core_hexin/packages/authz/src/Policy.ts'), /SCOPE_DENIED/);
  });

  test(`${requirement} retry and concurrency path has one idempotency owner`, () => {
    const writes = evidence.operations.map((id) => OperationCatalog.get(id)).filter(({ method }) => method !== 'GET');
    if (writes.length) {
      assert.match(operationController, /IDEMPOTENCY_KEY_REQUIRED/);
      assert.match(moduleOperations, /runtime\.idempotency/);
    }
    assert.match(migrationText, /skip locked/i);
    assert.match(migrationText, /primary key\(consumer,event_id\)/i);
  });

  test(`${requirement} downstream failure is explicit and recoverable`, () => {
    const modules = new Set(evidence.operations.map((id) => OperationCatalog.get(id).module));
    for (const module of modules) {
      const text = sourceTree(ownerModuleDirectory(module), '.ts');
      assert.doesNotMatch(text, /catch\s*\{\s*return\s+(?:\[\]|\{\s*success:\s*true)/);
    }
    assert.match(migrationText, /deadletter|failed_at/i);
    assert.match(source('01_core_hexin/services/commerce/src/foundation/application/JobRunner.ts'), /fail|retry|reschedule/i);
    assert.match(source('01_core_hexin/services/commerce/src/foundation/interface/ErrorMapper.ts'), /status|code/);
  });

  test(`${requirement} audit and telemetry evidence is mandatory`, () => {
    assert.match(moduleOperations, /appendOperationAudit/);
    assert.match(moduleOperations, /requestHash/);
    assert.match(source('01_core_hexin/services/commerce/src/foundation/interface/HttpApp.ts'), /request-id|x-request-id/i);
    assert.match(migrationText, /create table audit\.record/i);
    if (evidence.event) assert.match(eventDefinitions, new RegExp(`id: ${escape(evidence.event)}`));
  });

  test(`${requirement} final database owners and invariants exist`, () => {
    for (const table of evidence.tables) assert.ok(new RegExp(`create table ${escape(table)}\\(`, 'i').test(migrationText)
      || new RegExp(`id: ${escape(table)}(?:\\n|$)`).test(objectContract), `${table} is missing`);
    assert.match(migrationText, /check\s*\(/i);
    assert.match(migrationText, /foreign key|references /i);
    assert.match(migrationText, /audit\.record/);
  });
}

function source(relative: string): string {
  return readFileSync(join(root, relative), 'utf8');
}

function sourceTree(relative: string, suffix: string): string {
  const directory = join(root, relative);
  return files(directory, suffix).map((file) => readFileSync(file, 'utf8')).join('\n');
}

function files(directory: string, suffix: string): string[] {
  const files: string[] = [];
  const walk = (path: string): void => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const target = join(path, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (entry.name.endsWith(suffix)) files.push(target);
    }
  };
  walk(directory);
  return files;
}

function ownerModulePath(module: string): string {
  const fileName = `${title(module)}Module.ts`;
  const matches = commerceModuleFiles.filter((path) => basename(path) === fileName);
  const layered = matches.filter((path) => basename(dirname(path)) === '05_interface_jieru');
  const candidates = layered.length ? layered : matches;
  assert.equal(candidates.length, 1, `${module} owner module path must resolve uniquely: ${candidates.join(', ')}`);
  return relative(root, candidates[0]!);
}

function ownerModuleDirectory(module: string): string {
  const ownerDirectory = dirname(ownerModulePath(module));
  return basename(ownerDirectory) === '05_interface_jieru' ? dirname(ownerDirectory) : ownerDirectory;
}

function title(value: string): string {
  return `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
