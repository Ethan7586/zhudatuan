import { describe, expect, it } from 'vitest';
import {
  MALL_PROVISIONING_API_ENVIRONMENT_KEYS,
  mallProvisioningApiAllowedOrigins,
  mallProvisioningApiEnvironment,
  mallProvisioningApiPort,
} from './MallProvisioningApiEnvironment';

const bearer = 's'.repeat(43);

function valid() {
  return {
    MALL_PROVISIONING_API_PROFILE: 'mall-provisioning-only',
    API_PORT: '4325',
    API_BIND_HOST: '127.0.0.1',
    APP_ENV: 'production',
    AUTH_MODE: 'membership',
    SERVICE_VERSION: '1.0.0',
    API_ALLOWED_ORIGINS: 'https://console.zhudatuan.com',
    DATABASE_API_CONNECTION_REF: 'zhudatuan/mall-provisioning/database/api',
    SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
    SECRET_STORE_BEARER_TOKEN: bearer,
  };
}

describe('mall provisioning API environment', () => {
  it('accepts only the dependencies needed to create a mall', () => {
    const environment = mallProvisioningApiEnvironment(valid());
    expect(environment.MALL_PROVISIONING_API_PROFILE).toBe('mall-provisioning-only');
    expect(mallProvisioningApiPort(environment)).toBe(4325);
    expect(mallProvisioningApiAllowedOrigins(environment)).toEqual(['https://console.zhudatuan.com']);
    expect(new Set(MALL_PROVISIONING_API_ENVIRONMENT_KEYS).size)
      .toBe(MALL_PROVISIONING_API_ENVIRONMENT_KEYS.length);
  });

  it('rejects full-runtime dependencies, public binds, and storefront origins', () => {
    for (const [key, value] of [
      ['KMS_ENDPOINT', 'https://127.0.0.1:8544'],
      ['SESSION_KEY_REF', 'legacy/session'],
      ['PAYMENT_CONFIG_REF', 'legacy/payment'],
      ['QUOTE_KEY_REF', 'legacy/quote'],
      ['REDIS_CONNECTION_REF', 'legacy/redis'],
      ['OBJECT_STORE_ENDPOINT', 'https://objects.internal'],
    ] as const) {
      expect(() => mallProvisioningApiEnvironment({ ...valid(), [key]: value }))
        .toThrow(`MALL_PROVISIONING_API_KEY_FORBIDDEN:${key}`);
    }
    expect(() => mallProvisioningApiEnvironment({ ...valid(), API_BIND_HOST: '0.0.0.0' }))
      .toThrow('MALL_PROVISIONING_API_BIND_HOST_INVALID');
    expect(() => mallProvisioningApiEnvironment({ ...valid(), API_PORT: '4321' }))
      .toThrow('MALL_PROVISIONING_API_PORT_INVALID');
    expect(() => mallProvisioningApiEnvironment({ ...valid(), API_ALLOWED_ORIGINS: 'https://zhudatuan.com' }))
      .toThrow('MALL_PROVISIONING_API_ORIGINS_INVALID');
  });

  it('requires the dedicated profile, membership auth, and loopback TLS secret store', () => {
    expect(() => mallProvisioningApiEnvironment({ ...valid(), MALL_PROVISIONING_API_PROFILE: 'full' }))
      .toThrow('MALL_PROVISIONING_API_PROFILE_INVALID');
    expect(() => mallProvisioningApiEnvironment({ ...valid(), AUTH_MODE: 'test' }))
      .toThrow('AUTH_MODE_INVALID');
    expect(() => mallProvisioningApiEnvironment({ ...valid(), SECRET_STORE_ENDPOINT: 'http://127.0.0.1:8543' }))
      .toThrow('SECRET_STORE_ENDPOINT_INVALID');
    expect(() => mallProvisioningApiEnvironment({ ...valid(), SECRET_STORE_ENDPOINT: 'https://secrets.invalid' }))
      .toThrow('MALL_PROVISIONING_API_SECRET_STORE_ENDPOINT_INVALID');
    expect(() => mallProvisioningApiEnvironment({ ...valid(), SECRET_STORE_BEARER_TOKEN: 'short' }))
      .toThrow('SECRET_STORE_BEARER_TOKEN_INVALID');
  });
});
