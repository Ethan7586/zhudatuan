import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

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
    unmappedCapabilities: number;
  }>;
  readonly operationFusion: Readonly<{
    sourceOnly: readonly OperationDisposition[];
    mainOnly: readonly OperationDisposition[];
  }>;
  readonly pages: readonly Readonly<{ id: string; owner: string; status: string }>[];
  readonly requirements: readonly Readonly<{ id: string; owner: readonly string[]; finalStatus: string }>[];
  readonly visualBaseline: Readonly<{ expected: readonly Readonly<{ route: string; state: string; owner: string; status: string }>[] }>;
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

const inventory = JSON.parse(await readFile('docs/evidence/fusion/Inventory20260904.json', 'utf8')) as FusionInventory;

test('fusion baseline freezes the verified repository facts', () => {
  assert.deepEqual(inventory.summary, {
    operations: 276,
    sourceOperations: 328,
    sharedOperations: 231,
    sourceOnlyOperations: 97,
    mainOnlyOperations: 45,
    events: 103,
    modules: 32,
    clients: 3,
    routes: 53,
    navigationNodes: 63,
    requirements: 22,
    frontendFiles: 1623,
    expectedVisualStates: 357,
    capturedBaselineImages: 5,
    unmappedCapabilities: 0,
  });
});

test('every source-only and main-only operation has exactly one disposition and owner', () => {
  assertDispositions(inventory.operationFusion.sourceOnly, 97);
  assertDispositions(inventory.operationFusion.mainOnly, 45);
});

test('every page, requirement and visual state has an explicit state and owner', () => {
  assert.equal(inventory.pages.length, 53);
  assert.ok(inventory.pages.every(({ owner, status }) => owner.length > 0 && status.length > 0));
  assert.equal(inventory.requirements.length, 22);
  assert.ok(inventory.requirements.every(({ owner, finalStatus }) => owner.length > 0 && finalStatus === 'required'));
  assert.equal(inventory.visualBaseline.expected.length, 357);
  assert.ok(inventory.visualBaseline.expected.every(({ owner, status }) => owner.length > 0 && status.length > 0));
});

function assertDispositions(dispositions: readonly OperationDisposition[], expected: number): void {
  assert.equal(dispositions.length, expected);
  assert.equal(new Set(dispositions.map(({ source }) => source)).size, expected);
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
