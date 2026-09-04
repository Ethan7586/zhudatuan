import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { HttpClient } from '../../services/commerce/src/foundation/http/HttpClient';
import { NetworkPolicy } from '../../services/commerce/src/foundation/security/NetworkPolicy';
import { AfterSaleAttachment } from '../../services/commerce/src/modules/order/application/service/AfterSaleAttachment';

test('provider egress rejects SSRF, DNS rebinding and oversized responses', async () => {
  await assert.rejects(new NetworkPolicy({ hosts: ['provider.example'] }, async () => ['169.254.169.254']).assert('https://provider.example/order'), /NETWORK_ADDRESS_DENIED/);
  let resolutions = 0;
  const policy = new NetworkPolicy({ hosts: ['provider.example'] }, async () => (++resolutions === 1 ? ['8.8.8.8'] : ['127.0.0.1']));
  await assert.doesNotReject(policy.assert('https://provider.example/order'));
  await assert.rejects(policy.assert('https://provider.example/order'), /NETWORK_ADDRESS_DENIED/);
  const client = new HttpClient(async () => new Response('x'.repeat(2 * 1024 * 1024 + 1)));
  await assert.rejects(client.send('https://provider.example/order', {}, { mode: 'read' }), /HTTP_RESPONSE_TOO_LARGE/);
});

test('attachments reject spoofed type, excessive size and malicious scan state', async () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
  const data = Buffer.from(png).toString('base64');
  const attachments = new AfterSaleAttachment({
    create: async () =>
      ({
        append: async () => undefined,
        complete: async () => ({ reference: 'object:infected', sha256: '0'.repeat(64), size: png.byteLength, scan: 'infected' }),
        abort: async () => undefined,
      }) as never,
  });
  await assert.rejects(attachments.verify(request([{ data, contentType: 'image/jpeg', name: 'spoof.jpg' }]), 'membership:one'), /VALIDATION_FAILED/);
  await assert.rejects(attachments.verify(request([{ data: 'A'.repeat(1_400_000), contentType: 'image/png', name: 'large.png' }]), 'membership:one'), /VALIDATION_FAILED/);
  await assert.rejects(attachments.verify(request([{ data, contentType: 'image/png', name: 'infected.png' }]), 'membership:one'), /VALIDATION_FAILED/);
});

test('API runtime cannot load extension provider credentials', () => {
  const api = readFileSync('services/commerce/src/bootstrap/CommerceRuntime.ts', 'utf8');
  const worker = readFileSync('services/commerce/src/bootstrap/ProviderRuntime.ts', 'utf8');
  assert.match(api, /providerCatalogLoader/);
  assert.doesNotMatch(api, /loadProviders|RuntimeExtensionLoader|PROVIDER_SECRET_REF/);
  assert.match(worker, /loadProviders/);
  assert.match(worker, /DATABASE_PROVIDER_CONNECTION_REF/);
  assert.match(worker, /DATABASE_ROLE_INVALID:shopprovider/);
});

function request(attachments: readonly unknown[]) {
  return { path: { orderid: 'order:one' }, query: {}, headers: {}, body: { attachments }, rawBody: '', deadline: Date.now() + 1000, signal: new AbortController().signal } as never;
}
