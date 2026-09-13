import {
  bearerToken,
  distinctValues,
  enumValue,
  integerValue,
  processEnvironment,
  requiredValue,
  type EnvironmentSource,
} from './Environment';
import { apiAllowedOrigins } from './ApiEnvironment';

export const WEB_BUSINESS_API_PROFILE = 'web-business-only' as const;

export const WEB_BUSINESS_API_ENVIRONMENT_KEYS = Object.freeze([
  'WEB_BUSINESS_API_PROFILE',
  'API_PORT',
  'API_BIND_HOST',
  'APP_ENV',
  'AUTH_MODE',
  'SERVICE_VERSION',
  'API_ALLOWED_ORIGINS',
  'PUBLIC_MALL_SLUG',
  'PUBLIC_MALL_HOST_MAPPINGS',
  'DATABASE_API_CONNECTION_REF',
  'DATABASE_API_ROLE',
  'KMS_ENDPOINT',
  'KMS_BEARER_TOKEN',
  'SECRET_STORE_ENDPOINT',
  'SECRET_STORE_BEARER_TOKEN',
  'NODE_MANIFEST_PATH',
  'NODE_MANIFEST_ID',
  'NODE_MANIFEST_DIGEST',
  'NODE_RUNTIME_INSTANCE_ID',
  'NODE_RUNTIME_CONFIG_REF',
  'NODE_RESOURCE_BINDING_VERSION',
  'NODE_RELEASE_POINTER_REF',
] as const);

export type WebBusinessApiEnvironment = Readonly<Partial<Record<
  (typeof WEB_BUSINESS_API_ENVIRONMENT_KEYS)[number], string
>>>;

const CONFIGURATION_KEY = /^(?:API_|APP_ENV$|AUTH_|DATABASE_|EXTENSION_|IDENTITY_|INVOICE_|JOB_|KMS_|NODE_(?:MANIFEST_|RUNTIME_|RESOURCE_|RELEASE_)|NOTIFICATION_|OBJECT_|PAYMENT_|PAYOUT_|PII_|PUBLIC_|QUOTE_|REDIS_|SECRET_|SESSION_|SERVICE_VERSION$|WEB_BUSINESS_|WECHAT_)/;
const ALLOWED_KEYS = new Set<string>(WEB_BUSINESS_API_ENVIRONMENT_KEYS);

export function webBusinessApiEnvironment(
  source: EnvironmentSource = processEnvironment(),
): WebBusinessApiEnvironment {
  validateWebBusinessApiEnvironment(source);
  return Object.freeze(Object.fromEntries(WEB_BUSINESS_API_ENVIRONMENT_KEYS
    .flatMap((key) => source[key] === undefined ? [] : [[key, source[key]!]]))) as WebBusinessApiEnvironment;
}

