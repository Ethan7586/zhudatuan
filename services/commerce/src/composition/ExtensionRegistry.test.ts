import { describe, expect, it } from 'vitest';
import type { ChannelProvider, ProviderHealthState, ProviderManifest, ProviderPortName, ProviderPorts } from '@shop/contract';
import { ExtensionRegistry } from './ExtensionRegistry';

describe('ExtensionRegistry', () => {
  it('keeps the active secret version when a rotation canary is unhealthy and atomically activates the verified replacement', async () => {
    const registry = new ExtensionRegistry({ verify: () => Promise.resolve(true) });
    const old = provider('old', 'healthy');
    await registry.register('connection:old', 'scope:1', 0, old);
    registry.freeze();
    expect(() => registry.strategy('sample', 'scope:1', 'Catalog')).not.toThrow();
    expect(() => registry.strategy('sample', 'scope:1', ['Brand', 'Catalog'])).not.toThrow();
    expect(() => registry.strategy('sample', 'scope:1', 'Logistics')).toThrow('EXTENSION_CAPABILITY_MISSING:sample:Logistics');
    expect(() => registry.strategy('sample', 'scope:1', ['Catalog', 'Catalog'])).toThrow('EXTENSION_STRATEGY_CAPABILITY_INVALID');
    expect(() => registry.strategy('sample', 'scope:1', ['Catalog', 'Price'])).toThrow('EXTENSION_STRATEGY_PORT_AMBIGUOUS');
    const bad = await registry.stage('connection:bad', 'scope:1', 1, provider('bad', 'degraded'));
    await registry.discard(bad.token);
    expect(registry.all()).toEqual([old]);
    const replacement = provider('replacement', 'healthy');
    const good = await registry.stage('connection:new', 'scope:1', 2, replacement);
    await registry.activate(good.token);
    expect(registry.all()).toEqual([replacement]);
    expect(registry.active('sample', 'scope:1', 'connection:new')).toBe(true);
    expect(registry.active('sample', 'scope:1', 'connection:old')).toBe(false);
    expect(old.stopped).toBe(true);
  });
  it('blocks new traffic before waiting for in-flight work to drain', async () => {
    let release!: () => void;
    const running = new Promise<Awaited<ReturnType<ProviderPorts['catalog']['pullCatalog']>>>((resolve) => {
      release = () => resolve({ records: [], errors: [], complete: true });
    });
    const active = provider('active', 'healthy', () => running);
    const registry = new ExtensionRegistry({ verify: () => Promise.resolve(true) });
    await registry.register('connection:active', 'scope:1', 1, active);
    registry.freeze();
    const catalog = registry.strategy('sample', 'scope:1', 'Catalog');
    const call = catalog.pullCatalog(callContext());
    const disabling = registry.disable('sample', 'scope:1', Date.now() + 1_000);
    expect(() => registry.strategy('sample', 'scope:1', 'Catalog')).toThrow('EXTENSION_MISSING:sample');
    await Promise.resolve();
    expect(active.stopped).toBe(false);
    release();
    await call;
    expect(await disabling).toMatchObject({ drained: true, active: 0 });
    expect(active.stopped).toBe(true);
    await expect(catalog.pullCatalog(callContext())).rejects.toThrow('EXTENSION_DRAINING:sample');
  });

  it('keeps another provider product, order and finance capabilities available when one provider is disabled', async () => {
    const registry = new ExtensionRegistry({ verify: () => Promise.resolve(true) });
    const disabled = provider('disabled', 'healthy');
    const stable = businessProvider('stable');
    await registry.register('connection:disabled', 'scope:1', 1, disabled);
    await registry.register('connection:stable', 'scope:1', 1, stable);
    registry.freeze();

    await expect(registry.disable('sample', 'scope:1')).resolves.toMatchObject({ drained: true, stopped: true, active: 0 });
    expect(registry.has('sample', 'scope:1')).toBe(false);
    expect(registry.has('stable', 'scope:1')).toBe(true);
    await expect(registry.strategy('stable', 'scope:1', 'Catalog').pullCatalog(callContext())).resolves.toMatchObject({ complete: true });
    await expect(registry.strategy('stable', 'scope:1', 'Order').submit(callContext(), { reference: 'order:1', payload: {} })).resolves.toMatchObject({ externalReference: 'stable-order:1', state: 'submitted' });
    await expect(registry.strategy('stable', 'scope:1', 'Statement').pullStatement(callContext(), { start: '2026-09-01', end: '2026-09-02', timezone: 'Asia/Shanghai' })).resolves.toMatchObject({
      objectRef: 'object://stable/statement.csv',
    });
    await expect(registry.health('stable', 'scope:1')).resolves.toMatchObject({ state: 'healthy' });
    expect(disabled.stopped).toBe(true);
    expect(stable.stopped).toBe(false);
  });
});

