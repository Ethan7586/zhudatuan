import { describe, expect, it } from 'vitest';
import { clientEnvironment } from './ClientEnvironment';
import { miniappEnvironment } from './MiniappEnvironment';
import { API_ENVIRONMENT_KEYS, JOBS_ENVIRONMENT_KEYS, LOCAL_ENVIRONMENT_KEYS, WechatApplicationCatalog, apiReturnTargets, integerValue, isPrivateIpv4Host, localInfrastructureEnvironment, localSeedEnvironment, requiredValue, validateApiEnvironment } from './ServerEnvironment';

describe('runtime configuration schema', () => {
  it('owns every shared key exactly once', () => {
    expect(new Set(API_ENVIRONMENT_KEYS).size).toBe(API_ENVIRONMENT_KEYS.length);
    expect(new Set(JOBS_ENVIRONMENT_KEYS).size).toBe(JOBS_ENVIRONMENT_KEYS.length);
    expect(new Set(Object.values(LOCAL_ENVIRONMENT_KEYS)).size).toBe(Object.values(LOCAL_ENVIRONMENT_KEYS).length);
  });

  it('validates local infrastructure and seed contracts without weakening production schemas', () => {
    expect(localInfrastructureEnvironment({
      LOCAL_TLS_KEY_FILE: '/private/local.key', LOCAL_TLS_CERT_FILE: '/private/local.crt', LOCAL_SECRETS_FILE: '/private/secrets.json',
      LOCAL_SECRETS_PORT: '8443', LOCAL_KMS_PORT: '8444', LOCAL_KMS_MASTER_KEY: 'local-master',
      LOCAL_OBJECTS_PORT: '8445', LOCAL_OBJECTS_DIRECTORY: '/private/objects', LOCAL_OBJECTS_TOKEN: 'local-object-token-value',
    }).objectsPort).toBe(8445);
    const seed = {
      SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8443', LOCAL_ADMIN_DATABASE_CONNECTION_REF: 'shop/local/database/admin',
      MIGRATION_DATABASE_CONNECTION_REF: 'shop/local/database/migration',
      LOCAL_ETHAN_PASSWORD_REF: 'local/ethan/password', IDENTITY_KEY_REF: 'shop/local/identity/index',
      KMS_ENDPOINT: 'https://127.0.0.1:8444', OBJECT_STORE_ENDPOINT: 'https://127.0.0.1:8445', OBJECT_STORE_TOKEN_REF: 'shop/local/objects/api',
    };
    expect(localSeedEnvironment(seed).adminDatabaseConnectionRef).toBe('shop/local/database/admin');
    expect(localSeedEnvironment(seed).migrationDatabaseConnectionRef).toBe('shop/local/database/migration');
    expect(() => localSeedEnvironment({ ...seed, KMS_ENDPOINT: 'http://127.0.0.1:8444' })).toThrow('KMS_ENDPOINT_INVALID');
  });

  it('normalizes required values and rejects blank secrets', () => {
    expect(requiredValue(' value ', 'MISSING')).toBe('value');
    expect(() => requiredValue('   ', 'MISSING')).toThrow('MISSING');
  });

  it('accepts only bounded integer configuration', () => {
    expect(integerValue(undefined, 10, 1, 20, 'INVALID')).toBe(10);
    expect(integerValue('20', 10, 1, 20, 'INVALID')).toBe(20);
    expect(() => integerValue('20.5', 10, 1, 20, 'INVALID')).toThrow('INVALID');
  });

  it('fails closed for incomplete browser, storefront, and miniapp deployment identity', () => {
    const client = { VITE_API_BASE_URL: 'https://api.example.com', VITE_AUTH_BASE_URL: 'https://auth.example.com', VITE_CLIENT_VERSION: '2.4.1' };
    expect(clientEnvironment(client).clientVersion).toBe('2.4.1');
    expect(() => clientEnvironment({ ...client, VITE_CLIENT_VERSION: '' })).toThrow('CLIENT_VERSION_MISSING');
    expect(() => clientEnvironment({ NEXT_PUBLIC_API_BASE_URL: 'https://api.example.com', NEXT_PUBLIC_AUTH_BASE_URL: 'https://auth.example.com', NEXT_PUBLIC_CLIENT_VERSION: '2.4.1' })).toThrow('CLIENT_API_BASE_URL_MISSING');
    expect(() => miniappEnvironment({ apiBaseUrl: 'https://api.example.com', mallId: '', clientVersion: '2.4.1' })).toThrow('MINIAPP_MALL_ID_INVALID');
  });

  it('fails startup on an unsafe production identity or secret schema', () => {
    const valid = {
      APP_ENV: 'production',
      AUTH_MODE: 'membership',
      SERVICE_VERSION: '1.0.0',
      API_ALLOWED_ORIGINS: 'https://console.example.com',
      AUTH_RETURN_TARGETS: '{"console":"https://console.example.com","storefront":"https://storefront.example.com","store":"https://store.example.com","supplier":"https://supplier.example.com"}',
      DATABASE_API_CONNECTION_REF: 'secret/database/api',
      REDIS_CONNECTION_REF: 'secret/redis/query',
      SESSION_KEY_REF: 'secret/session/signing',
      IDENTITY_KEY_REF: 'secret/identity/lookup',
      QUOTE_KEY_REF: 'secret/checkout/quote',
      KMS_ENDPOINT: 'https://kms.internal',
      PII_KEY_REF: 'secret/pii/encryption',
      WECHAT_APPLICATION_CONFIG_REF: 'secret/wechat/applications',
      WECHAT_PAYMENT_CONFIG_REF: 'secret/payment/wechat',
      WECHAT_IDENTITY_CONFIG_REF: 'secret/identity/wechat',
      OBJECT_STORE_ENDPOINT: 'https://objects.internal',
      OBJECT_STORE_TOKEN_REF: 'secret/objects/token',
      EXTENSION_MANIFEST_KEY_REF: 'secret/extensions/manifestkey',
      SECRET_STORE_ENDPOINT: 'https://secrets.internal',
    };
    expect(() => validateApiEnvironment(valid)).not.toThrow();
    expect(() => validateApiEnvironment({ ...valid, AUTH_MODE: 'test' })).toThrow('PRODUCTION_AUTH_MODE_INVALID');
    expect(() => validateApiEnvironment({ ...valid, DATABASE_API_CONNECTION_REF: '' })).toThrow('DATABASE_API_CONNECTION_REF_MISSING');
    expect(() => validateApiEnvironment({ ...valid, SECRET_STORE_ENDPOINT: '' })).toThrow('SECRET_STORE_ENDPOINT_MISSING');
    expect(apiReturnTargets(valid).storefront).toBe('https://storefront.example.com');
    expect(() => apiReturnTargets({ ...valid, AUTH_RETURN_TARGETS: '{"storefront":"https://evil.example.com"}' })).toThrow('AUTH_RETURN_TARGETS_INVALID');
  });

  it('owns both WeChat application identities once and rejects duplicates', () => {
    const catalog = WechatApplicationCatalog.parse({ applications: [
      { scene: 'miniapp', appId: 'wx4df4137881a1d2bc' },
      { scene: 'jsapi', appId: 'wx4df4137881a1d2bd' },
    ] });
    expect(catalog.get('jsapi').appId).toBe('wx4df4137881a1d2bd');
    expect(catalog.find('wx4df4137881a1d2bc')?.scene).toBe('miniapp');
    expect(() => WechatApplicationCatalog.parse({ applications: [
      { scene: 'miniapp', appId: 'wx4df4137881a1d2bc' },
      { scene: 'jsapi', appId: 'wx4df4137881a1d2bc' },
    ] })).toThrow('WECHAT_APPLICATION_CONFIG_INVALID');
  });

  it('classifies only literal private or local IPv4 hosts', () => {
    expect(['10.0.0.1', '127.0.0.1', '169.254.1.1', '172.16.0.1', '172.31.255.255', '192.168.1.1'].every(isPrivateIpv4Host)).toBe(true);
    expect(['8.8.8.8', '172.15.0.1', '172.32.0.1', 'api.example.com'].some(isPrivateIpv4Host)).toBe(false);
  });
});
