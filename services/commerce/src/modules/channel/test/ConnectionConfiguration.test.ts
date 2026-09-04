import { describe, expect, it, vi } from 'vitest';
import { readHandlerContext } from '../../../test/HandlerFixture';
import { ConnectionsTestHandler } from '../application/handler/ConnectionsTestHandler';
import type { ConnectionRepository } from '../application/port/ConnectionRepository';
import { connectionConfiguration, secretReference } from '../application/service/ConnectionConfiguration';

describe('channel connection configuration', () => {
  it('normalizes and deeply freezes public configuration independently from SecretRef', () => {
    const configuration = connectionConfiguration({
      configuration: {
        region: ' cn ',
        baseUrl: 'https://provider.example/api',
        healthOperation: 'health',
        endpoints: { health: ' /health ' },
        returnInstruction: { mode: 'pickup', locations: ['store'] },
      },
      secretRef: 'vault/channel/credential',
    });

    expect(configuration.document).toEqual({
      region: 'cn',
      baseUrl: 'https://provider.example/api',
      healthOperation: 'health',
      endpoints: { health: '/health' },
      returnInstruction: { mode: 'pickup', locations: ['store'] },
    });
    expect(configuration.document).not.toHaveProperty('secretRef');
    expect(Object.isFrozen(configuration.document)).toBe(true);
    expect(Object.isFrozen(configuration.document.returnInstruction)).toBe(true);
    expect(secretReference({ secretRef: ' vault/channel/credential ' }, false)).toBe('vault/channel/credential');
  });

  it('rejects nested credentials, unsafe URLs, endpoint escapes and oversized structures', () => {
    expect(() => connectionConfiguration({ configuration: valid({ auth: { apiKey: 'plaintext' } }) })).toThrow('PROVIDER_CONFIGURATION_SECRET_FORBIDDEN');
    expect(() => connectionConfiguration({ configuration: valid({ baseUrl: 'https://user:pass@provider.example' }) })).toThrow('PROVIDER_BASE_URL_INVALID');
    expect(() => connectionConfiguration({ configuration: valid({ endpoints: { health: '//attacker.example' } }) })).toThrow('PROVIDER_ENDPOINTS_INVALID');
    expect(() => connectionConfiguration({ configuration: valid({ endpoints: { health: '/health?token=value' } }) })).toThrow('PROVIDER_ENDPOINTS_INVALID');
    expect(() => connectionConfiguration({ configuration: valid({ values: Array.from({ length: 257 }, () => true) }) })).toThrow('PROVIDER_CONFIGURATION_TOO_COMPLEX');
  });

  it('validates opaque SecretRef values and preserves an omitted reference during reconfiguration', () => {
    expect(secretReference({}, false)).toBeNull();
    expect(secretReference({}, true)).toBeUndefined();
    expect(secretReference({ secretRef: '' }, true)).toBeUndefined();
    expect(() => secretReference({ secretRef: 'actual API key' }, false)).toThrow('PROVIDER_SECRET_REFERENCE_INVALID');
    expect(() => secretReference({ secretRef: 'vault:channel/credential' }, false)).toThrow('PROVIDER_SECRET_REFERENCE_INVALID');
  });

  it('tests only the persisted reference and never accepts or writes configuration plaintext', async () => {
    const transition = vi.fn().mockResolvedValue({ id: 'connection:one', state: 'testing', version: 2 });
    const handler = new ConnectionsTestHandler({ transition } as unknown as ConnectionRepository);
    const transaction = {};
    const context = { ...readHandlerContext('channel.connections.test', transaction as never), transaction, expectedVersion: 1 } as never;

    await handler.execute({ path: { connectionid: 'connection:one' }, body: {} } as never, context);

    expect(transition).toHaveBeenCalledOnce();
    expect(transition).toHaveBeenCalledWith(transaction, {
      id: 'connection:one',
      scope: 'mall:one',
      actor: 'principal:test',
      trace: 'trace:test',
      state: 'testing',
      expectedVersion: 1,
    });
    expect(JSON.stringify(transition.mock.calls)).not.toMatch(/secret|configuration|credential/i);
  });
});

function valid(overrides: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return { region: 'cn', baseUrl: 'https://provider.example', healthOperation: 'health', endpoints: { health: '/health' }, ...overrides };
}
