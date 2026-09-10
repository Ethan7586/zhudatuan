import { bearerToken, distinctValues, enumValue, integerValue, pickEnvironment, processEnvironment, requiredValue, type EnvironmentSource } from './Environment';
import type { AuthTarget } from './ClientEnvironment';
import { CLIENT_ORIGINS, CLIENT_TARGETS } from './ClientCatalog';
import { NETWORK_CATALOG } from './NetworkCatalog';

export const API_ENVIRONMENT_KEYS = [
  'API_PORT',
  'API_BIND_HOST',
  'APP_ENV',
  'SERVICE_VERSION',
  'AUTH_MODE',
  'API_ALLOWED_ORIGINS',
  'AUTH_RETURN_TARGETS',
  'PUBLIC_STOREFRONT_ORIGIN',
  'DATABASE_API_CONNECTION_REF',
  'REDIS_CONNECTION_REF',
  'SESSION_KEY_REF',
  'IDENTITY_KEY_REF',
  'IDENTITY_CHALLENGE_CODE_REF',
  'INVITATION_KEY_REF',
  'NAVIGATION_KEY_REF',
  'QUOTE_KEY_REF',
  'KMS_ENDPOINT',
  'KMS_BEARER_TOKEN',
  'PII_KEY_REF',
  'WECHAT_APPLICATION_CONFIG_REF',
  'WECHAT_PAYMENT_CONFIG_REF',
  'OBJECT_STORE_ENDPOINT',
  'OBJECT_STORE_TOKEN_REF',
  'EXTENSION_MANIFEST_KEY_REF',
  'PUBLIC_MEDIA_BASE_URL',
  'SECRET_STORE_ENDPOINT',
  'SECRET_STORE_BEARER_TOKEN',
] as const;

export type ApiEnvironment = Readonly<Partial<Record<(typeof API_ENVIRONMENT_KEYS)[number], string>>>;

export function apiEnvironment(): ApiEnvironment {
  const environment = pickEnvironment(processEnvironment(), API_ENVIRONMENT_KEYS);
  validateApiEnvironment(environment);
  return environment;
}

export function apiPort(environment: ApiEnvironment): number {
  return integerValue(environment.API_PORT, 3001, 1, 65_535, 'API_PORT_INVALID');
}

export function apiBindHost(environment: ApiEnvironment): '127.0.0.1' | '0.0.0.0' {
  const value = environment.API_BIND_HOST?.trim() || '127.0.0.1';
  if (value !== '127.0.0.1' && value !== '0.0.0.0') throw new Error('API_BIND_HOST_INVALID');
  return value;
}

export function apiAllowedOrigins(environment: ApiEnvironment): readonly string[] {
  const values = requiredValue(environment.API_ALLOWED_ORIGINS, 'API_ALLOWED_ORIGINS_MISSING')
    .split(',')
    .map((value) => value.trim());
  if (values.length === 0 || values.some((value) => !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(value) && !/^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/.test(value))) throw new Error('API_ALLOWED_ORIGINS_INVALID');
  return Object.freeze([...new Set(values)]);
}

export type AuthReturnTargets = Readonly<Record<AuthTarget, string>>;

export function apiReturnTargets(environment: ApiEnvironment): AuthReturnTargets {
  const raw = requiredValue(environment.AUTH_RETURN_TARGETS, 'AUTH_RETURN_TARGETS_MISSING');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('AUTH_RETURN_TARGETS_INVALID');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('AUTH_RETURN_TARGETS_INVALID');
  const record = parsed as Readonly<Record<string, unknown>>;
  const keys: readonly AuthTarget[] = CLIENT_TARGETS;
  if (Object.keys(record).sort().join(',') !== [...keys].sort().join(',')) throw new Error('AUTH_RETURN_TARGETS_INVALID');
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, webUrl(record[key])])) as Record<AuthTarget, string>);
}

export function apiStorefrontOrigin(environment: ApiEnvironment): string {
  return webOrigin(requiredValue(environment.PUBLIC_STOREFRONT_ORIGIN, 'PUBLIC_STOREFRONT_ORIGIN_MISSING'), 'PUBLIC_STOREFRONT_ORIGIN_INVALID');
}

export function apiChallengeCodeRef(environment: ApiEnvironment): string | null {
  const value = environment.IDENTITY_CHALLENGE_CODE_REF?.trim();
  if (!value) return null;
  if (environment.APP_ENV === 'production') throw new Error('PRODUCTION_FIXED_CHALLENGE_CODE_FORBIDDEN');
  if (environment.APP_ENV !== 'development' || !value.startsWith('local/')) throw new Error('NONLOCAL_FIXED_CHALLENGE_CODE_FORBIDDEN');
  if (!/^[a-z0-9][a-z0-9/.-]{2,255}$/.test(value)) throw new Error('IDENTITY_CHALLENGE_CODE_REF_INVALID');
  return value;
}

