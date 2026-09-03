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
  DATABASE_API_CONNECTION_REF: 'zhudatuan/payment-webhook/database/api',
  SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
  SECRET_STORE_BEARER_TOKEN: 's'.repeat(43),
  WECHAT_APPLICATION_CONFIG_REF: 'zhudatuan/purchase/wechat/applications',
  WECHAT_PAYMENT_CONFIG_REF: 'zhudatuan/purchase/payment/wechat',
});

describe('payment webhook API environment', () => {
  it('returns only its exact environment model and fixed loopback port', () => {
    const environment = paymentWebhookApiEnvironment({ ...valid(), NODE_ENV: 'production' });
    expect(Object.keys(environment)).toEqual(PAYMENT_WEBHOOK_API_ENVIRONMENT_KEYS);
    expect(paymentWebhookApiPort(environment)).toBe(4326);
    expect(environment).not.toHaveProperty('NODE_ENV');
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

  it('pins the production profile, host, port, secret store, and token shape', () => {
    for (const [key, value, code] of [
      ['PAYMENT_WEBHOOK_API_PROFILE', 'full', 'PAYMENT_WEBHOOK_API_PROFILE_INVALID'],
      ['API_BIND_HOST', '0.0.0.0', 'PAYMENT_WEBHOOK_API_BIND_HOST_INVALID'],
      ['API_PORT', '4323', 'PAYMENT_WEBHOOK_API_PORT_INVALID'],
      ['SECRET_STORE_ENDPOINT', 'http://127.0.0.1:8543', 'SECRET_STORE_ENDPOINT_INVALID'],
      ['SECRET_STORE_ENDPOINT', 'https://secrets.invalid', 'PAYMENT_WEBHOOK_API_SECRET_STORE_ENDPOINT_INVALID'],
      ['SECRET_STORE_BEARER_TOKEN', 'short', 'SECRET_STORE_BEARER_TOKEN_INVALID'],
    ] as const) expect(() => paymentWebhookApiEnvironment({ ...valid(), [key]: value })).toThrow(code);
  });
});
