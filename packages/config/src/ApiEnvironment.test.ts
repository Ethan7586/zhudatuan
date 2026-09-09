import { describe, expect, it } from 'vitest';
import { apiChallengeCodeRef, validateApiEnvironment } from './ApiEnvironment';
import { CLIENT_ORIGINS } from './ClientCatalog';

const secretStoreBearer = 's'.repeat(43);
const kmsBearer = 'k'.repeat(43);

describe('API challenge code environment', () => {
  it('allows a secret reference only outside production', () => {
    expect(apiChallengeCodeRef({ APP_ENV: 'development', IDENTITY_CHALLENGE_CODE_REF: 'local/identity/challenge-code' })).toBe('local/identity/challenge-code');
    expect(apiChallengeCodeRef({ APP_ENV: 'development' })).toBeNull();
    expect(() => apiChallengeCodeRef({ APP_ENV: 'production', IDENTITY_CHALLENGE_CODE_REF: 'local/identity/challenge-code' })).toThrow('PRODUCTION_FIXED_CHALLENGE_CODE_FORBIDDEN');
    expect(() => apiChallengeCodeRef({ APP_ENV: 'test', IDENTITY_CHALLENGE_CODE_REF: 'local/identity/challenge-code' })).toThrow('NONLOCAL_FIXED_CHALLENGE_CODE_FORBIDDEN');
    expect(() => apiChallengeCodeRef({ APP_ENV: 'development', IDENTITY_CHALLENGE_CODE_REF: 'secret/identity/challenge-code' })).toThrow('NONLOCAL_FIXED_CHALLENGE_CODE_FORBIDDEN');
  });

  it('rejects fixed challenge configuration during production startup validation', () => {
    expect(() => validateApiEnvironment({ ...productionEnvironment(), IDENTITY_CHALLENGE_CODE_REF: 'secret/identity/fixed-code' })).toThrow('PRODUCTION_FIXED_CHALLENGE_CODE_FORBIDDEN');
  });
});

function productionEnvironment() {
  return {
    APP_ENV: 'production',
    AUTH_MODE: 'membership',
    SERVICE_VERSION: '1.0.0',
    API_ALLOWED_ORIGINS: Object.values(CLIENT_ORIGINS).join(','),
    AUTH_RETURN_TARGETS: JSON.stringify(CLIENT_ORIGINS),
    PUBLIC_STOREFRONT_ORIGIN: CLIENT_ORIGINS.storefront,
    DATABASE_API_CONNECTION_REF: 'secret/database/api',
    REDIS_CONNECTION_REF: 'secret/redis/query',
    SESSION_KEY_REF: 'secret/session/signing',
    IDENTITY_KEY_REF: 'secret/identity/lookup',
    INVITATION_KEY_REF: 'secret/identity/invitation',
    NAVIGATION_KEY_REF: 'secret/navigation/hmac',
    QUOTE_KEY_REF: 'secret/checkout/quote',
    KMS_ENDPOINT: 'https://kms.internal',
    KMS_BEARER_TOKEN: kmsBearer,
    PII_KEY_REF: 'secret/pii/encryption',
    WECHAT_APPLICATION_CONFIG_REF: 'secret/wechat/applications',
    WECHAT_PAYMENT_CONFIG_REF: 'secret/payment/wechat',
    OBJECT_STORE_ENDPOINT: 'https://objects.internal',
    OBJECT_STORE_TOKEN_REF: 'secret/objects/token',
    EXTENSION_MANIFEST_KEY_REF: 'secret/extensions/manifestkey',
    SECRET_STORE_ENDPOINT: 'https://secrets.internal',
    SECRET_STORE_BEARER_TOKEN: secretStoreBearer,
  };
}
