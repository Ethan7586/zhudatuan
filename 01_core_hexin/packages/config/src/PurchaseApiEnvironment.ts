import {
  bearerToken,
  enumValue,
  integerValue,
  processEnvironment,
  requiredValue,
  type EnvironmentSource,
} from './Environment';
import { apiAllowedOrigins } from './ApiEnvironment';
import { nodeManifestDeclarationByManifestId } from './SflNodeRegistry';

export const PURCHASE_API_PROFILE = 'purchase-only' as const;

const PURCHASE_PAYMENT_PROVIDER_KEYS = Object.freeze([
  'KMS_ENDPOINT',
  'KMS_BEARER_TOKEN',
  'WECHAT_APPLICATION_CONFIG_REF',
  'WECHAT_PAYMENT_CONFIG_REF',
] as const);

export const PURCHASE_API_ENVIRONMENT_KEYS = Object.freeze([
  'PURCHASE_API_PROFILE',
  'API_PORT',
  'API_BIND_HOST',
  'APP_ENV',
  'AUTH_MODE',
  'SERVICE_VERSION',
  'API_ALLOWED_ORIGINS',
  'DATABASE_API_CONNECTION_REF',
  'DATABASE_API_ROLE',
  'QUOTE_KEY_REF',
  'SECRET_STORE_ENDPOINT',
  'SECRET_STORE_BEARER_TOKEN',
  'KMS_ENDPOINT',
  'KMS_BEARER_TOKEN',
  'WECHAT_APPLICATION_CONFIG_REF',
  'WECHAT_PAYMENT_CONFIG_REF',
  'NODE_MANIFEST_PATH',
  'NODE_MANIFEST_ID',
  'NODE_MANIFEST_DIGEST',
  'NODE_RUNTIME_INSTANCE_ID',
  'NODE_RUNTIME_CONFIG_REF',
  'NODE_RESOURCE_BINDING_VERSION',
  'NODE_RELEASE_POINTER_REF',
] as const);

export type PurchaseApiEnvironment = Readonly<Partial<Record<
  (typeof PURCHASE_API_ENVIRONMENT_KEYS)[number], string
>>>;

const CONFIGURATION_KEY = /^(?:API_|APP_ENV$|AUTH_|DATABASE_|EXTENSION_|IDENTITY_|INVOICE_|JOB_|KMS_|NODE_(?:MANIFEST_|RUNTIME_|RESOURCE_|RELEASE_)|NOTIFICATION_|OBJECT_|PAYMENT_|PAYOUT_|PII_|PUBLIC_|PURCHASE_|QUOTE_|REDIS_|SECRET_|SESSION_|SERVICE_VERSION$|WEB_BUSINESS_|WECHAT_)/;
const ALLOWED_KEYS = new Set<string>(PURCHASE_API_ENVIRONMENT_KEYS);

export function purchaseApiEnvironment(
  source: EnvironmentSource = processEnvironment(),
): PurchaseApiEnvironment {
  validatePurchaseApiEnvironment(source);
  return Object.freeze(Object.fromEntries(PURCHASE_API_ENVIRONMENT_KEYS
    .flatMap((key) => source[key] === undefined ? [] : [[key, source[key]!]]))) as PurchaseApiEnvironment;
}

export function validatePurchaseApiEnvironment(source: EnvironmentSource): void {
  for (const key of Object.keys(source).filter((candidate) => CONFIGURATION_KEY.test(candidate) && !ALLOWED_KEYS.has(candidate)).sort()) {
    throw new Error(`PURCHASE_API_KEY_FORBIDDEN:${key}`);
  }
  if (requiredValue(source.PURCHASE_API_PROFILE, 'PURCHASE_API_PROFILE_INVALID')
    !== PURCHASE_API_PROFILE) throw new Error('PURCHASE_API_PROFILE_INVALID');
  const app = enumValue(source.APP_ENV, ['development', 'test', 'production'], 'APP_ENV_INVALID');
  if (enumValue(source.AUTH_MODE, ['membership'], 'AUTH_MODE_INVALID') !== 'membership') throw new Error('AUTH_MODE_INVALID');
  for (const [key, code] of [
    ['SERVICE_VERSION', 'SERVICE_VERSION_MISSING'],
    ['API_ALLOWED_ORIGINS', 'API_ALLOWED_ORIGINS_MISSING'],
    ['DATABASE_API_CONNECTION_REF', 'DATABASE_API_CONNECTION_REF_MISSING'],
    ['DATABASE_API_ROLE', 'DATABASE_API_ROLE_MISSING'],
    ['QUOTE_KEY_REF', 'QUOTE_KEY_REF_MISSING'],
    ['SECRET_STORE_ENDPOINT', 'SECRET_STORE_ENDPOINT_MISSING'],
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
  const paymentProviderEnabled = purchasePaymentProviderEnabled(source);
  if (source.API_BIND_HOST !== undefined && source.API_BIND_HOST !== '127.0.0.1') throw new Error('PURCHASE_API_BIND_HOST_INVALID');
  secureEndpoint(source.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_INVALID');
  if (paymentProviderEnabled) secureEndpoint(source.KMS_ENDPOINT, 'KMS_ENDPOINT_INVALID');
  if (app === 'production' && source.SECRET_STORE_ENDPOINT !== 'https://127.0.0.1:8543') {
    throw new Error('PURCHASE_API_SECRET_STORE_ENDPOINT_INVALID');
  }
  bearerToken(source.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_INVALID');
  if (paymentProviderEnabled) bearerToken(source.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_INVALID');
  const origins = apiAllowedOrigins(source);
  const manifest = nodeManifestDeclarationByManifestId(source.NODE_MANIFEST_ID!);
  const expectedOrigins = manifest.domain_bindings
    .filter((binding) => binding.surface_ref === 'surface:storefront')
    .map((binding) => `https://${binding.host}`)
    .sort();
  if (app === 'production' && [...origins].sort().join(',') !== expectedOrigins.join(',')) {
    throw new Error('PURCHASE_API_ORIGINS_INVALID');
  }
  if (![4323, 4423, 4434].includes(purchaseApiPort(source))) throw new Error('PURCHASE_API_PORT_INVALID');
}

export function purchasePaymentProviderEnabled(source: EnvironmentSource): boolean {
  const configured = PURCHASE_PAYMENT_PROVIDER_KEYS.filter((key) => source[key]?.trim()).length;
  if (configured === 0) return false;
  if (configured !== PURCHASE_PAYMENT_PROVIDER_KEYS.length) throw new Error('PURCHASE_PAYMENT_CONFIGURATION_PARTIAL');
  return true;
}

export function purchaseApiPort(environment: PurchaseApiEnvironment): number {
  return integerValue(environment.API_PORT, 4323, 1, 65_535, 'API_PORT_INVALID');
}

export function purchaseApiAllowedOrigins(environment: PurchaseApiEnvironment): readonly string[] {
  return apiAllowedOrigins(environment);
}

function secureEndpoint(value: string | undefined, code: string): void {
  const endpoint = requiredValue(value, code);
  let parsed: URL;
  try { parsed = new URL(endpoint); } catch { throw new Error(code); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash || parsed.search) throw new Error(code);
}
