import { describe, expect, it } from 'vitest';
import {
  CANONICAL_API_ORIGIN,
  CANONICAL_AUTH_ORIGIN,
  FUFU_API_ORIGIN,
  FUFU_AUTH_ORIGIN,
  FUFU_CONSOLE_ORIGIN,
  FUFU_STOREFRONT_ORIGIN,
  LOCAL_API_ORIGIN,
  LOCAL_AUTH_ORIGIN,
  authClientEnvironment,
  clientEnvironment,
  storefrontClientEnvironment,
} from './ClientEnvironment';
import {
  API_ENVIRONMENT_KEYS,
  JOBS_ENVIRONMENT_KEYS,
  PROVIDER_WORKER_ENVIRONMENT_KEYS,
  LOCAL_ENVIRONMENT_KEYS,
  WechatApplicationCatalog,
  apiBindHost,
  apiReturnTargets,
  bearerToken,
  integerValue,
  isPrivateIpv4Host,
  localInfrastructureEnvironment,
  localSeedEnvironment,
  requiredValue,
  validateApiEnvironment,
  validateJobsEnvironment,
  validateProviderWorkerEnvironment,
} from './ServerEnvironment';

const secretStoreBearerToken = 's'.repeat(43);
const kmsBearerToken = 'k'.repeat(43);

