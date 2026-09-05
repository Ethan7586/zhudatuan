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
const PRODUCTION_ALLOWED_ORIGINS = Object.freeze([
  'https://console.zhudatuan.com',
  'https://hbbtzn.com',
  'https://mall.hbbtzn.com',
  'https://www.hbbtzn.com',
  'https://zhudatuan.com',
]);
const INTERNAL_ALLOWED_ORIGINS = Object.freeze([...PRODUCTION_ALLOWED_ORIGINS, 'https://internal.zhudatuan.com']);

export const WEB_BUSINESS_API_ENVIRONMENT_KEYS = Object.freeze([
  'WEB_BUSINESS_API_PROFILE',
  'API_PORT',
  'API_BIND_HOST',
  'APP_ENV',
  'AUTH_MODE',
  'SERVICE_VERSION',
  'API_ALLOWED_ORIGINS',
  'PUBLIC_MALL_SLUG',
  'DATABASE_API_CONNECTION_REF',
  'KMS_ENDPOINT',
  'KMS_BEARER_TOKEN',
  'SECRET_STORE_ENDPOINT',
  'SECRET_STORE_BEARER_TOKEN',
] as const);

export type WebBusinessApiEnvironment = Readonly<Partial<Record<
  (typeof WEB_BUSINESS_API_ENVIRONMENT_KEYS)[number], string
>>>;

const CONFIGURATION_KEY = /^(?:API_|APP_ENV$|AUTH_|DATABASE_|EXTENSION_|IDENTITY_|INVOICE_|JOB_|KMS_|NOTIFICATION_|OBJECT_|PAYMENT_|PAYOUT_|PII_|PUBLIC_|QUOTE_|REDIS_|SECRET_|SESSION_|SERVICE_VERSION$|WEB_BUSINESS_|WECHAT_)/;
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
  const app = enumValue(source.APP_ENV, ['development', 'test', 'production'], 'APP_ENV_INVALID');
  if (enumValue(source.AUTH_MODE, ['membership'], 'AUTH_MODE_INVALID') !== 'membership') throw new Error('AUTH_MODE_INVALID');
  for (const [key, code] of [
    ['SERVICE_VERSION', 'SERVICE_VERSION_MISSING'],
    ['API_ALLOWED_ORIGINS', 'API_ALLOWED_ORIGINS_MISSING'],
    ['PUBLIC_MALL_SLUG', 'PUBLIC_MALL_SLUG_MISSING'],
    ['DATABASE_API_CONNECTION_REF', 'DATABASE_API_CONNECTION_REF_MISSING'],
    ['KMS_ENDPOINT', 'KMS_ENDPOINT_MISSING'],
    ['SECRET_STORE_ENDPOINT', 'SECRET_STORE_ENDPOINT_MISSING'],
  ] as const) requiredValue(source[key], code);
  if (source.API_BIND_HOST !== undefined && source.API_BIND_HOST !== '127.0.0.1') throw new Error('WEB_BUSINESS_API_BIND_HOST_INVALID');
  secureEndpoint(source.KMS_ENDPOINT, 'KMS_ENDPOINT_INVALID');
  secureEndpoint(source.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_INVALID');
  const kmsBearer = bearerToken(source.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_INVALID');
  const secretStoreBearer = bearerToken(source.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_INVALID');
  distinctValues(kmsBearer, secretStoreBearer, 'WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  const origins = apiAllowedOrigins(source);
  const normalizedOrigins = [...origins].sort().join(',');
  if (app === 'production' && ![PRODUCTION_ALLOWED_ORIGINS, INTERNAL_ALLOWED_ORIGINS]
    .some((allowed) => normalizedOrigins === [...allowed].sort().join(','))) throw new Error('WEB_BUSINESS_API_ORIGINS_INVALID');
  if (![4322, 4422].includes(webBusinessApiPort(source))) throw new Error('WEB_BUSINESS_API_PORT_INVALID');
  if (!/^[a-z0-9][a-z0-9-]{2,47}$/.test(source.PUBLIC_MALL_SLUG!)) throw new Error('PUBLIC_MALL_SLUG_INVALID');
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

function secureEndpoint(value: string | undefined, code: string): void {
  const endpoint = requiredValue(value, code);
  let parsed: URL;
  try { parsed = new URL(endpoint); } catch { throw new Error(code); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash || parsed.search) throw new Error(code);
}
