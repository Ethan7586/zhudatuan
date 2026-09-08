import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parse } from 'yaml';

interface FusionInventory {
  readonly summary: Readonly<{
    operations: number;
    sourceOperations: number;
    sharedOperations: number;
    sourceOnlyOperations: number;
    mainOnlyOperations: number;
    events: number;
    modules: number;
    clients: number;
    routes: number;
    requirements: number;
    expectedVisualStates: number;
    navigationNodes: number;
    frontendFiles: number;
    capturedBaselineImages: number;
    unmappedCapabilities: number;
  }>;
  readonly modules: readonly Readonly<{ id: string; owner: string; status: string }>[];
  readonly clients: readonly Readonly<{ id: string; owner: string; status: string }>[];
  readonly operations: readonly Readonly<{ id: string; owner: string; status: string }>[];
  readonly events: readonly Readonly<{ id: string; owner: string; status: string }>[];
  readonly operationFusion: Readonly<{
    shared: readonly string[];
    sourceOnly: readonly OperationDisposition[];
    mainOnly: readonly OperationDisposition[];
  }>;
  readonly pages: readonly Readonly<{ id: string; owner: string; status: string }>[];
  readonly requirements: readonly Readonly<{ id: string; owner: readonly string[]; finalStatus: string }>[];
  readonly visualBaseline: Readonly<{
    expected: readonly Readonly<{ route: string; state: string; owner: string; status: string }>[];
    captured: readonly Readonly<{ path: string; owner: string; status: string }>[];
  }>;
}

interface OperationDisposition {
  readonly source: string;
  readonly decision: 'keep' | 'replace' | 'rename';
  readonly target: string;
  readonly owner: string;
  readonly state: string;
  readonly handler: string;
  readonly test: string;
  readonly journey: `J${number}`;
}

const [inventorySource, navigationSource, frontendSource] = await Promise.all([
  readFile('docs/evidence/fusion/Inventory20260904.json', 'utf8'),
  readFile('config/navigation.yml', 'utf8'),
  readFile('docs/evidence/frontend/files.json', 'utf8'),
]);
const inventory = JSON.parse(inventorySource) as FusionInventory;
const navigation = parse(navigationSource) as Readonly<{ nodes: readonly unknown[] }>;
const frontend = JSON.parse(frontendSource) as Readonly<{ count: number }>;

test('fusion baseline matches its authoritative repository facts', () => {
  assert.deepEqual(inventory.summary, {
    operations: inventory.operations.length,
    sourceOperations: inventory.operationFusion.shared.length + inventory.operationFusion.sourceOnly.length,
    sharedOperations: inventory.operationFusion.shared.length,
    sourceOnlyOperations: inventory.operationFusion.sourceOnly.length,
    mainOnlyOperations: inventory.operationFusion.mainOnly.length,
    events: inventory.events.length,
    modules: inventory.modules.length,
    clients: inventory.clients.length,
    routes: inventory.pages.length,
    navigationNodes: navigation.nodes.length,
    requirements: inventory.requirements.length,
    frontendFiles: frontend.count,
    expectedVisualStates: inventory.visualBaseline.expected.length,
    capturedBaselineImages: inventory.visualBaseline.captured.length,
    unmappedCapabilities: [...inventory.operationFusion.sourceOnly, ...inventory.operationFusion.mainOnly].filter(({ owner, target, journey, test }) => !owner || !target || !journey || !test).length,
  });
  assert.equal(inventory.operations.length, inventory.operationFusion.shared.length + inventory.operationFusion.mainOnly.length);
  assert.deepEqual(inventory.clients.map(({ id }) => id).sort(), ['auth', 'console', 'miniapp', 'store', 'storefront', 'supplier']);
});

test('every source-only and main-only operation has exactly one disposition and owner', () => {
  assertDispositions(inventory.operationFusion.sourceOnly);
  assertDispositions(inventory.operationFusion.mainOnly);
  assert.ok(inventory.operationFusion.sourceOnly.every(({ decision, source, target, state }) => decision === 'replace' && source !== target && state === 'implemented'));
});

test('every page, requirement and visual state has an explicit state and owner', () => {
  assert.equal(inventory.pages.length, inventory.summary.routes);
  assert.ok(inventory.pages.every(({ owner, status }) => owner.length > 0 && status.length > 0));
  assert.equal(inventory.requirements.length, inventory.summary.requirements);
  assert.ok(inventory.requirements.every(({ owner, finalStatus }) => owner.length > 0 && finalStatus === 'required'));
  assert.equal(inventory.visualBaseline.expected.length, inventory.summary.expectedVisualStates);
  assert.ok(inventory.visualBaseline.expected.every(({ owner, status }) => owner.length > 0 && status.length > 0));
});

function assertDispositions(dispositions: readonly OperationDisposition[]): void {
  assert.equal(new Set(dispositions.map(({ source }) => source)).size, dispositions.length);
  for (const disposition of dispositions) {
    assert.match(disposition.source, /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/);
    assert.match(disposition.target, /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/);
    assert.match(disposition.handler, /^services\/commerce\/src\/modules\/[a-z]+\//);
    assert.match(disposition.test, /^services\/commerce\/src\/modules\/[a-z]+\/test\//);
    assert.match(disposition.journey, /^J(?:0[1-9]|[1-3][0-9]|4[0-4])$/);
    assert.ok(disposition.owner.length > 0);
    assert.ok(disposition.state.length > 0);
  }
}
