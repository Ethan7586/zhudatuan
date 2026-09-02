import { describe, expect, it } from 'vitest';
import {
  PURCHASE_API_ENVIRONMENT_KEYS,
  purchaseApiAllowedOrigins,
  purchaseApiEnvironment,
  purchasePaymentProviderEnabled,
  purchaseApiPort,
} from './PurchaseApiEnvironment';

const secretStoreBearerToken = 's'.repeat(43);

function valid() {
  return {
    PURCHASE_API_PROFILE: 'purchase-only',
    API_PORT: '4323',
    API_BIND_HOST: '127.0.0.1',
    APP_ENV: 'production',
    AUTH_MODE: 'membership',
    SERVICE_VERSION: '1.0.0',
    API_ALLOWED_ORIGINS: 'https://zhudatuan.com',
    DATABASE_API_CONNECTION_REF: 'zhudatuan/purchase/database/api',
    QUOTE_KEY_REF: 'zhudatuan/purchase/checkout/quote',
    SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
    SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken,
    KMS_ENDPOINT: 'https://127.0.0.1:8544',
    KMS_BEARER_TOKEN: 'k'.repeat(43),
    WECHAT_APPLICATION_CONFIG_REF: 'zhudatuan/purchase/wechat/applications',
    WECHAT_PAYMENT_CONFIG_REF: 'zhudatuan/purchase/payment/wechat',
  };
}

describe('purchase API environment', () => {
  it('accepts only the dependencies required by the three purchase commands', () => {
    const environment = purchaseApiEnvironment(valid());
    expect(environment.PURCHASE_API_PROFILE).toBe('purchase-only');
    expect(purchaseApiPort(environment)).toBe(4323);
    expect(purchaseApiAllowedOrigins(environment)).toEqual(['https://zhudatuan.com']);
    expect(new Set(PURCHASE_API_ENVIRONMENT_KEYS).size).toBe(PURCHASE_API_ENVIRONMENT_KEYS.length);
  });

  it('keeps the purchase core available when the complete payment provider group is absent', () => {
    const disabled: Record<string, string> = { ...valid() };
    for (const key of ['KMS_ENDPOINT', 'KMS_BEARER_TOKEN', 'WECHAT_APPLICATION_CONFIG_REF', 'WECHAT_PAYMENT_CONFIG_REF']) {
      delete disabled[key];
    }
    expect(purchasePaymentProviderEnabled(disabled)).toBe(false);
    expect(purchaseApiEnvironment(disabled).DATABASE_API_CONNECTION_REF).toBe('zhudatuan/purchase/database/api');
    expect(() => purchaseApiEnvironment({ ...disabled, KMS_ENDPOINT: 'https://127.0.0.1:8544' }))
      .toThrow('PURCHASE_PAYMENT_CONFIGURATION_PARTIAL');
  });

  it('fails closed on full-runtime dependencies, public binds, and non-purchase origins', () => {
    for (const [key, value] of [
      ['PAYMENT_CONFIG_REF', 'legacy/payment'],
      ['REDIS_CONNECTION_REF', 'legacy/redis'],
      ['SESSION_KEY_REF', 'legacy/session'],
      ['PII_KEY_REF', 'legacy/pii'],
      ['EXTENSION_MANIFEST_KEY_REF', 'legacy/extensions'],
      ['OBJECT_STORE_ENDPOINT', 'https://objects.internal'],
      ['WECHAT_IDENTITY_CONFIG_REF', 'legacy/wechat-identity'],
    ] as const) {
      expect(() => purchaseApiEnvironment({ ...valid(), [key]: value }))
        .toThrow(`PURCHASE_API_KEY_FORBIDDEN:${key}`);
    }
    expect(() => purchaseApiEnvironment({ ...valid(), API_BIND_HOST: '0.0.0.0' }))
      .toThrow('PURCHASE_API_BIND_HOST_INVALID');
    expect(() => purchaseApiEnvironment({ ...valid(), API_PORT: '4322' }))
      .toThrow('PURCHASE_API_PORT_INVALID');
    expect(() => purchaseApiEnvironment({ ...valid(), API_ALLOWED_ORIGINS: 'https://console.zhudatuan.com' }))
      .toThrow('PURCHASE_API_ORIGINS_INVALID');
  });

  it('requires the exact profile, membership auth, and a TLS secret-store dependency', () => {
    expect(() => purchaseApiEnvironment({ ...valid(), PURCHASE_API_PROFILE: 'full' }))
      .toThrow('PURCHASE_API_PROFILE_INVALID');
    expect(() => purchaseApiEnvironment({ ...valid(), AUTH_MODE: 'test' }))
      .toThrow('AUTH_MODE_INVALID');
    expect(() => purchaseApiEnvironment({ ...valid(), SECRET_STORE_ENDPOINT: 'http://127.0.0.1:8543' }))
      .toThrow('SECRET_STORE_ENDPOINT_INVALID');
    expect(() => purchaseApiEnvironment({ ...valid(), SECRET_STORE_ENDPOINT: 'https://secrets.attacker.invalid' }))
      .toThrow('PURCHASE_API_SECRET_STORE_ENDPOINT_INVALID');
    expect(() => purchaseApiEnvironment({ ...valid(), SECRET_STORE_BEARER_TOKEN: 'short' }))
      .toThrow('SECRET_STORE_BEARER_TOKEN_INVALID');
    expect(() => purchaseApiEnvironment({ ...valid(), KMS_ENDPOINT: 'http://127.0.0.1:8544' }))
      .toThrow('KMS_ENDPOINT_INVALID');
    expect(() => purchaseApiEnvironment({ ...valid(), KMS_BEARER_TOKEN: 'short' }))
      .toThrow('KMS_BEARER_TOKEN_INVALID');
  });
});
