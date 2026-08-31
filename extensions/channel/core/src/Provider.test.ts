import { describe, expect, it } from 'vitest';
import type { ProviderManifest, ProviderPorts } from '@shop/contract';
import { HeaderAuthenticator, IntegrationClient } from './integration';
import { STANDARD_INTEGRATION_LIMIT, STANDARD_PROVIDER_POLICY } from './Limits';
import { Provider } from './Provider';
import { Webhook } from './Webhook';

const manifest: ProviderManifest = {
  id: 'testprovider',
  kind: 'channel',
  version: '1.0.0',
  apiVersion: '2026-08-21',
  contractVersion: 'test.v1',
  healthOperation: 'health',
  capabilities: ['Catalog'],
  permissions: ['channel.test.operate'],
  configSchema: 'provider.test.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  secretRefs: ['credential'],
  ...STANDARD_PROVIDER_POLICY,
  webhookContract: 'provider.test.webhook.v1',
  signature: 'signed',
};

describe('Provider host', () => {
  it('is unavailable while stopped and becomes healthy only after start', async () => {
    const client = new IntegrationClient(
      { id: 'test', baseUrl: 'https://provider.test', secret: { token: 'x' }, endpoints: { health: '/health' }, healthOperation: 'health', limits: STANDARD_INTEGRATION_LIMIT },
      new HeaderAuthenticator('authorization', 'token'),
      async () => new Response('{}')
    );
    const catalog: ProviderPorts['catalog'] = { pullCatalog: async () => ({ records: [], errors: [], complete: true }) };
    const provider = new Provider(manifest, client, { catalog });
    expect((await provider.health()).state).toBe('unavailable');
    await provider.start();
    expect((await provider.health()).state).toBe('healthy');
    expect(provider.require('catalog')).toBe(catalog);
    expect(() => provider.require('stock')).toThrow('PROVIDER_CAPABILITY_MISSING');
  });

  it('verifies before one atomic raw-envelope and inbox ingress', async () => {
    let persisted = 0;
    const webhook = new Webhook({ verify: async () => true }, { persist: async () => (++persisted === 1 ? 'accepted' : 'replayed') });
    const request = { providerId: 'testprovider', externalId: 'event-1', headers: {}, body: '{"state":"done"}', receivedAt: '2026-08-21T00:00:00.000Z', traceId: 'trace' };
    expect(await webhook.receive(request)).toBe('accepted');
    expect(await webhook.receive(request)).toBe('replayed');
  });

  it('rejects an invalid webhook without persistence', async () => {
    let persisted = false;
    const webhook = new Webhook(
      { verify: async () => false },
      {
        persist: async () => {
          persisted = true;
          return 'accepted';
        },
      }
    );
    await expect(webhook.receive({ providerId: 'testprovider', externalId: 'event-1', headers: {}, body: '{}', receivedAt: '2026-08-21T00:00:00.000Z', traceId: 'trace' })).rejects.toThrow('PROVIDER_WEBHOOK_SIGNATURE_INVALID');
    expect(persisted).toBe(false);
  });
});
