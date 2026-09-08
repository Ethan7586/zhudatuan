import { describe, expect, it, vi } from 'vitest';
import type { ProviderManifest } from '@shop/contract';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { ProviderMetrics } from '../../../../platform/telemetry/ProviderMetrics';
import { Installation } from '../../domain/model/Installation';
import type { ExtensionCandidate, ExtensionLoader, ExtensionRepository } from '../port/ExtensionLoader';
import type { ExtensionStateSink } from '../../public';
import { MonitorExtensions } from './MonitorExtensions';

describe('MonitorExtensions', () => {
  it('bounds a hanging provider, opens only its circuit and restores it with a half-open probe', async () => {
    let current = new Installation('connection:1', 'sample', '1.0.0', 'scope:1', 'enabled', 0, 2);
    let stageCalls = 0;
    const stage = vi.fn(async () => {
      stageCalls += 1;
      if (stageCalls === 1) return new Promise<ExtensionCandidate>(() => undefined);
      return candidate(current.version);
    });
    const activate = vi.fn(async () => undefined);
    const disable = vi.fn(async () => ({ drained: true, stopped: true, active: 0, waited: 0 }));
    const loader = { stage, activate, disable, discard: vi.fn(async () => undefined), active: () => false, reconcile: vi.fn(async () => undefined) } as unknown as ExtensionLoader;
    const health = vi.fn(async (_context: unknown, _record: unknown) => undefined);
    const transition = vi.fn(async (_context, installation: Installation, state: 'degraded' | 'enabled') => {
      current = installation.transition(state);
      return current;
    });
    const repository = {
      lock: vi.fn(async () => current),
      health,
      transition,
      enqueueHealth: vi.fn(async () => undefined),
      activation: vi.fn(async () => ({ candidate: current, active: null })),
      targets: vi.fn(async () => []),
      enqueueScan: vi.fn(async () => undefined),
    } as unknown as ExtensionRepository;
    const states = { degrade: vi.fn(async () => undefined), recover: vi.fn(async () => undefined) } as ExtensionStateSink;
    const metrics = { observe: vi.fn() } as unknown as ProviderMetrics;
    const monitor = new MonitorExtensions(transactions(), repository, loader, states, metrics, { timeout: 5, failures: 1, recovery: 10, interval: 1 });
    const signal = new AbortController().signal;

    await expect(monitor.check(current.id, current.scope, 'trace:timeout', signal, Date.now() + 1_000)).resolves.toBeUndefined();
    expect(disable).toHaveBeenCalledOnce();
    expect(transition).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ state: 'enabled' }), 'degraded', expect.anything(), expect.objectContaining({ reason: 'EXTENSION_HEALTH_TIMEOUT' }));
    expect(states.degrade).toHaveBeenCalledOnce();
    expect(health.mock.calls[0]?.[1]).toMatchObject({ state: 'unavailable', reason: 'EXTENSION_HEALTH_TIMEOUT' });

    await monitor.check(current.id, current.scope, 'trace:circuit', signal, Date.now() + 1_000);
    expect(stage).toHaveBeenCalledOnce();
    expect(health.mock.calls[1]?.[1]).toMatchObject({ state: 'unavailable', reason: 'EXTENSION_HEALTH_CIRCUIT_OPEN' });

    await new Promise((resolve) => setTimeout(resolve, 12));
    await monitor.check(current.id, current.scope, 'trace:recover', signal, Date.now() + 1_000);
    expect(stage).toHaveBeenCalledTimes(2);
    expect(transition).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ state: 'degraded' }), 'enabled', expect.anything(), expect.objectContaining({ probes: expect.anything() }));
    expect(states.recover).toHaveBeenCalledOnce();
    expect(activate).toHaveBeenCalledOnce();
  });

  it('scans by enqueueing isolated jobs and never probes a provider inside the global scan', async () => {
    const loader = { reconcile: vi.fn(async () => undefined), stage: vi.fn() } as unknown as ExtensionLoader;
    const repository = {
      targets: vi.fn(async () => [
        { id: 'connection:1', scope_id: 'scope:1', extension_id: 'sample', status: 'enabled' },
        { id: 'connection:2', scope_id: 'scope:2', extension_id: 'other', status: 'degraded' },
      ]),
      enqueueHealth: vi.fn(async () => undefined),
      enqueueScan: vi.fn(async () => undefined),
    } as unknown as ExtensionRepository;
    const monitor = new MonitorExtensions(transactions(), repository, loader, { degrade: vi.fn(), recover: vi.fn() }, { observe: vi.fn() } as unknown as ProviderMetrics, { timeout: 5, failures: 1, recovery: 10, interval: 1 });
    await monitor.scan(new AbortController().signal, Date.now() + 1_000);
    expect(repository.enqueueHealth).toHaveBeenCalledTimes(2);
    expect(loader.stage).not.toHaveBeenCalled();
    expect(repository.enqueueScan).toHaveBeenCalledWith(expect.anything(), 1);
  });
});

function transactions(): TransactionManager {
  return { read: async (_options, work) => work({} as never), write: async (_options, work) => work({} as never) };
}

function candidate(version: number): ExtensionCandidate {
  const health = { state: 'healthy', checkedAt: '2026-09-04T00:00:00.000Z' } as const;
  return {
    token: 'candidate:1',
    installation: 'connection:1',
    provider: 'sample',
    scope: 'scope:1',
    version,
    manifest: manifest(),
    health,
    latency: 1,
    probes: { contract: 'passed', sandbox: health, canary: health },
  };
}

function manifest(): ProviderManifest {
  return {
    id: 'sample',
    name: '示例',
    kind: 'channel',
    version: '1.0.0',
    apiVersion: '2026-08-21',
    contractVersion: 'sample.v1',
    dependencies: [],
    healthOperation: 'health',
    capabilities: ['Catalog'],
    permissions: ['channel.sample.operate'],
    configSchema: 'provider.sample.v1',
    eventSubscriptions: [],
    secretRefs: ['credential'],
    sandbox: { supported: true, mode: 'endpoint', endpointRef: 'provider.sample.sandboxurl' },
    rateLimits: { requestsPerSecond: 1, maxConcurrency: 1 },
    timeout: { connectionMs: 1, responseMs: 1, totalMs: 1 },
    retryPolicy: { maxAttempts: 1 },
    circuitPolicy: { failureThreshold: 1, recoveryMs: 100 },
    webhookContract: null,
    signature: 'signed',
  };
}
