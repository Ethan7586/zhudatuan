import { paymentWebhookApiEnvironment, paymentWebhookApiPort } from '@shop/config/server';

const environment = paymentWebhookApiEnvironment();
const port = paymentWebhookApiPort(environment);
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
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/webhooks/wechat/payment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(1_000),
    });
    const result: unknown = await response.json();
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
