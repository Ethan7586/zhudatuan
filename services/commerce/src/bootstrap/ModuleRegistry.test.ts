import { describe, expect, it } from 'vitest';
import type { CommerceModule } from './ModuleRegistry';
import { ModuleRegistry, publicPort } from './ModuleRegistry';

describe('ModuleRegistry', () => {
  it('binds each module in dependency order and resolves dependency ports during binding', async () => {
    const dependency = publicPort<Readonly<{ value: string }>>('source', 'reader');
    const order: string[] = [];
    const source: CommerceModule = {
      id: 'source',
      dependencies: [],
      services: [],
      bind: () => [{ token: dependency, value: Object.freeze({ value: 'ready' }) }],
      register: () => {
        order.push('source');
      },
    };
    const consumer: CommerceModule = {
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
    expect(order).toEqual(['source', 'consumer:ready']);
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
    isolated.add({ id: 'source', dependencies: [], services: [], bind: () => [{ token, value: 'value' }], register: () => undefined });
    isolated.add({
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
});

function module(id: string, dependencies: readonly string[]): CommerceModule {
  return { id, dependencies, services: [], bind: () => [], register: () => undefined };
}

function context(): never {
  return { workload: 'api', container: { get: () => undefined }, handlers: {} } as never;
}
