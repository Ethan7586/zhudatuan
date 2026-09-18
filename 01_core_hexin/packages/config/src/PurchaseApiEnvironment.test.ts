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
    API_ALLOWED_ORIGINS: 'https://beta.fufu.wang,https://fufu.wang,https://h5.fufu.wang,https://internal.fufu.wang,https://mini.fufu.wang,https://www.fufu.wang',
    DATABASE_API_CONNECTION_REF: 'zhudatuan/nodes/l0/database/purchase-api',
    DATABASE_API_ROLE: 'zhudatuanpurchaseapi',
    QUOTE_KEY_REF: 'zhudatuan/nodes/l0/purchase/checkout/quote',
    SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
    SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken,
    KMS_ENDPOINT: 'https://127.0.0.1:8544',
    KMS_BEARER_TOKEN: 'k'.repeat(43),
    WECHAT_APPLICATION_CONFIG_REF: 'zhudatuan/nodes/l0/payment/wechat-applications',
    WECHAT_PAYMENT_CONFIG_REF: 'zhudatuan/nodes/l0/payment/wechat',
    NODE_MANIFEST_PATH: '/opt/sfl/nodes/zhudatuan-l0/manifest.json',
    NODE_MANIFEST_ID: 'manifest:zhudatuan:l0:v1',
    NODE_MANIFEST_DIGEST: `sha256:${'a'.repeat(64)}`,
    NODE_RUNTIME_INSTANCE_ID: 'runtime:zhudatuan:l0:commerce',
    NODE_RUNTIME_CONFIG_REF: 'sfl/nodes/zhudatuan-l0/runtime/v1',
    NODE_RESOURCE_BINDING_VERSION: '1',
    NODE_RELEASE_POINTER_REF: '/opt/sfl/nodes/zhudatuan-l0/current',
  };
}

describe('purchase API environment', () => {
  it('accepts only the dependencies required by the three purchase commands', () => {
    const environment = purchaseApiEnvironment(valid());
    expect(environment.PURCHASE_API_PROFILE).toBe('purchase-only');
    expect(purchaseApiPort(environment)).toBe(4323);
    expect(purchaseApiAllowedOrigins(environment)).toEqual([
      'https://beta.fufu.wang',
      'https://fufu.wang',
      'https://h5.fufu.wang',
      'https://internal.fufu.wang',
      'https://mini.fufu.wang',
      'https://www.fufu.wang',
    ]);
    expect(new Set(PURCHASE_API_ENVIRONMENT_KEYS).size).toBe(PURCHASE_API_ENVIRONMENT_KEYS.length);
  });

  it('keeps the purchase core available when the complete payment provider group is absent', () => {
    const disabled: Record<string, string> = { ...valid() };
    for (const key of ['KMS_ENDPOINT', 'KMS_BEARER_TOKEN', 'WECHAT_APPLICATION_CONFIG_REF', 'WECHAT_PAYMENT_CONFIG_REF']) {
      delete disabled[key];
    }
    expect(purchasePaymentProviderEnabled(disabled)).toBe(false);
    expect(purchaseApiEnvironment(disabled).DATABASE_API_CONNECTION_REF).toBe('zhudatuan/nodes/l0/database/purchase-api');
    expect(() => purchaseApiEnvironment({ ...disabled, KMS_ENDPOINT: 'https://127.0.0.1:8544' }))
      .toThrow('PURCHASE_PAYMENT_CONFIGURATION_PARTIAL');
  });

  it('accepts the L1 node-owned purchase slot without L0 origins', () => {
    const environment = purchaseApiEnvironment({
      ...valid(),
      API_PORT: '4434',
      API_ALLOWED_ORIGINS: 'https://h5.fufuwang.com.cn,https://fufuwang.com.cn,https://mall.fufuwang.com.cn,https://www.fufuwang.com.cn',
      DATABASE_API_CONNECTION_REF: 'hbbtzn/nodes/l1/database/purchase-api',
      QUOTE_KEY_REF: 'hbbtzn/nodes/l1/purchase/checkout/quote',
      WECHAT_APPLICATION_CONFIG_REF: 'hbbtzn/nodes/l1/payment/wechat-applications',
      WECHAT_PAYMENT_CONFIG_REF: 'hbbtzn/nodes/l1/payment/wechat',
      NODE_MANIFEST_PATH: '/opt/sfl/nodes/hbbtzn-l1/manifest.json',
      NODE_MANIFEST_ID: 'manifest:hbbtzn:l1:v1',
      NODE_RUNTIME_INSTANCE_ID: 'runtime:hbbtzn:l1:commerce',
      NODE_RUNTIME_CONFIG_REF: 'sfl/nodes/hbbtzn-l1/runtime/v1',
      NODE_RELEASE_POINTER_REF: '/opt/sfl/nodes/hbbtzn-l1/current',
    });
    expect(purchaseApiPort(environment)).toBe(4434);
    expect(purchaseApiAllowedOrigins(environment)).not.toContain('https://fufu.wang');
  });

  it('fails closed on full-runtime dependencies, public binds, and invalid ports', () => {
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
    expect(() => purchaseApiEnvironment({ ...valid(), API_PORT: '0' }))
      .toThrow('API_PORT_INVALID');
    const generated = purchaseApiEnvironment({
      ...valid(),
      API_PORT: '21873',
      API_ALLOWED_ORIGINS: 'https://storefront.generated.invalid',
    });
    expect(purchaseApiPort(generated)).toBe(21873);
    expect(purchaseApiAllowedOrigins(generated)).toEqual(['https://storefront.generated.invalid']);
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
    expect(purchaseApiEnvironment({ ...valid(), SECRET_STORE_ENDPOINT: 'https://127.0.0.1:59253' }).SECRET_STORE_ENDPOINT)
      .toBe('https://127.0.0.1:59253');
    expect(() => purchaseApiEnvironment({ ...valid(), SECRET_STORE_BEARER_TOKEN: 'short' }))
      .toThrow('SECRET_STORE_BEARER_TOKEN_INVALID');
    expect(() => purchaseApiEnvironment({ ...valid(), KMS_ENDPOINT: 'http://127.0.0.1:8544' }))
      .toThrow('KMS_ENDPOINT_INVALID');
    expect(() => purchaseApiEnvironment({ ...valid(), KMS_BEARER_TOKEN: 'short' }))
      .toThrow('KMS_BEARER_TOKEN_INVALID');
  });
});