function provider(version: string, state: ProviderHealthState, pullCatalog: ProviderPorts['catalog']['pullCatalog'] = async () => ({ records: [], errors: [], complete: true })): ChannelProvider & { stopped: boolean } {
  const manifest: ProviderManifest = {
    id: 'sample',
    name: '示例渠道',
    kind: 'channel',
    version: '1.0.0',
    apiVersion: '2026-08-21',
    contractVersion: 'sample.v1',
    dependencies: [],
    healthOperation: 'health',
    capabilities: ['Catalog'],
    permissions: ['channel.sample.operate'],
    configSchema: 'sample',
    eventSubscriptions: [],
    secretRefs: [],
    sandbox: { supported: true, mode: 'local', endpointRef: null },
    rateLimits: { requestsPerSecond: 1, maxConcurrency: 1 },
    timeout: { connectionMs: 1, responseMs: 1, totalMs: 1 },
    retryPolicy: { maxAttempts: 1 },
    circuitPolicy: { failureThreshold: 1, recoveryMs: 100 },
    webhookContract: null,
    signature: 'signed',
  };
  return {
    manifest,
    stopped: false,
    has: (name) => name === 'catalog',
    require: <K extends ProviderPortName>(_name: K) => ({ pullCatalog }) as unknown as ProviderPorts[K],
    health: () => Promise.resolve({ state, checkedAt: new Date(0).toISOString(), ...(state === 'healthy' ? {} : { reason: version }) }),
    start: () => Promise.resolve(),
    stop() {
      this.stopped = true;
      return Promise.resolve();
    },
  } as ChannelProvider & { stopped: boolean };
}

function callContext() {
  return { tenantId: 'tenant:1', requestId: 'request:1', traceId: 'trace:1', deadline: Date.now() + 1_000 };
}

function businessProvider(id: string): ChannelProvider & { stopped: boolean } {
  const common = provider('business', 'healthy');
  const manifest = Object.freeze({ ...common.manifest, id, name: '稳定业务渠道', capabilities: ['Catalog', 'Order', 'Statement'] as const });
  const ports = {
    catalog: { pullCatalog: async () => ({ records: [{ source: id }], errors: [], complete: true }) },
    order: { submit: async (_context: unknown, order: { reference: string }) => ({ externalReference: `${id}-${order.reference}`, state: 'submitted', rawReference: `${id}-${order.reference}` }) },
    statement: { pullStatement: async () => ({ objectRef: `object://${id}/statement.csv`, sha256: 'a'.repeat(64) }) },
  } as const;
  return {
    manifest,
    stopped: false,
    has: (name) => name in ports,
    require<K extends ProviderPortName>(name: K): ProviderPorts[K] {
      const selected = ports[name as keyof typeof ports];
      if (!selected) throw new Error('PROVIDER_PORT_MISSING:' + name);
      return selected as unknown as ProviderPorts[K];
    },
    health: () => Promise.resolve({ state: 'healthy', checkedAt: new Date(0).toISOString() }),
    start: () => Promise.resolve(),
    stop() {
      this.stopped = true;
      return Promise.resolve();
    },
  };
}
