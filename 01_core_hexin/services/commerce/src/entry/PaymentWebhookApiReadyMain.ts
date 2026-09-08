import { request } from 'node:http';
import { loadNodeManifest, paymentWebhookApiEnvironment, paymentWebhookApiPort } from '@shop/config/server';

const environment = paymentWebhookApiEnvironment();
const port = paymentWebhookApiPort(environment);
const manifest = await loadNodeManifest(environment.NODE_MANIFEST_PATH!, {
  manifestId: environment.NODE_MANIFEST_ID!,
  manifestDigest: environment.NODE_MANIFEST_DIGEST!,
  runtimeInstanceId: environment.NODE_RUNTIME_INSTANCE_ID!,
  runtimeConfigRef: environment.NODE_RUNTIME_CONFIG_REF!,
  resourceBindingVersion: environment.NODE_RESOURCE_BINDING_VERSION!,
  releasePointerRef: environment.NODE_RELEASE_POINTER_REF!,
});
const apiHost = manifest.domain_bindings.find((binding) => binding.surface_ref === 'surface:api')?.host;
if (!apiHost) throw new Error('PAYMENT_WEBHOOK_API_HOST_MISSING');
const body = JSON.stringify({
  id: 'readiness-probe',
  create_time: '2026-09-03T00:00:00+08:00',
  event_type: 'TRANSACTION.SUCCESS',
  resource_type: 'encrypt-resource',
  resource: {
    original_type: 'transaction',
    algorithm: 'AEAD_AES_256_GCM',
    ciphertext: 'AA==',
    associated_data: 'readiness',
    nonce: 'readiness001',
  },
});
const deadline = Date.now() + 29_000;
let last = 'not-started';
while (Date.now() < deadline) {
  try {
    const response = await probe(port, apiHost, body);
    const result: unknown = JSON.parse(response.body);
    if (response.status === 400 && result !== null && typeof result === 'object' && !Array.isArray(result)
      && Reflect.get(result, 'code') === 'PROVIDER_SIGNATURE_MISSING') {
      process.stdout.write('ZHUDATUAN_PAYMENT_WEBHOOK_API_READY\n');
      process.exit(0);
    }
    last = `status-${response.status}`;
  } catch (cause) {
    last = cause instanceof Error ? cause.message.slice(0, 120) : 'request-failed';
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
throw new Error(`ZHUDATUAN_PAYMENT_WEBHOOK_API_NOT_READY:${last}`);

function probe(port: number, host: string, body: string): Promise<{ readonly status: number; readonly body: string }> {
  return new Promise((resolve, reject) => {
    const outgoing = request({
      hostname: '127.0.0.1',
      port,
      path: '/api/v1/webhooks/wechat/payment',
      method: 'POST',
      headers: { host, 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
    }, (incoming) => {
      const chunks: Buffer[] = [];
      incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
      incoming.once('end', () => resolve({
        status: incoming.statusCode ?? 0,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    outgoing.once('error', reject);
    outgoing.setTimeout(1_000, () => outgoing.destroy(new Error('request timed out')));
    outgoing.end(body);
  });
}
