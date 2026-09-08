import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OperationCatalog } from '@shop/contract';
import { COMMERCE_MODULES, BUSINESS_MODULES } from '../../services/commerce/src/generated/ModuleCatalog';
import { ModuleRegistry, type CommerceModule } from '../../services/commerce/src/composition/ModuleRegistry';
import { RouteRegistry } from '../../services/commerce/src/composition/RouteRegistry';
import { defineModuleManifest } from '../../services/commerce/src/composition/ModuleManifest';

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

test('all bounded contexts, support modules, runtime and observability have a deterministic dependency order', async () => {
  assert.equal(BUSINESS_MODULES.length, 30);
  assert.equal(COMMERCE_MODULES.length, 33);
  for (const workload of ['api', 'jobs', 'provider'] as const) {
    const registry = new ModuleRegistry();
    const loaded: string[] = [];
    for (const module of COMMERCE_MODULES)
      registry.add({
        manifest: module.manifest,
        id: module.id,
        dependencies: module.dependencies,
        services: module.services,
        capabilities: module.capabilities,
        dependenciesFor: module.dependenciesFor?.bind(module),
        servicesFor: module.servicesFor?.bind(module),
        bindingsFor: module.bindingsFor?.bind(module),
        workersFor: module.workersFor?.bind(module),
        bind: () => [],
        register: () => {
          loaded.push(module.id);
        },
      });
    await registry.load({ workload } as never);
    assert.equal(loaded.length, COMMERCE_MODULES.length);
    assert.equal(new Set(loaded).size, COMMERCE_MODULES.length);
    for (const module of COMMERCE_MODULES) {
      for (const dependency of module.bindingsFor?.(workload) ?? module.dependencies) {
        assert.ok(loaded.indexOf(dependency) < loaded.indexOf(module.id), `${workload}:${dependency}->${module.id}`);
      }
    }
  }
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
  return { manifest: defineModuleManifest({ id, dependencies }), id, dependencies, services: [], capabilities: [], bind: () => [], register: () => undefined };
}
