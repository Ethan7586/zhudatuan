import {
  bearerToken,
  enumValue,
  integerValue,
  processEnvironment,
  requiredValue,
  type EnvironmentSource,
} from './Environment';

export const PAYMENT_WEBHOOK_API_PROFILE = 'payment-webhook-only' as const;

export const PAYMENT_WEBHOOK_API_ENVIRONMENT_KEYS = Object.freeze([
  'PAYMENT_WEBHOOK_API_PROFILE',
  'API_PORT',
  'API_BIND_HOST',
  'APP_ENV',
  'SERVICE_VERSION',
  'DATABASE_API_CONNECTION_REF',
  'DATABASE_API_ROLE',
  'SECRET_STORE_ENDPOINT',
  'SECRET_STORE_BEARER_TOKEN',
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

export type PaymentWebhookApiEnvironment = Readonly<Partial<Record<
  (typeof PAYMENT_WEBHOOK_API_ENVIRONMENT_KEYS)[number], string
>>>;

const CONFIGURATION_KEY = /^(?:API_|APP_ENV$|AUTH_|DATABASE_|KMS_|NODE_(?:MANIFEST_|RUNTIME_|RESOURCE_|RELEASE_)|PAYMENT_|PURCHASE_|QUOTE_|SECRET_|SERVICE_VERSION$|WECHAT_)/;
const ALLOWED_KEYS = new Set<string>(PAYMENT_WEBHOOK_API_ENVIRONMENT_KEYS);

export function paymentWebhookApiEnvironment(
  source: EnvironmentSource = processEnvironment(),
): PaymentWebhookApiEnvironment {
  validatePaymentWebhookApiEnvironment(source);
  return Object.freeze(Object.fromEntries(PAYMENT_WEBHOOK_API_ENVIRONMENT_KEYS
    .flatMap((key) => source[key] === undefined ? [] : [[key, source[key]!]]))) as PaymentWebhookApiEnvironment;
}

export function validatePaymentWebhookApiEnvironment(source: EnvironmentSource): void {
  for (const key of Object.keys(source).filter((candidate) => CONFIGURATION_KEY.test(candidate) && !ALLOWED_KEYS.has(candidate)).sort()) {
    throw new Error(`PAYMENT_WEBHOOK_API_KEY_FORBIDDEN:${key}`);
  }
  if (requiredValue(source.PAYMENT_WEBHOOK_API_PROFILE, 'PAYMENT_WEBHOOK_API_PROFILE_INVALID')
    !== PAYMENT_WEBHOOK_API_PROFILE) throw new Error('PAYMENT_WEBHOOK_API_PROFILE_INVALID');
  const app = enumValue(source.APP_ENV, ['development', 'test', 'production'], 'APP_ENV_INVALID');
  for (const [key, code] of [
    ['SERVICE_VERSION', 'SERVICE_VERSION_MISSING'],
    ['DATABASE_API_CONNECTION_REF', 'DATABASE_API_CONNECTION_REF_MISSING'],
    ['DATABASE_API_ROLE', 'DATABASE_API_ROLE_MISSING'],
    ['SECRET_STORE_ENDPOINT', 'SECRET_STORE_ENDPOINT_MISSING'],
    ['WECHAT_APPLICATION_CONFIG_REF', 'WECHAT_APPLICATION_CONFIG_REF_MISSING'],
    ['WECHAT_PAYMENT_CONFIG_REF', 'WECHAT_PAYMENT_CONFIG_REF_MISSING'],
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
  if (source.API_BIND_HOST !== undefined && source.API_BIND_HOST !== '127.0.0.1') {
    throw new Error('PAYMENT_WEBHOOK_API_BIND_HOST_INVALID');
  }
  secureEndpoint(source.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_INVALID');
  if (app === 'production' && source.SECRET_STORE_ENDPOINT !== 'https://127.0.0.1:8543') {
    throw new Error('PAYMENT_WEBHOOK_API_SECRET_STORE_ENDPOINT_INVALID');
  }
  bearerToken(source.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_INVALID');
  paymentWebhookApiPort(source);
}

export function paymentWebhookApiPort(environment: PaymentWebhookApiEnvironment): number {
  return integerValue(environment.API_PORT, 4326, 1, 65_535, 'API_PORT_INVALID');
}

function secureEndpoint(value: string | undefined, code: string): void {
  const endpoint = requiredValue(value, code);
  let parsed: URL;
  try { parsed = new URL(endpoint); } catch { throw new Error(code); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash || parsed.search) throw new Error(code);
}