export function validateWebBusinessApiEnvironment(source: EnvironmentSource): void {
  for (const key of Object.keys(source).filter((candidate) => CONFIGURATION_KEY.test(candidate) && !ALLOWED_KEYS.has(candidate)).sort()) {
    throw new Error(`WEB_BUSINESS_API_KEY_FORBIDDEN:${key}`);
  }
  if (requiredValue(source.WEB_BUSINESS_API_PROFILE, 'WEB_BUSINESS_API_PROFILE_INVALID')
    !== WEB_BUSINESS_API_PROFILE) throw new Error('WEB_BUSINESS_API_PROFILE_INVALID');
  enumValue(source.APP_ENV, ['development', 'test', 'production'], 'APP_ENV_INVALID');
  if (enumValue(source.AUTH_MODE, ['membership'], 'AUTH_MODE_INVALID') !== 'membership') throw new Error('AUTH_MODE_INVALID');
  for (const [key, code] of [
    ['SERVICE_VERSION', 'SERVICE_VERSION_MISSING'],
    ['API_ALLOWED_ORIGINS', 'API_ALLOWED_ORIGINS_MISSING'],
    ['PUBLIC_MALL_SLUG', 'PUBLIC_MALL_SLUG_MISSING'],
    ['DATABASE_API_CONNECTION_REF', 'DATABASE_API_CONNECTION_REF_MISSING'],
    ['DATABASE_API_ROLE', 'DATABASE_API_ROLE_MISSING'],
    ['KMS_ENDPOINT', 'KMS_ENDPOINT_MISSING'],
    ['SECRET_STORE_ENDPOINT', 'SECRET_STORE_ENDPOINT_MISSING'],
    ['NODE_MANIFEST_PATH', 'NODE_MANIFEST_PATH_MISSING'],
    ['NODE_MANIFEST_ID', 'NODE_MANIFEST_ID_MISSING'],
    ['NODE_RUNTIME_INSTANCE_ID', 'NODE_RUNTIME_INSTANCE_ID_MISSING'],
    ['NODE_RUNTIME_CONFIG_REF', 'NODE_RUNTIME_CONFIG_REF_MISSING'],
    ['NODE_RESOURCE_BINDING_VERSION', 'NODE_RESOURCE_BINDING_VERSION_MISSING'],
    ['NODE_RELEASE_POINTER_REF', 'NODE_RELEASE_POINTER_REF_MISSING'],
  ] as const) requiredValue(source[key], code);
  if (source.API_BIND_HOST !== undefined && source.API_BIND_HOST !== '127.0.0.1') throw new Error('WEB_BUSINESS_API_BIND_HOST_INVALID');
  secureEndpoint(source.KMS_ENDPOINT, 'KMS_ENDPOINT_INVALID');
  secureEndpoint(source.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_INVALID');
  const kmsBearer = bearerToken(source.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_INVALID');
  const secretStoreBearer = bearerToken(source.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_INVALID');
  distinctValues(kmsBearer, secretStoreBearer, 'WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  const origins = apiAllowedOrigins(source);
  if (origins.length === 0 || new Set(origins).size !== origins.length) throw new Error('WEB_BUSINESS_API_ORIGINS_INVALID');
  for (const origin of origins) secureEndpoint(origin, 'WEB_BUSINESS_API_ORIGINS_INVALID');
  if (!/^sha256:[0-9a-f]{64}$/.test(requiredValue(source.NODE_MANIFEST_DIGEST, 'NODE_MANIFEST_DIGEST_INVALID'))) {
    throw new Error('NODE_MANIFEST_DIGEST_INVALID');
  }
  webBusinessApiPort(source);
  if (!validPublicMallSlug(source.PUBLIC_MALL_SLUG!)) throw new Error('PUBLIC_MALL_SLUG_INVALID');
  webBusinessApiPublicMallHostMappings(source);
}

export function webBusinessApiPort(environment: WebBusinessApiEnvironment): number {
  return integerValue(environment.API_PORT, 4322, 1, 65_535, 'API_PORT_INVALID');
}

export function webBusinessApiAllowedOrigins(environment: WebBusinessApiEnvironment): readonly string[] {
  return apiAllowedOrigins(environment);
}

export function webBusinessApiPublicMallSlug(environment: WebBusinessApiEnvironment): string {
  return requiredValue(environment.PUBLIC_MALL_SLUG, 'PUBLIC_MALL_SLUG_MISSING');
}

export function webBusinessApiPublicMallHostMappings(
  environment: WebBusinessApiEnvironment,
): Readonly<Record<string, string>> {
  const mappings: Record<string, string> = {};
  for (const entry of (environment.PUBLIC_MALL_HOST_MAPPINGS ?? '').split(',').map((value) => value.trim()).filter(Boolean)) {
    const separator = entry.indexOf('=');
    const host = entry.slice(0, separator).trim().toLowerCase();
    const slug = entry.slice(separator + 1).trim();
    if (separator < 1 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)
      || !validPublicMallSlug(slug) || mappings[host] !== undefined) {
      throw new Error('PUBLIC_MALL_HOST_MAPPINGS_INVALID');
    }
    mappings[host] = slug;
  }
  return Object.freeze(mappings);
}

function validPublicMallSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{2,47}$/.test(value) || /^h[0-9]+$/.test(value);
}

function secureEndpoint(value: string | undefined, code: string): void {
  const endpoint = requiredValue(value, code);
  let parsed: URL;
  try { parsed = new URL(endpoint); } catch { throw new Error(code); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash || parsed.search) throw new Error(code);
}
