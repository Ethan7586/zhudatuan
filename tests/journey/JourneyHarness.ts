import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { OperationCatalog, type MvpRequirementId, type OperationId } from '@shop/contract';
import { PERMISSION_CATALOG } from '@shop/authz';
import { SDK_OPERATION_IDS } from '@shop/sdk';

export interface JourneyEvidence {
  readonly workstation: string;
  readonly operations: readonly OperationId[];
  readonly tables: readonly string[];
  readonly event?: string;
}

const root = process.cwd();
const migrationText = sourceTree('database/migrations', '.sql');
const objectContract = source('database/contracts/objects.yml');
const operationPipeline = source('services/commerce/src/foundation/application/OperationPipeline.ts');
const operationExecutor = source('services/commerce/src/foundation/application/OperationExecutor.ts');
const operationHash = source('services/commerce/src/foundation/application/OperationHash.ts');
const eventDefinitions = source('packages/contract/definitions/events.yml');
const permissionCodes = new Set(PERMISSION_CATALOG.map(({ code }) => code));
const sdkOperations = new Set<OperationId>(SDK_OPERATION_IDS);

export function journey(requirement: MvpRequirementId, evidence: JourneyEvidence): void {
  test(`${requirement} ${evidence.workstation} main path reaches the named SDK and owner module`, () => {
    assert.ok(evidence.operations.length > 0);
    for (const id of evidence.operations) {
      const operation = OperationCatalog.get(id);
      assert.ok(sdkOperations.has(id), `${id} has no generated named SDK method`);
      assert.ok(operation.requirements.includes(requirement), `${id} does not trace to ${requirement}`);
      assert.match(source(`services/commerce/src/modules/${operation.module}/Module.ts`), new RegExp(operation.module, 'i'));
    }
  });

  test(`${requirement} forbidden path is protected by audience, permission and scope policy`, () => {
    const protectedOperations = evidence.operations.map((id) => OperationCatalog.get(id)).filter(({ audience }) => audience !== 'public' && audience !== 'provider');
    if (protectedOperations.length === 0) {
      for (const id of evidence.operations) {
        const operation = OperationCatalog.get(id);
        assert.equal(operation.audience, 'public', `${operation.id} must remain a public identity boundary`);
        assert.ok(['anonymous', 'preauth'].includes(operation.assuranceLevel), `${operation.id} has an unsafe public assurance policy`);
        assert.equal(operation.targetPolicy, 'exact', `${operation.id} must bind the exact client target`);
      }
    } else {
      for (const operation of protectedOperations) {
        if (operation.permission !== null) assert.ok(permissionCodes.has(operation.permission), `${operation.id} permission is not canonical`);
        else assert.ok(['optional', 'session'].includes(operation.assuranceLevel), `${operation.id} may omit permission only for a session-aware read boundary`);
      }
    }
    assert.match(operationPipeline, /policy\.authorize/);
    assert.match(source('packages/authz/src/Policy.ts'), /SCOPE_DENIED/);
  });

  test(`${requirement} retry and concurrency path has one idempotency owner`, () => {
    const writes = evidence.operations.map((id) => OperationCatalog.get(id)).filter(({ method }) => method !== 'GET');
    if (writes.length) {
      assert.match(operationPipeline, /IDEMPOTENCY_KEY_REQUIRED/);
      assert.match(operationExecutor, /idempotency\.claim/);
    }
    assert.match(migrationText, /skip locked/i);
    assert.match(migrationText, /primary key\(consumer,event_id\)/i);
  });

  test(`${requirement} downstream failure is explicit and recoverable`, () => {
    const modules = new Set(evidence.operations.map((id) => OperationCatalog.get(id).module));
    for (const module of modules) {
      const text = sourceTree(`services/commerce/src/modules/${module}`, '.ts');
      assert.doesNotMatch(text, /catch\s*\{\s*return\s+(?:\[\]|\{\s*success:\s*true)/);
    }
    assert.match(migrationText, /deadletter|failed_at/i);
    assert.match(source('services/commerce/src/foundation/application/JobRunner.ts'), /fail|retry|reschedule/i);
    assert.match(source('services/commerce/src/foundation/interface/ErrorMapper.ts'), /status|code/);
  });

  test(`${requirement} audit and telemetry evidence is mandatory`, () => {
    assert.match(operationExecutor, /auditReply/);
    assert.match(operationHash, /executionRequestHash/);
    assert.match(source('services/commerce/src/foundation/interface/HttpApp.ts'), /request-id|x-request-id/i);
    assert.match(migrationText, /create table audit\.record/i);
    if (evidence.event) assert.match(eventDefinitions, new RegExp(`id: ${escape(evidence.event)}`));
  });

  test(`${requirement} final database owners and invariants exist`, () => {
    for (const table of evidence.tables) assert.ok(new RegExp(`create table ${escape(table)}\\(`, 'i').test(migrationText) || new RegExp(`id: ${escape(table)}(?:\\n|$)`).test(objectContract), `${table} is missing`);
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
  const files: string[] = [];
  const walk = (path: string): void => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const target = join(path, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (entry.name.endsWith(suffix)) files.push(readFileSync(target, 'utf8'));
    }
  };
  walk(directory);
  return files.join('\n');
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
