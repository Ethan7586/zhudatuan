import { describe, expect, it } from 'vitest';
import {
  WEB_BUSINESS_API_ENVIRONMENT_KEYS,
  webBusinessApiAllowedOrigins,
  webBusinessApiEnvironment,
  webBusinessApiPort,
  webBusinessApiPublicMallSlug,
} from './WebBusinessApiEnvironment';

const secretStoreBearerToken = 's'.repeat(43);
const kmsBearerToken = 'k'.repeat(43);

function valid() {
  return {
    WEB_BUSINESS_API_PROFILE: 'web-business-only',
    API_PORT: '4432',
    API_BIND_HOST: '127.0.0.1',
    APP_ENV: 'production',
    AUTH_MODE: 'membership',
    SERVICE_VERSION: '1.0.0',
    API_ALLOWED_ORIGINS: 'https://h5.hbbtzn.com,https://hbbtzn.com,https://mall.hbbtzn.com,https://www.hbbtzn.com',
    PUBLIC_MALL_SLUG: 'zdt-l1-verify',
    DATABASE_API_CONNECTION_REF: 'zhudatuan/web-business/database/api',
    DATABASE_API_ROLE: 'zhudatuanwebapi',
    KMS_ENDPOINT: 'https://127.0.0.1:8544',
    KMS_BEARER_TOKEN: kmsBearerToken,
    SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
    SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken,
    NODE_MANIFEST_PATH: '/opt/hbbtzn/nodes/l1/manifest.json',
    NODE_MANIFEST_ID: 'manifest:hbbtzn:l1:v1',
    NODE_MANIFEST_DIGEST: `sha256:${'a'.repeat(64)}`,
    NODE_RUNTIME_INSTANCE_ID: 'runtime:hbbtzn:l1:commerce',
    NODE_RUNTIME_CONFIG_REF: 'hbbtzn/nodes/l1/runtime/v1',
    NODE_RESOURCE_BINDING_VERSION: '1',
    NODE_RELEASE_POINTER_REF: '/opt/hbbtzn/nodes/l1/current',
  };
}

describe('web business API environment', () => {
  it('accepts only the dedicated minimal dependency allowlist', () => {
    const environment = webBusinessApiEnvironment(valid());
    expect(environment.WEB_BUSINESS_API_PROFILE).toBe('web-business-only');
    expect(webBusinessApiPort(environment)).toBe(4432);
    expect(webBusinessApiPublicMallSlug(environment)).toBe('zdt-l1-verify');
    expect(webBusinessApiAllowedOrigins(environment)).toEqual([
      'https://h5.hbbtzn.com',
      'https://hbbtzn.com',
      'https://mall.hbbtzn.com',
      'https://www.hbbtzn.com',
    ]);
    expect(new Set(WEB_BUSINESS_API_ENVIRONMENT_KEYS).size).toBe(WEB_BUSINESS_API_ENVIRONMENT_KEYS.length);
  });

  it('accepts the isolated internal storefront slot', () => {
    const environment = webBusinessApiEnvironment({
      ...valid(),
      API_PORT: '4422',
      API_ALLOWED_ORIGINS: `${valid().API_ALLOWED_ORIGINS},https://internal.zhudatuan.com`,
    });
    expect(webBusinessApiPort(environment)).toBe(4422);
    expect(webBusinessApiAllowedOrigins(environment)).toContain('https://internal.zhudatuan.com');
  });

  it('fails closed on full-commerce secrets, public binds, and reused bearer credentials', () => {
    expect(() => webBusinessApiEnvironment({ ...valid(), PAYMENT_CONFIG_REF: 'legacy/payment' }))
      .toThrow('WEB_BUSINESS_API_KEY_FORBIDDEN:PAYMENT_CONFIG_REF');
    expect(() => webBusinessApiEnvironment({ ...valid(), QUOTE_KEY_REF: 'legacy/quote' }))
      .toThrow('WEB_BUSINESS_API_KEY_FORBIDDEN:QUOTE_KEY_REF');
    expect(() => webBusinessApiEnvironment({ ...valid(), SESSION_KEY_REF: 'unnecessary/session' }))
      .toThrow('WEB_BUSINESS_API_KEY_FORBIDDEN:SESSION_KEY_REF');
    expect(() => webBusinessApiEnvironment({ ...valid(), API_BIND_HOST: '0.0.0.0' }))
      .toThrow('WEB_BUSINESS_API_BIND_HOST_INVALID');
    expect(() => webBusinessApiEnvironment({ ...valid(), API_PORT: '3001' }))
      .toThrow('WEB_BUSINESS_API_PORT_INVALID');
    expect(() => webBusinessApiEnvironment({ ...valid(), API_ALLOWED_ORIGINS: 'http://hbbtzn.com' }))
      .toThrow('WEB_BUSINESS_API_ORIGINS_INVALID');
    expect(() => webBusinessApiEnvironment({ ...valid(), PUBLIC_MALL_SLUG: 'INVALID' }))
      .toThrow('PUBLIC_MALL_SLUG_INVALID');
    expect(() => webBusinessApiEnvironment({ ...valid(), KMS_BEARER_TOKEN: secretStoreBearerToken }))
      .toThrow('WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  });

  it('requires exact profile, membership auth, and secure dependency endpoints', () => {
    expect(() => webBusinessApiEnvironment({ ...valid(), WEB_BUSINESS_API_PROFILE: 'full' }))
      .toThrow('WEB_BUSINESS_API_PROFILE_INVALID');
    expect(() => webBusinessApiEnvironment({ ...valid(), AUTH_MODE: 'test' }))
      .toThrow('AUTH_MODE_INVALID');
    expect(() => webBusinessApiEnvironment({ ...valid(), KMS_ENDPOINT: 'http://127.0.0.1:8544' }))
      .toThrow('KMS_ENDPOINT_INVALID');
  });
});
