import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { OperationCatalog, type OperationId } from '@shop/contract';
import { SDK_OPERATION_IDS } from '@shop/sdk';

export interface StorefrontEvidence {
  readonly operations: readonly OperationId[];
  readonly routes: readonly string[];
  readonly sources: readonly string[];
  readonly markers: readonly RegExp[];
}

const root = process.cwd();
const sdk = new Set<OperationId>(SDK_OPERATION_IDS);
const routeCatalog = source('apps/storefront/src/generated/NavigationBinding.ts');

export function storefrontJourney(name: string, evidence: StorefrontEvidence): void {
  test(`${name} uses only canonical named operations`, () => {
    assert.ok(evidence.operations.length > 0);
    for (const id of evidence.operations) {
      const operation = OperationCatalog.get(id);
      assert.ok(sdk.has(id), `${id} is absent from the generated SDK`);
      assert.ok(['public', 'storefront', 'console', 'provider'].includes(operation.audience), `${id} has an invalid audience`);
      if (!['public', 'provider'].includes(operation.audience) && operation.permission === null) {
        assert.ok(['optional', 'session'].includes(operation.assuranceLevel), `${id} may omit permission only for a session-aware read boundary`);
      }
    }
  });

  test(`${name} is reachable from canonical deep links`, () => {
    assert.ok(evidence.routes.length > 0);
    for (const route of evidence.routes) assert.ok(routeCatalog.includes(`\"${route}\"`), `${route} is not generated navigation authority`);
  });

  test(`${name} has executable failure and recovery evidence without mock state`, () => {
    const implementation = evidence.sources
      .map((path) => {
        assert.ok(existsSync(join(root, path)), `${path} is missing`);
        return source(path);
      })
      .join('\n');
    for (const marker of evidence.markers) assert.match(implementation, marker);
    assert.doesNotMatch(implementation, /\blocalStorage\b|\/mock\/|mockData|fakeSuccess/i);
  });
}

function source(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}
