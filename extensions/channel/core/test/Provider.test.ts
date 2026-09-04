import { describe, expect, it } from 'vitest';
import type { ProviderManifest, ProviderPorts } from '@shop/contract';
import { HeaderAuthenticator } from '../src/integration';
import { STANDARD_INTEGRATION_LIMIT, STANDARD_PROVIDER_POLICY } from '../src/Limits';
import { Provider } from '../src/Provider';
import { RequestExecutor } from '../src/RequestExecutor';
import { Webhook } from '../src/Webhook';

const manifest: ProviderManifest = {
  id: 'testprovider', name: '测试渠道', kind: 'channel', version: '1.0.0', apiVersion: '2026-08-21', contractVersion: 'test.v1', dependencies: [], healthOperation: 'health', capabilities: ['Catalog'], permissions: ['channel.test.operate'], configSchema: 'provider.test.v1', eventSubscriptions: ['ProviderWebhookReceived'], secretRefs: ['credential'], sandbox: { supported: true, mode: 'endpoint', endpointRef: 'provider.test.sandboxurl' }, ...STANDARD_PROVIDER_POLICY, webhookContract: 'provider.test.webhook.v1', signature: 'signed',
};

describe('Provider host', () => {
  it('is unavailable while stopped and becomes healthy only after start', async () => {
    const client = new RequestExecutor({ id: 'test', baseUrl: 'https://provider.test', secret: { token: 'x' }, endpoints: { health: '/health' }, healthOperation: 'health', limits: STANDARD_INTEGRATION_LIMIT }, new HeaderAuthenticator('authorization', 'token'), async () => new Response('{}'));
    const catalog: ProviderPorts['catalog'] = { pullCatalog: async () => ({ records: [], errors: [], complete: true }) };
    const provider = new Provider(manifest, client, { catalog });
    expect((await provider.health()).state).toBe('unavailable');
    await provider.start();
    expect((await provider.health()).state).toBe('healthy');
    expect(provider.require('catalog')).toBe(catalog);
    expect(() => provider.require('stock')).toThrow('PROVIDER_CAPABILITY_MISSING');
  });

  it('persists one verified raw envelope and rejects invalid signatures', async () => {
    let persisted = 0;
    const accepted = new Webhook({ verify: async () => true }, { persist: async () => (++persisted === 1 ? 'accepted' : 'replayed') });
    const request = { providerId: 'testprovider', externalId: 'event-1', headers: {}, body: '{"state":"done"}', receivedAt: '2026-08-21T00:00:00.000Z', traceId: 'trace' };
    expect(await accepted.receive(request)).toBe('accepted');
    expect(await accepted.receive(request)).toBe('replayed');
    const rejected = new Webhook({ verify: async () => false }, { persist: async () => { persisted += 1; return 'accepted'; } });
    await expect(rejected.receive(request)).rejects.toThrow('PROVIDER_WEBHOOK_SIGNATURE_INVALID');
    expect(persisted).toBe(2);
  });
});
