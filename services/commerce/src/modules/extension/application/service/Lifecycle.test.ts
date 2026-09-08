import { describe, expect, it, vi } from 'vitest';
import type { ProviderManifest } from '@shop/contract';
import type { ExtensionCandidate, ExtensionLoader, ExtensionRepository } from '../port/ExtensionLoader';
import { Installation } from '../../domain/model/Installation';
import { DisableExtension } from './DisableExtension';
import { EnableExtension } from './EnableExtension';
import { InstallExtension } from './InstallExtension';
import { ContractPolicy } from '../../domain/policy/ContractPolicy';
import { Manifest } from '../../domain/model/Manifest';

describe('extension lifecycle', () => {
  it('installs by registration only and does not probe or route traffic', async () => {
    const provider = manifest();
    const parsed = Manifest.parse(provider);
    const installed = new Installation('connection:1', 'sample', '1.0.0', 'scope:1', 'disabled', 0, 0);
    const repository = {
      manifest: vi.fn(async () => ({
        id: provider.id,
        version: provider.version,
        manifest: provider,
        manifest_hash: parsed.hash,
        signature: provider.signature,
        contract_version: provider.contractVersion,
        contract_status: 'verified',
        schema_hash: 'a'.repeat(64),
      })),
      install: vi.fn(async () => installed),
    } as unknown as ExtensionRepository;
    const { signature: _signature, ...definition } = provider;
    const stage = vi.fn();
    const activate = vi.fn();
    const loader = { definition: () => definition, stage, activate } as unknown as ExtensionLoader;
    const service = new InstallExtension(repository, { verify: async () => true }, new ContractPolicy(), loader);
    await expect(
      service.execute(context(), {
        id: installed.id,
        provider: provider.id,
        scope: installed.scope,
        baseUrl: 'https://provider.example',
        endpoints: { health: '/health' },
        secretRef: 'vault/channel/credential',
        healthOperation: 'health',
        actor: 'principal:1',
        trace: 'trace:1',
      })
    ).resolves.toMatchObject({ installation: installed });
    expect(repository.install).toHaveBeenCalledOnce();
    expect(stage).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });

  it('runs fresh contract, configuration, sandbox and health probes before atomic activation', async () => {
    const current = installation('testing', 1);
    const transition = vi.fn(async (_context, value: Installation, state) => value.transition(state));
    const enqueueHealth = vi.fn(async () => undefined);
    const repository = {
      lock: vi.fn(async () => current),
      activation: vi.fn(async () => ({ candidate: current, active: null })),
      health: vi.fn(async () => undefined),
      transition,
      enqueueHealth,
    } as unknown as ExtensionRepository;
    const candidate = extensionCandidate(current, 'healthy');
    const activate = vi.fn(async () => undefined);
    const discard = vi.fn(async () => undefined);
    const loader = { stage: vi.fn(async () => candidate), activate, discard } as unknown as ExtensionLoader;
    await expect(new EnableExtension(repository, loader).enable(context(), current.id, current.scope, 'principal:1', 'trace:1')).resolves.toBeNull();
    expect(loader.stage).toHaveBeenCalledOnce();
    expect(transition).toHaveBeenCalledWith(expect.anything(), current, 'enabled', 'principal:1', expect.objectContaining({ probes: candidate.probes }));
    expect(enqueueHealth.mock.invocationCallOrder[0]).toBeLessThan(activate.mock.invocationCallOrder[0]!);
    expect(discard).not.toHaveBeenCalled();
  });

  it('never enables an unhealthy candidate and always tears the candidate down', async () => {
    const current = installation('testing', 1);
    const transition = vi.fn();
    const repository = { lock: vi.fn(async () => current), transition } as unknown as ExtensionRepository;
    const candidate = extensionCandidate(current, 'degraded');
    const discard = vi.fn(async () => undefined);
    const loader = { stage: vi.fn(async () => candidate), discard } as unknown as ExtensionLoader;
    await expect(new EnableExtension(repository, loader).enable(context(), current.id, current.scope, 'principal:1', 'trace:1')).rejects.toThrow('EXTENSION_PROBES_REQUIRED');
    expect(discard).toHaveBeenCalledWith(candidate);
    expect(transition).not.toHaveBeenCalled();
  });

  it('removes the route and drains work before persisting disabled state', async () => {
    const current = installation('enabled', 2);
    const calls: string[] = [];
    const loader = {
      disable: vi.fn(async () => {
        calls.push('drain');
        return { drained: true, stopped: true, active: 0, waited: 2 };
      }),
    } as unknown as ExtensionLoader;
    const repository = {
      lock: vi.fn(async () => current),
      transition: vi.fn(async () => {
        calls.push('persist');
        return current.transition('disabled');
      }),
    } as unknown as ExtensionRepository;
    await expect(new DisableExtension(repository, loader).execute(context(), current.id, current.scope, 'principal:1', 'trace:1')).resolves.toBe('sample');
    expect(calls).toEqual(['drain', 'persist']);
    expect(repository.transition).toHaveBeenCalledWith(expect.anything(), current, 'disabled', 'principal:1', expect.objectContaining({ drain: { drained: true, stopped: true, active: 0, waited: 2 } }));
  });
});

function installation(state: 'testing' | 'enabled', version: number): Installation {
  return new Installation('connection:1', 'sample', '1.0.0', 'scope:1', state, 0, version);
}

function extensionCandidate(current: Installation, state: 'healthy' | 'degraded'): ExtensionCandidate {
  const health = { state, checkedAt: '2026-09-04T00:00:00.000Z', ...(state === 'healthy' ? {} : { reason: 'PROVIDER_UNAVAILABLE' }) } as const;
  return {
    token: 'candidate:1',
    installation: current.id,
    provider: current.extension,
    scope: current.scope,
    version: current.version,
    manifest: manifest(),
    health,
    latency: 2,
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

function context() {
  return { tenant: 'tenant:1', membership: 'membership:1', scope: 'scope:1', actor: 'principal:1', trace: 'trace:1', deadline: Date.now() + 10_000, signal: new AbortController().signal } as never;
}
