import { describe, expect, it } from 'vitest';
import { ModuleCatalog } from './ModuleCatalog';
import { defineModuleManifest } from './ModuleManifest';

const catalog = defineModuleManifest({
  id: 'catalog',
  version: '1.0.0',
  kind: 'business',
  provides: ['catalog.read'],
});

const order = defineModuleManifest({
  id: 'order',
  version: '1.0.0',
  kind: 'business',
  provides: ['order.write'],
  requires: ['catalog.read'],
});

describe('ModuleCatalog', () => {
  it('includes capability providers before their consumers', () => {
    const plan = new ModuleCatalog([order, catalog]).resolve({ modules: ['order'] });

    expect(plan.modules.map((module) => module.id)).toEqual(['catalog', 'order']);
    expect(plan.providers.get('catalog.read')).toBe('catalog');
  });

  it('uses an explicit binding when several modules provide one capability', () => {
    const externalCatalog = defineModuleManifest({
      id: 'external-catalog',
      version: '1.0.0',
      kind: 'extension',
      provides: ['catalog.read'],
    });

    const plan = new ModuleCatalog([catalog, externalCatalog, order]).resolve({
      modules: ['order'],
      bindings: { 'catalog.read': 'external-catalog' },
    });

    expect(plan.modules.map((module) => module.id)).toEqual(['external-catalog', 'order']);
  });

  it('reports a missing required capability', () => {
    expect(() => new ModuleCatalog([order]).resolve({ modules: ['order'] })).toThrow(
      'Missing provider for capability: catalog.read',
    );
  });

  it('reports circular module dependencies', () => {
    const first = defineModuleManifest({
      id: 'first',
      version: '1.0.0',
      kind: 'business',
      provides: ['first.ready'],
      requires: ['second.ready'],
    });
    const second = defineModuleManifest({
      id: 'second',
      version: '1.0.0',
      kind: 'business',
      provides: ['second.ready'],
      requires: ['first.ready'],
    });

    expect(() => new ModuleCatalog([first, second]).resolve({ modules: ['first'] })).toThrow(
      'Circular module dependency at: first',
    );
  });
});
