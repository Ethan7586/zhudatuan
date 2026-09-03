import { bearerToken, distinctValues, enumValue, integerValue, processEnvironment, requiredValue, type EnvironmentSource } from './Environment';
import { apiAllowedOrigins, apiReturnTargets, type AuthReturnTargets } from './ApiEnvironment';

export const IDENTITY_REGISTRATION_API_PROFILE = 'registration-only' as const;

const PRODUCTION_ALLOWED_ORIGINS = Object.freeze([
  'https://accounts.zhudatuan.com',
  'https://console.zhudatuan.com',
  'https://hbbtzn.com',
  'https://mall.hbbtzn.com',
  'https://www.hbbtzn.com',
  'https://zhudatuan.com',
] as const);

const PRODUCTION_RETURN_TARGETS = Object.freeze({
  console: 'https://console.zhudatuan.com',
  storefront: 'https://zhudatuan.com',
  store: 'https://console.zhudatuan.com/entrances/store',
  supplier: 'https://console.zhudatuan.com/entrances/supplier',
} satisfies AuthReturnTargets);

export const IDENTITY_REGISTRATION_API_ENVIRONMENT_KEYS = Object.freeze([
  'IDENTITY_REGISTRATION_API_PROFILE',
  'API_PORT',
  'API_BIND_HOST',
  'APP_ENV',
  'AUTH_MODE',
  'SERVICE_VERSION',
  'API_ALLOWED_ORIGINS',
  'AUTH_RETURN_TARGETS',
  'DATABASE_API_CONNECTION_REF',
  'SESSION_KEY_REF',
  'IDENTITY_KEY_REF',
  'WECHAT_APPLICATION_CONFIG_REF',
  'WECHAT_IDENTITY_CONFIG_REF',
  'KMS_ENDPOINT',
  'KMS_BEARER_TOKEN',
  'SECRET_STORE_ENDPOINT',
  'SECRET_STORE_BEARER_TOKEN',
] as const);

export type IdentityRegistrationApiEnvironment = Readonly<Partial<Record<
  (typeof IDENTITY_REGISTRATION_API_ENVIRONMENT_KEYS)[number], string
>>>;

const CONFIGURATION_KEY = /^(?:API_|APP_ENV$|AUTH_|DATABASE_|EXTENSION_|IDENTITY_|INVOICE_|JOB_|KMS_|NOTIFICATION_|OBJECT_|PAYMENT_|PAYOUT_|PII_|PUBLIC_|QUOTE_|REDIS_|SECRET_|SESSION_|SERVICE_VERSION$|WECHAT_)/;
const ALLOWED_KEYS = new Set<string>(IDENTITY_REGISTRATION_API_ENVIRONMENT_KEYS);

export function identityRegistrationApiEnvironment(
  source: EnvironmentSource = processEnvironment(),
): IdentityRegistrationApiEnvironment {
  validateIdentityRegistrationApiEnvironment(source);
  return Object.freeze(Object.fromEntries(IDENTITY_REGISTRATION_API_ENVIRONMENT_KEYS
    .flatMap((key) => source[key] === undefined ? [] : [[key, source[key]!]]))) as IdentityRegistrationApiEnvironment;
}

export function validateIdentityRegistrationApiEnvironment(source: EnvironmentSource): void {
  for (const key of Object.keys(source).filter((candidate) => CONFIGURATION_KEY.test(candidate) && !ALLOWED_KEYS.has(candidate)).sort()) {
    throw new Error(`IDENTITY_REGISTRATION_API_KEY_FORBIDDEN:${key}`);
  }
  if (requiredValue(source.IDENTITY_REGISTRATION_API_PROFILE, 'IDENTITY_REGISTRATION_API_PROFILE_INVALID')
    !== IDENTITY_REGISTRATION_API_PROFILE) throw new Error('IDENTITY_REGISTRATION_API_PROFILE_INVALID');
  const app = enumValue(source.APP_ENV, ['development', 'test', 'production'], 'APP_ENV_INVALID');
  if (enumValue(source.AUTH_MODE, ['membership'], 'AUTH_MODE_INVALID') !== 'membership') throw new Error('AUTH_MODE_INVALID');
  for (const [key, code] of [
    ['SERVICE_VERSION', 'SERVICE_VERSION_MISSING'],
    ['API_ALLOWED_ORIGINS', 'API_ALLOWED_ORIGINS_MISSING'],
    ['AUTH_RETURN_TARGETS', 'AUTH_RETURN_TARGETS_MISSING'],
    ['DATABASE_API_CONNECTION_REF', 'DATABASE_API_CONNECTION_REF_MISSING'],
    ['SESSION_KEY_REF', 'SESSION_KEY_REF_MISSING'],
    ['IDENTITY_KEY_REF', 'IDENTITY_KEY_REF_MISSING'],
    ['WECHAT_APPLICATION_CONFIG_REF', 'WECHAT_APPLICATION_CONFIG_REF_MISSING'],
    ['WECHAT_IDENTITY_CONFIG_REF', 'WECHAT_IDENTITY_CONFIG_REF_MISSING'],
    ['KMS_ENDPOINT', 'KMS_ENDPOINT_MISSING'],
    ['SECRET_STORE_ENDPOINT', 'SECRET_STORE_ENDPOINT_MISSING'],
  ] as const) requiredValue(source[key], code);
  if (source.API_BIND_HOST !== undefined && source.API_BIND_HOST !== '127.0.0.1') throw new Error('IDENTITY_REGISTRATION_API_BIND_HOST_INVALID');
  secureEndpoint(source.KMS_ENDPOINT, 'KMS_ENDPOINT_INVALID');
  secureEndpoint(source.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_INVALID');
  const kmsBearer = bearerToken(source.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_INVALID');
  const secretStoreBearer = bearerToken(source.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_INVALID');
  distinctValues(kmsBearer, secretStoreBearer, 'WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  const origins = apiAllowedOrigins(source);
  const returnTargets = apiReturnTargets(source);
  if (app === 'production' && [...origins].sort().join(',') !== [...PRODUCTION_ALLOWED_ORIGINS].sort().join(',')) {
    throw new Error('IDENTITY_REGISTRATION_API_ORIGINS_INVALID');
  }
  if (app === 'production' && Object.keys(PRODUCTION_RETURN_TARGETS).some((target) =>
    returnTargets[target as keyof AuthReturnTargets] !== PRODUCTION_RETURN_TARGETS[target as keyof AuthReturnTargets])) {
    throw new Error('IDENTITY_REGISTRATION_API_RETURN_TARGETS_INVALID');
  }
  identityRegistrationApiPort(source);
}

export function identityRegistrationApiPort(environment: IdentityRegistrationApiEnvironment): number {
  return integerValue(environment.API_PORT, 4321, 1, 65_535, 'API_PORT_INVALID');
}

export function identityRegistrationApiAllowedOrigins(environment: IdentityRegistrationApiEnvironment): readonly string[] {
  return apiAllowedOrigins(environment);
}

export function identityRegistrationApiReturnTargets(environment: IdentityRegistrationApiEnvironment): AuthReturnTargets {
  return apiReturnTargets(environment);
}

function secureEndpoint(value: string | undefined, code: string): void {
  const endpoint = requiredValue(value, code);
  let parsed: URL;
  try { parsed = new URL(endpoint); } catch { throw new Error(code); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash || parsed.search) throw new Error(code);
}
