import { describe, expect, it } from 'vitest';
import {
  PAYMENT_WEBHOOK_API_ENVIRONMENT_KEYS,
  paymentWebhookApiEnvironment,
  paymentWebhookApiPort,
} from './PaymentWebhookApiEnvironment';

const valid = () => ({
  PAYMENT_WEBHOOK_API_PROFILE: 'payment-webhook-only',
  API_PORT: '4326',
  API_BIND_HOST: '127.0.0.1',
  APP_ENV: 'production',
  SERVICE_VERSION: 'release-one',
  DATABASE_API_CONNECTION_REF: 'zhudatuan/nodes/l0/database/payment-webhook-api',
  DATABASE_API_ROLE: 'zhudatuanpaymentwebhookapi',
  SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
  SECRET_STORE_BEARER_TOKEN: 's'.repeat(43),
  WECHAT_APPLICATION_CONFIG_REF: 'zhudatuan/nodes/l0/payment/wechat-applications',
  WECHAT_PAYMENT_CONFIG_REF: 'zhudatuan/nodes/l0/payment/wechat',
  NODE_MANIFEST_PATH: '/opt/sfl/nodes/zhudatuan-l0/manifest.json',
  NODE_MANIFEST_ID: 'manifest:zhudatuan:l0:v1',
  NODE_MANIFEST_DIGEST: `sha256:${'a'.repeat(64)}`,
  NODE_RUNTIME_INSTANCE_ID: 'runtime:zhudatuan:l0:commerce',
  NODE_RUNTIME_CONFIG_REF: 'sfl/nodes/zhudatuan-l0/runtime/v1',
  NODE_RESOURCE_BINDING_VERSION: '1',
  NODE_RELEASE_POINTER_REF: '/opt/sfl/nodes/zhudatuan-l0/current',
});

describe('payment webhook API environment', () => {
  it('returns only its exact environment model and fixed loopback port', () => {
    const environment = paymentWebhookApiEnvironment({ ...valid(), NODE_ENV: 'production' });
    expect(Object.keys(environment)).toEqual(PAYMENT_WEBHOOK_API_ENVIRONMENT_KEYS);
    expect(paymentWebhookApiPort(environment)).toBe(4326);
    expect(environment).not.toHaveProperty('NODE_ENV');
  });

  it('accepts the L1 node-owned webhook slot', () => {
    const environment = paymentWebhookApiEnvironment({
      ...valid(),
      API_PORT: '4436',
      DATABASE_API_CONNECTION_REF: 'hbbtzn/nodes/l1/database/payment-webhook-api',
      WECHAT_APPLICATION_CONFIG_REF: 'hbbtzn/nodes/l1/payment/wechat-applications',
      WECHAT_PAYMENT_CONFIG_REF: 'hbbtzn/nodes/l1/payment/wechat',
      NODE_MANIFEST_PATH: '/opt/sfl/nodes/hbbtzn-l1/manifest.json',
      NODE_MANIFEST_ID: 'manifest:hbbtzn:l1:v1',
      NODE_RUNTIME_INSTANCE_ID: 'runtime:hbbtzn:l1:commerce',
      NODE_RUNTIME_CONFIG_REF: 'sfl/nodes/hbbtzn-l1/runtime/v1',
      NODE_RELEASE_POINTER_REF: '/opt/sfl/nodes/hbbtzn-l1/current',
    });
    expect(paymentWebhookApiPort(environment)).toBe(4436);
  });

  it('rejects foreign service configuration and partial configuration', () => {
    expect(() => paymentWebhookApiEnvironment({ ...valid(), QUOTE_KEY_REF: 'foreign' }))
      .toThrow('PAYMENT_WEBHOOK_API_KEY_FORBIDDEN:QUOTE_KEY_REF');
    expect(() => paymentWebhookApiEnvironment({ ...valid(), AUTH_MODE: 'membership' }))
      .toThrow('PAYMENT_WEBHOOK_API_KEY_FORBIDDEN:AUTH_MODE');
    const missing = valid();
    delete (missing as Partial<typeof missing>).WECHAT_PAYMENT_CONFIG_REF;
    expect(() => paymentWebhookApiEnvironment(missing)).toThrow('WECHAT_PAYMENT_CONFIG_REF_MISSING');
  });

  it('pins the production profile, host, secret store, and token shape', () => {
    for (const [key, value, code] of [
      ['PAYMENT_WEBHOOK_API_PROFILE', 'full', 'PAYMENT_WEBHOOK_API_PROFILE_INVALID'],
      ['API_BIND_HOST', '0.0.0.0', 'PAYMENT_WEBHOOK_API_BIND_HOST_INVALID'],
      ['API_PORT', '0', 'API_PORT_INVALID'],
      ['SECRET_STORE_ENDPOINT', 'http://127.0.0.1:8543', 'SECRET_STORE_ENDPOINT_INVALID'],
      ['SECRET_STORE_ENDPOINT', 'https://secrets.invalid', 'PAYMENT_WEBHOOK_API_SECRET_STORE_ENDPOINT_INVALID'],
      ['SECRET_STORE_BEARER_TOKEN', 'short', 'SECRET_STORE_BEARER_TOKEN_INVALID'],
    ] as const) expect(() => paymentWebhookApiEnvironment({ ...valid(), [key]: value })).toThrow(code);
    expect(paymentWebhookApiPort(paymentWebhookApiEnvironment({ ...valid(), API_PORT: '21876' }))).toBe(21876);
  });
});