describe('canonical runtime configuration', () => {
  it('owns every canonical key exactly once', () => {
    expect(new Set(API_ENVIRONMENT_KEYS).size).toBe(API_ENVIRONMENT_KEYS.length);
    expect(new Set(JOBS_ENVIRONMENT_KEYS).size).toBe(JOBS_ENVIRONMENT_KEYS.length);
    expect(new Set(PROVIDER_WORKER_ENVIRONMENT_KEYS).size).toBe(PROVIDER_WORKER_ENVIRONMENT_KEYS.length);
    expect(new Set(Object.values(LOCAL_ENVIRONMENT_KEYS)).size).toBe(Object.values(LOCAL_ENVIRONMENT_KEYS).length);
  });

  it('isolates provider credentials from API and ordinary Jobs configuration', () => {
    const provider = {
      APP_ENV: 'production',
      SERVICE_VERSION: '1.0.0',
      DATABASE_PROVIDER_CONNECTION_REF: 'secret/database/provider',
      SECRET_STORE_ENDPOINT: 'https://secrets.internal',
      SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken,
      EXTENSION_MANIFEST_KEY_REF: 'secret/extensions/manifest',
      KMS_ENDPOINT: 'https://kms.internal',
      KMS_BEARER_TOKEN: kmsBearerToken,
      PROVIDER_WORKER_ID: 'provider-1',
    };
    expect(() => validateProviderWorkerEnvironment(provider)).not.toThrow();
    expect(() => validateProviderWorkerEnvironment({ ...provider, DATABASE_PROVIDER_CONNECTION_REF: '' })).toThrow('DATABASE_PROVIDER_CONNECTION_REF_MISSING');
  });

  it('validates the single Jobs runtime without profiles', () => {
    const jobs = {
      APP_ENV: 'production',
      SERVICE_VERSION: '1.0.0',
      DATABASE_JOB_CONNECTION_REF: 'secret/database/jobs',
      REDIS_CONNECTION_REF: 'secret/redis',
      SECRET_STORE_ENDPOINT: 'https://secrets.internal',
      SESSION_KEY_REF: 'secret/session/signing',
      IDENTITY_KEY_REF: 'secret/identity/lookup',
      INVITATION_KEY_REF: 'secret/identity/invitation',
      NAVIGATION_KEY_REF: 'secret/navigation/hmac',
      QUOTE_KEY_REF: 'secret/checkout/quote',
      SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken,
      EXTENSION_MANIFEST_KEY_REF: 'secret/extensions/manifest',
      KMS_ENDPOINT: 'https://kms.internal',
      KMS_BEARER_TOKEN: kmsBearerToken,
      WECHAT_APPLICATION_CONFIG_REF: 'secret/wechat/apps',
      WECHAT_PAYMENT_CONFIG_REF: 'secret/wechat/payment',
      INVOICE_CONFIG_REF: 'secret/invoice',
      PAYOUT_CONFIG_REF: 'secret/payout',
      NOTIFICATION_CONFIG_REF: 'secret/notification',
      OBJECT_STORE_ENDPOINT: 'https://objects.internal',
      OBJECT_STORE_TOKEN_REF: 'secret/objects',
      JOB_WORKER_ID: 'jobs-1',
    };
    expect(() => validateJobsEnvironment(jobs)).not.toThrow();
    expect(() => validateJobsEnvironment({ ...jobs, REDIS_CONNECTION_REF: '' })).toThrow('REDIS_CONNECTION_REF_MISSING');
    expect(() => validateJobsEnvironment({ ...jobs, KMS_BEARER_TOKEN: secretStoreBearerToken })).toThrow('WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  });

  it('accepts only two hard-cut authentication return targets', () => {
    const valid = apiEnvironment();
    expect(() => validateApiEnvironment(valid)).not.toThrow();
    expect(apiReturnTargets(valid)).toEqual({ console: 'https://console.example.com', storefront: 'https://storefront.example.com' });
    expect(() => apiReturnTargets({ ...valid, AUTH_RETURN_TARGETS: '{"console":"https://console.example.com","storefront":"https://storefront.example.com","supplier":"https://supplier.example.com"}' })).toThrow(
      'AUTH_RETURN_TARGETS_INVALID'
    );
  });

  it('validates browser, local infrastructure and bounded primitives', () => {
    const client = { VITE_API_BASE_URL: 'https://api.example.com', VITE_AUTH_BASE_URL: 'https://auth.example.com', VITE_CLIENT_VERSION: '2.4.1' };
    expect(clientEnvironment(client).clientVersion).toBe('2.4.1');
    expect(requiredValue(' value ', 'MISSING')).toBe('value');
    expect(bearerToken(secretStoreBearerToken, 'INVALID')).toBe(secretStoreBearerToken);
    expect(integerValue('20', 10, 1, 20, 'INVALID')).toBe(20);
    expect(apiBindHost({})).toBe('127.0.0.1');
    const infrastructure = {
      LOCAL_TLS_KEY_FILE: '/private/local.key',
      LOCAL_TLS_CERT_FILE: '/private/local.crt',
      LOCAL_SECRETS_FILE: '/private/secrets.json',
      LOCAL_SECRETS_PORT: '8443',
      LOCAL_KMS_PORT: '8444',
      LOCAL_KMS_MASTER_KEY: 'local-master',
      LOCAL_SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken,
      LOCAL_KMS_BEARER_TOKEN: kmsBearerToken,
      LOCAL_OBJECTS_PORT: '8445',
      LOCAL_OBJECTS_DIRECTORY: '/private/objects',
      LOCAL_OBJECTS_TOKEN: 'local-object-token-value',
    };
    expect(localInfrastructureEnvironment(infrastructure).objectsPort).toBe(8445);
    const seed = {
      SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8443',
      LOCAL_ADMIN_DATABASE_CONNECTION_REF: 'shop/local/database/admin',
      SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken,
      MIGRATION_DATABASE_CONNECTION_REF: 'shop/local/database/migration',
      LOCAL_ETHAN_PASSWORD_REF: 'local/ethan/password',
      IDENTITY_KEY_REF: 'shop/local/identity/index',
      KMS_ENDPOINT: 'https://127.0.0.1:8444',
      OBJECT_STORE_ENDPOINT: 'https://127.0.0.1:8445',
      OBJECT_STORE_TOKEN_REF: 'shop/local/objects/api',
      KMS_BEARER_TOKEN: kmsBearerToken,
    };
    expect(localSeedEnvironment(seed).adminDatabaseConnectionRef).toBe('shop/local/database/admin');
  });

  it('owns Auth and Storefront origins, versions and local exceptions in one fail-closed source', () => {
    expect(authClientEnvironment({ MODE: 'production', VITE_CLIENT_VERSION: '2.0.0' })).toMatchObject({
      apiOrigin: CANONICAL_API_ORIGIN,
      clientVersion: '2.0.0',
    });
    expect(authClientEnvironment({ MODE: 'development' })).toMatchObject({ apiOrigin: LOCAL_API_ORIGIN, clientVersion: '0.0.0' });
    expect(
      authClientEnvironment({
        MODE: 'production',
        VITE_API_BASE_URL: FUFU_API_ORIGIN,
        VITE_ADMIN_ORIGIN: FUFU_CONSOLE_ORIGIN,
        VITE_STOREFRONT_ORIGIN: FUFU_STOREFRONT_ORIGIN,
        VITE_CLIENT_VERSION: '2.0.0',
      })
    ).toEqual({
      apiOrigin: FUFU_API_ORIGIN,
      consoleOrigin: FUFU_CONSOLE_ORIGIN,
      storefrontOrigin: FUFU_STOREFRONT_ORIGIN,
      clientVersion: '2.0.0',
    });
    expect(() => authClientEnvironment({ MODE: 'production', VITE_API_BASE_URL: 'https://attacker.example', VITE_CLIENT_VERSION: '2.0.0' })).toThrow('AUTH_API_ORIGIN_INVALID');
    expect(storefrontClientEnvironment({ MODE: 'production', VITE_CLIENT_VERSION: '2.0.0' })).toEqual({
      apiOrigin: CANONICAL_API_ORIGIN,
      authOrigin: CANONICAL_AUTH_ORIGIN,
      clientVersion: '2.0.0',
    });
    expect(storefrontClientEnvironment({ MODE: 'development' })).toEqual({
      apiOrigin: LOCAL_API_ORIGIN,
      authOrigin: LOCAL_AUTH_ORIGIN,
      clientVersion: '0.0.0',
    });
    expect(
      storefrontClientEnvironment({
        MODE: 'production',
        VITE_API_BASE_URL: FUFU_API_ORIGIN,
        VITE_AUTH_BASE_URL: FUFU_AUTH_ORIGIN,
        VITE_CLIENT_VERSION: '2.0.0',
      })
    ).toEqual({ apiOrigin: FUFU_API_ORIGIN, authOrigin: FUFU_AUTH_ORIGIN, clientVersion: '2.0.0' });
    expect(() => storefrontClientEnvironment({ MODE: 'production' })).toThrow('CLIENT_VERSION_INVALID');
  });

  it('keeps distinct WeChat applications and private network classification', () => {
    const catalog = WechatApplicationCatalog.parse({
      applications: [
        { scene: 'miniapp', appId: 'wx4df4137881a1d2bc' },
        { scene: 'jsapi', appId: 'wx4df4137881a1d2bd' },
      ],
    });
    expect(catalog.get('jsapi').appId).toBe('wx4df4137881a1d2bd');
    expect(isPrivateIpv4Host('10.0.0.1')).toBe(true);
    expect(isPrivateIpv4Host('8.8.8.8')).toBe(false);
  });
});

function apiEnvironment() {
  return {
    APP_ENV: 'production',
    AUTH_MODE: 'membership',
    SERVICE_VERSION: '1.0.0',
    API_ALLOWED_ORIGINS: 'https://console.example.com',
    AUTH_RETURN_TARGETS: '{"console":"https://console.example.com","storefront":"https://storefront.example.com"}',
    DATABASE_API_CONNECTION_REF: 'secret/database/api',
    REDIS_CONNECTION_REF: 'secret/redis/query',
    SESSION_KEY_REF: 'secret/session/signing',
    IDENTITY_KEY_REF: 'secret/identity/lookup',
    INVITATION_KEY_REF: 'secret/identity/invitation',
    NAVIGATION_KEY_REF: 'secret/navigation/hmac',
    QUOTE_KEY_REF: 'secret/checkout/quote',
    KMS_ENDPOINT: 'https://kms.internal',
    KMS_BEARER_TOKEN: kmsBearerToken,
    PII_KEY_REF: 'secret/pii/encryption',
    WECHAT_APPLICATION_CONFIG_REF: 'secret/wechat/applications',
    WECHAT_PAYMENT_CONFIG_REF: 'secret/payment/wechat',
    OBJECT_STORE_ENDPOINT: 'https://objects.internal',
    OBJECT_STORE_TOKEN_REF: 'secret/objects/token',
    EXTENSION_MANIFEST_KEY_REF: 'secret/extensions/manifestkey',
    SECRET_STORE_ENDPOINT: 'https://secrets.internal',
    SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken,
  };
}
