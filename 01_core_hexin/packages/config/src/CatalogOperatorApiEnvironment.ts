import { bearerToken, enumValue, integerValue, processEnvironment, requiredValue, type EnvironmentSource } from './Environment';

export const CATALOG_OPERATOR_API_PROFILE = 'catalog-operator-only' as const;

export const CATALOG_OPERATOR_API_ENVIRONMENT_KEYS = Object.freeze([
  'CATALOG_OPERATOR_API_PROFILE',
  'API_PORT',
  'API_BIND_HOST',
  'APP_ENV',
  'SERVICE_VERSION',
  'API_ALLOWED_ORIGINS',
  'DATABASE_API_CONNECTION_REF',
  'DATABASE_API_ROLE',
  'OBJECT_STORE_ENDPOINT',
  'OBJECT_STORE_BEARER_TOKEN',
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

export type CatalogOperatorApiEnvironment = Readonly<Partial<Record<
  (typeof CATALOG_OPERATOR_API_ENVIRONMENT_KEYS)[number], string
>>>;

const CONFIGURATION_KEY = /^(?:API_|APP_ENV$|AUTH_|CATALOG_|DATABASE_|EXTENSION_|IDENTITY_|INVOICE_|JOB_|KMS_|NODE_(?:MANIFEST_|RUNTIME_|RESOURCE_|RELEASE_)|NOTIFICATION_|OBJECT_|PAYMENT_|PAYOUT_|PII_|PUBLIC_|QUOTE_|REDIS_|SECRET_|SESSION_|SERVICE_VERSION$|WECHAT_)/;
const ALLOWED_KEYS = new Set<string>(CATALOG_OPERATOR_API_ENVIRONMENT_KEYS);

export function catalogOperatorApiEnvironment(
  source: EnvironmentSource = processEnvironment(),
): CatalogOperatorApiEnvironment {
  validateCatalogOperatorApiEnvironment(source);
  return Object.freeze(Object.fromEntries(CATALOG_OPERATOR_API_ENVIRONMENT_KEYS
    .flatMap((key) => source[key] === undefined ? [] : [[key, source[key]!]]))) as CatalogOperatorApiEnvironment;
}

export function validateCatalogOperatorApiEnvironment(source: EnvironmentSource): void {
  for (const key of Object.keys(source).filter((candidate) => CONFIGURATION_KEY.test(candidate) && !ALLOWED_KEYS.has(candidate)).sort()) {
    throw new Error(`CATALOG_OPERATOR_API_KEY_FORBIDDEN:${key}`);
  }
  if (requiredValue(source.CATALOG_OPERATOR_API_PROFILE, 'CATALOG_OPERATOR_API_PROFILE_INVALID')
    !== CATALOG_OPERATOR_API_PROFILE) throw new Error('CATALOG_OPERATOR_API_PROFILE_INVALID');
  enumValue(source.APP_ENV, ['development', 'test', 'production'], 'APP_ENV_INVALID');
  for (const [key, code] of [
    ['SERVICE_VERSION', 'SERVICE_VERSION_MISSING'],
    ['DATABASE_API_CONNECTION_REF', 'DATABASE_API_CONNECTION_REF_MISSING'],
    ['DATABASE_API_ROLE', 'DATABASE_API_ROLE_MISSING'],
    ['NODE_MANIFEST_PATH', 'NODE_MANIFEST_PATH_MISSING'],
    ['NODE_MANIFEST_ID', 'NODE_MANIFEST_ID_MISSING'],
    ['NODE_RUNTIME_INSTANCE_ID', 'NODE_RUNTIME_INSTANCE_ID_MISSING'],
    ['NODE_RUNTIME_CONFIG_REF', 'NODE_RUNTIME_CONFIG_REF_MISSING'],
    ['NODE_RESOURCE_BINDING_VERSION', 'NODE_RESOURCE_BINDING_VERSION_MISSING'],
    ['NODE_RELEASE_POINTER_REF', 'NODE_RELEASE_POINTER_REF_MISSING'],
  ] as const) requiredValue(source[key], code);
  if (!/^sha256:[0-9a-f]{64}$/.test(requiredValue(source.NODE_MANIFEST_DIGEST, 'NODE_MANIFEST_DIGEST_INVALID'))) {
    throw new Error('NODE_MANIFEST_DIGEST_INVALID');
  }
  if (source.API_BIND_HOST !== undefined && source.API_BIND_HOST !== '127.0.0.1') throw new Error('CATALOG_OPERATOR_API_BIND_HOST_INVALID');
  const origins = catalogOperatorApiAllowedOrigins(source);
  if (origins.length !== 1) throw new Error('CATALOG_OPERATOR_API_ORIGINS_INVALID');
  secureEndpoint(origins[0], 'CATALOG_OPERATOR_API_ORIGINS_INVALID');
  secureEndpoint(source.OBJECT_STORE_ENDPOINT, 'OBJECT_STORE_ENDPOINT_INVALID');
  secureEndpoint(source.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_INVALID');
  bearerToken(source.OBJECT_STORE_BEARER_TOKEN, 'OBJECT_STORE_BEARER_TOKEN_INVALID');
  bearerToken(source.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_INVALID');
  catalogOperatorApiPort(source);
}

export function catalogOperatorApiPort(environment: CatalogOperatorApiEnvironment | EnvironmentSource): number {
  return integerValue(environment.API_PORT, 4331, 1, 65_535, 'API_PORT_INVALID');
}

export function catalogOperatorApiAllowedOrigins(
  environment: CatalogOperatorApiEnvironment | EnvironmentSource,
): readonly string[] {
  const value = requiredValue(environment.API_ALLOWED_ORIGINS, 'API_ALLOWED_ORIGINS_MISSING');
  const origins = Object.freeze(value.split(',').map((item) => item.trim()).filter(Boolean));
  if (new Set(origins).size !== origins.length) throw new Error('CATALOG_OPERATOR_API_ORIGINS_INVALID');
  return origins;
}

function secureEndpoint(value: string | undefined, code: string): void {
  const endpoint = requiredValue(value, code);
  let parsed: URL;
  try { parsed = new URL(endpoint); } catch { throw new Error(code); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash || parsed.search) throw new Error(code);
}
