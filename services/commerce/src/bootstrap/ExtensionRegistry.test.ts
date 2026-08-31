import { describe, expect, it } from 'vitest';
import type { ChannelProvider, ProviderHealthState, ProviderManifest, ProviderPortName, ProviderPorts } from '@shop/contract';
import { ExtensionRegistry } from './ExtensionRegistry';

describe('ExtensionRegistry', () => {
  it('keeps the active instance when a canary is unhealthy and atomically replaces it after success', async () => {
    const registry = new ExtensionRegistry({ verify: () => Promise.resolve(true) });
    const old = provider('old', 'healthy');
    await registry.register('connection:old', 'scope:1', 0, old);
    registry.freeze();
    const bad = await registry.stage('connection:bad', 'scope:1', 1, provider('bad', 'degraded'));
    await registry.discard(bad.token);
    expect(registry.all()).toEqual([old]);
    const replacement = provider('replacement', 'healthy');
    const good = await registry.stage('connection:new', 'scope:1', 2, replacement);
    await registry.activate(good.token);
    expect(registry.all()).toEqual([replacement]);
    expect(old.stopped).toBe(true);
  });
});

function provider(version: string, state: ProviderHealthState): ChannelProvider & { stopped: boolean } {
  const manifest: ProviderManifest = {
    id: 'sample',
    kind: 'channel',
    version: '1.0.0',
    apiVersion: '2026-08-21',
    contractVersion: 'sample.v1',
    healthOperation: 'health',
    capabilities: ['Catalog'],
    permissions: [],
    configSchema: 'sample',
    eventSubscriptions: [],
    secretRefs: [],
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
    require: <K extends ProviderPortName>(_name: K) => {
      throw new Error('UNUSED');
    },
    health: () => Promise.resolve({ state, checkedAt: new Date(0).toISOString(), ...(state === 'healthy' ? {} : { reason: version }) }),
    start: () => Promise.resolve(),
    stop() {
      this.stopped = true;
      return Promise.resolve();
    },
  } as ChannelProvider & { stopped: boolean };
}
