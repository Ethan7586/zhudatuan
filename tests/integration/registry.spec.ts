import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OperationCatalog } from '@shop/contract';
import { COMMERCE_MODULES, BUSINESS_MODULES } from '../../services/commerce/src/app/modules';
import { ModuleRegistry, type CommerceModule } from '../../services/commerce/src/bootstrap/ModuleRegistry';
import { RouteRegistry } from '../../services/commerce/src/bootstrap/RouteRegistry';

test('every contract operation has one executable route and path parameters round-trip', () => {
  const routes = new RouteRegistry();
  for (const operation of OperationCatalog.all()) routes.register({ operation: operation.id, handler: async () => ({ status: 200, body: { operation: operation.id } }) });
  routes.freeze();
  assert.equal(routes.catalog().length, OperationCatalog.all().length);
  const matched = routes.match('PUT', '/api/v1/catalog/pools/pool%3Aone/bindings/mall%3Aone');
  assert.ok(matched);
  assert.deepEqual(matched.parameters, { poolid: 'pool:one', scopeid: 'mall:one' });
  assert.equal(routes.match('GET', '/api/v1/not-declared'), null);
});

test('all twenty-nine bounded contexts plus runtime and observability have a deterministic dependency order', async () => {
  assert.equal(BUSINESS_MODULES.length, 29);
  assert.equal(COMMERCE_MODULES.length, 31);
  const registry = new ModuleRegistry();
  const loaded: string[] = [];
  for (const module of COMMERCE_MODULES) registry.add({ id: module.id, dependencies: module.dependencies, register: () => { loaded.push(module.id); } });
  await registry.load({} as never);
  assert.equal(loaded.length, 31);
  assert.equal(new Set(loaded).size, 31);
  for (const module of COMMERCE_MODULES) for (const dependency of module.dependencies) assert.ok(loaded.indexOf(dependency) < loaded.indexOf(module.id));
});

test('module dependency cycle and missing dependency both fail startup', async () => {
  const missing = new ModuleRegistry();
  missing.add(module('a', ['missing']));
  await assert.rejects(missing.load({} as never), /MODULE_DEPENDENCY_MISSING/);
  const cycle = new ModuleRegistry();
  cycle.add(module('a', ['b']));
  cycle.add(module('b', ['a']));
  await assert.rejects(cycle.load({} as never), /MODULE_DEPENDENCY_CYCLE/);
});

function module(id: string, dependencies: readonly string[]): CommerceModule {
  return { id, dependencies, register: () => undefined };
}