export function validateApiEnvironment(source: ApiEnvironment | EnvironmentSource): void {
  const app = enumValue(source.APP_ENV, ['development', 'test', 'production'], 'APP_ENV_INVALID');
  const auth = enumValue(source.AUTH_MODE, ['test', 'membership'], 'AUTH_MODE_INVALID');
  if (app === 'production' && auth !== 'membership') throw new Error('PRODUCTION_AUTH_MODE_INVALID');
  apiChallengeCodeRef(source);
  for (const [key, code] of [
    ['SERVICE_VERSION', 'SERVICE_VERSION_MISSING'],
    ['API_ALLOWED_ORIGINS', 'API_ALLOWED_ORIGINS_MISSING'],
    ['AUTH_RETURN_TARGETS', 'AUTH_RETURN_TARGETS_MISSING'],
    ['PUBLIC_STOREFRONT_ORIGIN', 'PUBLIC_STOREFRONT_ORIGIN_MISSING'],
    ['DATABASE_API_CONNECTION_REF', 'DATABASE_API_CONNECTION_REF_MISSING'],
    ['REDIS_CONNECTION_REF', 'REDIS_CONNECTION_REF_MISSING'],
    ['SESSION_KEY_REF', 'SESSION_KEY_REF_MISSING'],
    ['IDENTITY_KEY_REF', 'IDENTITY_KEY_REF_MISSING'],
    ['INVITATION_KEY_REF', 'INVITATION_KEY_REF_MISSING'],
    ['NAVIGATION_KEY_REF', 'NAVIGATION_KEY_REF_MISSING'],
    ['QUOTE_KEY_REF', 'QUOTE_KEY_REF_MISSING'],
    ['PII_KEY_REF', 'PII_KEY_REF_MISSING'],
    ['WECHAT_APPLICATION_CONFIG_REF', 'WECHAT_APPLICATION_CONFIG_REF_MISSING'],
    ['WECHAT_PAYMENT_CONFIG_REF', 'WECHAT_PAYMENT_CONFIG_REF_MISSING'],
    ['OBJECT_STORE_ENDPOINT', 'OBJECT_STORE_ENDPOINT_MISSING'],
    ['OBJECT_STORE_TOKEN_REF', 'OBJECT_STORE_TOKEN_REF_MISSING'],
    ['EXTENSION_MANIFEST_KEY_REF', 'EXTENSION_MANIFEST_KEY_REF_MISSING'],
    ['KMS_ENDPOINT', 'KMS_ENDPOINT_MISSING'],
    ['SECRET_STORE_ENDPOINT', 'SECRET_STORE_ENDPOINT_MISSING'],
  ] as const)
    requiredValue(source[key], code);
  const kmsBearer = bearerToken(source.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_INVALID');
  const secretStoreBearer = bearerToken(source.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_INVALID');
  distinctValues(kmsBearer, secretStoreBearer, 'WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  if (app === 'production') validateProductionNetwork(source);
}

function validateProductionNetwork(source: ApiEnvironment | EnvironmentSource): void {
  const allowed = apiAllowedOrigins(source).slice().sort();
  const expectedAllowed = Object.values(CLIENT_ORIGINS).sort();
  if (allowed.join(',') !== expectedAllowed.join(',')) throw new Error('PRODUCTION_ALLOWED_ORIGINS_INVALID');
  const targets = apiReturnTargets(source);
  if (CLIENT_TARGETS.some((target) => targets[target] !== CLIENT_ORIGINS[target])) throw new Error('PRODUCTION_RETURN_TARGETS_INVALID');
  if (apiStorefrontOrigin(source) !== NETWORK_CATALOG.origins.storefront) throw new Error('PRODUCTION_STOREFRONT_ORIGIN_INVALID');
}

function webUrl(value: unknown): string {
  if (typeof value !== 'string' || (!/^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/.*)?$/i.test(value) && !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/.*)?$/.test(value))) throw new Error('AUTH_RETURN_TARGETS_INVALID');
  const url = new URL(value);
  if (url.username || url.password || url.hash) throw new Error('AUTH_RETURN_TARGETS_INVALID');
  return url.toString().replace(/\/$/, '');
}

function webOrigin(value: string, code: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(code);
  }
  const secure = url.protocol === 'https:';
  const local = url.protocol === 'http:' && url.hostname === '127.0.0.1';
  if (!secure && !local) throw new Error(code);
  if (url.username || url.password || url.hash || url.search || (url.pathname !== '/' && url.pathname !== '')) throw new Error(code);
  return url.origin;
}
