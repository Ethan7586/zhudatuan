import { CAPABILITY_CODES_BY_OWNER, OperationCatalog } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import type { RegisteredOperationHandler } from '../../../pipeline/OperationHandler';
import { ChannelCapabilities, Manifest } from '../Manifest';
import { ChannelModule } from '../Module';

describe('channel module assembly', () => {
  it('publishes and registers every canonical Channel capability', () => {
    const operations = OperationCatalog.all().filter(({ module }) => module === 'channel');
    const registered: string[] = [];
    ChannelModule.register({
      workload: 'api',
      handlers: { add: (_owner: string, handler: RegisteredOperationHandler) => registered.push(handler.operation) } as never,
      events: { add: () => undefined },
      ports: { get: (token) => port(token.key) as never },
      service: (token) => service(token.key) as never,
    });

    expect(ChannelCapabilities).toBe(CAPABILITY_CODES_BY_OWNER.channel);
    expect(ChannelModule.capabilities).toEqual(ChannelCapabilities);
    expect(new Set(ChannelCapabilities)).toEqual(new Set(operations.map(({ capability }) => capability)));
    expect(new Set(registered)).toEqual(new Set(operations.map(({ id }) => id)));
  });

  it('keeps API, job and provider dependencies isolated', () => {
    expect(Manifest.workloads.api.dependencies).toEqual(['extension', 'organization', 'capability']);
    expect(Manifest.workloads.api.services).toEqual(['kms.client']);
    expect(Manifest.workloads.jobs.dependencies).toEqual([]);
    expect(Manifest.workloads.jobs.services).toEqual([]);
    expect(Manifest.workloads.provider.dependencies).toEqual(['catalog', 'finance', 'inventory', 'pricing']);
    expect(Manifest.workloads.provider.services).toEqual(['database.pool', 'extension.registry', 'secret.store', 'kms.client']);
  });
});

function port(key: string): unknown {
  if (key === 'extension.registry') {
    return {
      strategy: () => ({}),
      install: () => ({}),
      enable: () => ({}),
      disable: () => ({}),
      summaries: () => Promise.resolve([]),
    };
  }
  return {};
}

function service(_key: string): unknown {
  return {};
}
