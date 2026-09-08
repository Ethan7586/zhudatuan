import { describe, expect, it } from 'vitest';
import type { CommerceModule } from './ModuleRegistry';
import { ModuleRegistry, publicPort } from './ModuleRegistry';
import { defineModuleManifest } from './ModuleManifest';
import { defineModule } from './DefinedModule';

describe('ModuleRegistry', () => {
  it('binds every public port in construction order before registering modules', async () => {
    const dependency = publicPort<Readonly<{ value: string }>>('source', 'reader');
    const order: string[] = [];
    const source: CommerceModule = {
      manifest: defineModuleManifest({ id: 'source', ports: [dependency] }),
      id: 'source',
      dependencies: [],
      services: [],
      bind: () => [{ token: dependency, value: Object.freeze({ value: 'ready' }) }],
      register: () => {
        order.push('source');
      },
    };
    const consumer: CommerceModule = {
      manifest: defineModuleManifest({ id: 'consumer', dependencies: ['source'] }),
      id: 'consumer',
      dependencies: ['source'],
      services: [],
      bind: (context) => {
        order.push(`consumer:${context.ports.get(dependency).value}`);
        return [];
      },
      register: () => undefined,
    };
    const registry = new ModuleRegistry();
    registry.add(consumer);
    registry.add(source);
    await registry.load(context());
    expect(order).toEqual(['consumer:ready', 'source']);
    expect(registry.portCatalog()).toEqual(['source.reader']);
    expect(registry.port(dependency)).toEqual({ value: 'ready' });
    expect(registry.events().catalog().length).toBeGreaterThan(0);
    expect(() => registry.add(source)).toThrow('MODULE_REGISTRY_FROZEN');
  });

  it('rejects dependency cycles and undeclared port access', async () => {
    const cyclic = new ModuleRegistry();
    cyclic.add(module('alpha', ['beta']));
    cyclic.add(module('beta', ['alpha']));
    await expect(cyclic.load(context())).rejects.toThrow('MODULE_DEPENDENCY_CYCLE');

    const token = publicPort<string>('source', 'reader');
    const isolated = new ModuleRegistry();
    isolated.add({ manifest: defineModuleManifest({ id: 'source', ports: [token] }), id: 'source', dependencies: [], services: [], bind: () => [{ token, value: 'value' }], register: () => undefined });
    isolated.add({
      manifest: defineModuleManifest({ id: 'consumer' }),
      id: 'consumer',
      dependencies: [],
      services: [],
      bind: () => [],
      register: (value) => {
        value.ports.get(token);
      },
    });
    await expect(isolated.load(context())).rejects.toThrow('PUBLIC_PORT_DEPENDENCY_UNDECLARED');
  });

  it('rejects duplicate publishable capability ownership across plug-in modules', () => {
    const registry = new ModuleRegistry();
    registry.add(capabilityModule('alpha', 'surface.console'));
    expect(() => registry.add(capabilityModule('beta', 'surface.console'))).toThrow('MODULE_CAPABILITY_OWNER_DUPLICATE:surface.console:alpha:beta');
    expect(registry.capabilityCatalog()).toEqual(['surface.console']);
  });

  it('rejects a public port implementation that is absent from its manifest', () => {
    const token = publicPort<string>('source', 'reader');
    const source = defineModule(defineModuleManifest({ id: 'source' }), { ports: [{ token, value: 'value' }] });
    expect(() => source.bind({ workload: 'api' } as never)).toThrow('MODULE_IMPLEMENTATION_UNDECLARED:source:api:publicports:source.reader');
  });
});

function module(id: string, dependencies: readonly string[]): CommerceModule {
  return { manifest: defineModuleManifest({ id, dependencies }), id, dependencies, services: [], capabilities: [], bind: () => [], register: () => undefined };
}

function capabilityModule(id: string, capability: string): CommerceModule {
  const manifest = defineModuleManifest({ id, capabilities: [capability] });
  return { manifest, id, dependencies: [], services: [], capabilities: [capability], bind: () => [], register: () => undefined };
}

function context(): never {
  return { workload: 'api', container: { get: () => undefined }, handlers: {} } as never;
}
