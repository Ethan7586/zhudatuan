import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { access, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { LOCAL_ENVIRONMENT_KEYS, MIGRATION_APPROVAL, bearerToken } from '@shop/config/server';
import { createNotificationSecrets, normalizeNotificationSecrets } from './NotificationSecrets';

const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const local = join(root, 'infrastructure', 'container', 'local');
const tls = join(local, '.tls');
const certificate = join(tls, 'local.crt');
const privateKey = join(tls, 'local.key');
const secretsFile = join(local, 'secrets.local.json');
const infrastructureEnvironmentFile = join(local, '.env.local');
const commerceEnvironmentFile = join(root, 'services', 'commerce', '.env.local');
const postgresDatabase = 'zhudatuan_registration';
const legacySecretStoreBearerRef = 'local/internal/secret-store-bearer';
const legacyKmsBearerRef = 'local/internal/kms-bearer';

interface PreparedSecrets {
  readonly catalog: Readonly<Record<string, string>>;
  readonly kmsBearerToken: string;
  readonly secretStoreBearerToken: string;
}

await Promise.all([mkdir(tls, { recursive: true }), mkdir(join(local, 'data', 'objects'), { recursive: true })]);
await prepareCertificate();
const prepared = await loadOrCreateSecrets();
await writePrivate(infrastructureEnvironmentFile, infrastructureEnvironment(prepared));
await writePrivate(commerceEnvironmentFile, commerceEnvironment(prepared));
const clientEnvironments: ReadonlyArray<readonly [string, string]> = [
  ['console', viteEnvironment(4173)],
  ['auth', viteEnvironment(3002)],
  ['storefront', viteEnvironment(3000)],
];
const clientEnvironmentWrites: Array<Promise<void>> = [];
for (const [application, environment] of clientEnvironments) {
  const applicationRoot = join(root, 'apps', application);
  if (await exists(join(applicationRoot, 'package.json'))) {
    clientEnvironmentWrites.push(writePrivate(join(applicationRoot, '.env.local'), environment));
  }
}
await Promise.all(clientEnvironmentWrites);

process.stdout.write('LOCAL_ENVIRONMENT_PREPARED\n');
process.stdout.write(`LOCAL_CA_CERTIFICATE ${certificate}\n`);
process.stdout.write('LOCAL_SECRETS_WRITTEN_WITHOUT_PRINTING_VALUES\n');

async function prepareCertificate(): Promise<void> {
  if ((await exists(certificate)) && (await exists(privateKey))) return;
  const openssl = await findOpenSsl();
  await execute(openssl, [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-sha256',
    '-nodes',
    '-keyout',
    privateKey,
    '-out',
    certificate,
    '-days',
    '3650',
    '-subj',
    '/CN=127.0.0.1',
    '-addext',
    'subjectAltName=IP:127.0.0.1,DNS:localhost',
    '-addext',
    'keyUsage=digitalSignature,keyEncipherment',
    '-addext',
    'extendedKeyUsage=serverAuth',
  ]);
  await Promise.all([chmod(privateKey, 0o600), chmod(certificate, 0o644)]);
}

async function loadOrCreateSecrets(): Promise<PreparedSecrets> {
  const persisted = await persistedBearerTokens();
  if (await exists(secretsFile)) {
    const parsed: unknown = JSON.parse(await readFile(secretsFile, 'utf8'));
    if (!validSecretMap(parsed)) throw new Error('LOCAL_SECRETS_INVALID');
    const existing = parsed as Readonly<Record<string, string>>;
    const secretStoreBearerToken = selectBearer(persisted.secretStoreBearerToken, existing[legacySecretStoreBearerRef], 'LOCAL_SECRET_STORE_BEARER_TOKEN_INVALID');
    const kmsBearerToken = selectBearer(persisted.kmsBearerToken, existing[legacyKmsBearerRef], 'LOCAL_KMS_BEARER_TOKEN_INVALID');
    if (secretStoreBearerToken === kmsBearerToken) throw new Error('LOCAL_WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
    const providerPassword = existing['local/postgres/provider-password'] ?? secret();
    const migrated: Record<string, string> = {
      ...existing,
      'local/postgres/provider-password': providerPassword,
      ...databaseConnections({
        admin: required(existing, 'local/postgres/admin-password'),
        api: required(existing, 'local/postgres/api-password'),
        jobs: required(existing, 'local/postgres/jobs-password'),
        provider: providerPassword,
        migration: required(existing, 'local/postgres/migration-password'),
      }),
    };
    delete migrated[legacySecretStoreBearerRef];
    delete migrated[legacyKmsBearerRef];
    const catalog = normalizeNotificationSecrets(migrated);
    if (Object.keys(catalog).length === 0) throw new Error('LOCAL_SECRETS_INVALID');
    await writePrivate(secretsFile, `${JSON.stringify(catalog, null, 2)}\n`);
    return Object.freeze({ catalog: Object.freeze(catalog), kmsBearerToken, secretStoreBearerToken });
  }
  const postgresAdmin = secret();
  const postgresApi = secret();
  const postgresJobs = secret();
  const postgresProvider = secret();
  const postgresMigration = secret();
  const redisPassword = secret();
  const objectToken = secret();
  const paymentKeys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
    publicKeyEncoding: { format: 'pem', type: 'spki' },
  });
  const manifestKeys = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
    publicKeyEncoding: { format: 'pem', type: 'spki' },
  });
  const payment = {
    apiV3Key: randomBytes(24).toString('base64url'),
    mchId: '1900000109',
    merchantPrivateKeyPem: paymentKeys.privateKey,
    merchantSerialNo: randomBytes(16).toString('hex').toUpperCase(),
    notifyUrl: 'https://api.local.invalid/api/v1/webhooks/wechat/payment',
    platformKeys: [{ active: true, id: `PUB_KEY_ID_${randomBytes(9).toString('base64url')}`, publicKeyPem: paymentKeys.publicKey }],
  };
  const wechatApplications = {
    applications: [
      { appId: 'wxLocalMiniapp0001', scene: 'miniapp' },
      { appId: 'wxLocalJsapi000002', scene: 'jsapi' },
    ],
  };
  const catalog: Readonly<Record<string, string>> = Object.freeze({
    'local/postgres/admin-password': postgresAdmin,
    'local/postgres/api-password': postgresApi,
    'local/postgres/jobs-password': postgresJobs,
    'local/postgres/provider-password': postgresProvider,
    'local/postgres/migration-password': postgresMigration,
    'local/redis/password': redisPassword,
    'local/ethan/password': secret(18),
    ...databaseConnections({ admin: postgresAdmin, api: postgresApi, jobs: postgresJobs, provider: postgresProvider, migration: postgresMigration }),
    'shop/local/redis/query': `redis://default:${encodeURIComponent(redisPassword)}@127.0.0.1:6379`,
    'shop/local/identity/session': secret(),
    'shop/local/identity/index': secret(),
    'shop/local/identity/invitation': JSON.stringify({ current: { version: 'local-v1', value: secret() }, previous: [] }),
    'shop/local/navigation/hmac': secret(),
    'shop/local/checkout/quote': secret(),
    'shop/local/pii': secret(),
    'shop/local/objects/api': objectToken,
    'shop/local/extensions/manifest': manifestKeys.publicKey,
    'shop/local/extensions/manifest-private': manifestKeys.privateKey,
    'shop/local/wechat/applications': JSON.stringify(wechatApplications),
    'shop/local/payment/wechat': JSON.stringify(payment),
    'shop/local/invoice': JSON.stringify({ bearer: secret(), endpoint: 'https://invoice.local.invalid', provider: 'localinvoice' }),
    'shop/local/payout': JSON.stringify({ bearer: secret(), endpoint: 'https://payout.local.invalid', provider: 'localpayout' }),
    ...createNotificationSecrets({ emailBearer: secret(), smsAccessKeySecret: secret(), wechatAppSecret: secret() }),
    'shop/local/kms/master': randomBytes(32).toString('base64url'),
  });
  const secretStoreBearerToken = selectBearer(persisted.secretStoreBearerToken, undefined, 'LOCAL_SECRET_STORE_BEARER_TOKEN_INVALID');
  const kmsBearerToken = selectBearer(persisted.kmsBearerToken, undefined, 'LOCAL_KMS_BEARER_TOKEN_INVALID');
  if (secretStoreBearerToken === kmsBearerToken) throw new Error('LOCAL_WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  await writePrivate(secretsFile, `${JSON.stringify(catalog, null, 2)}\n`);
  return Object.freeze({ catalog, kmsBearerToken, secretStoreBearerToken });
}

function infrastructureEnvironment(prepared: PreparedSecrets): string {
  const values = prepared.catalog;
  return lines({
    [LOCAL_ENVIRONMENT_KEYS.tlsKeyFile]: privateKey,
    [LOCAL_ENVIRONMENT_KEYS.tlsCertificateFile]: certificate,
    [LOCAL_ENVIRONMENT_KEYS.secretsFile]: secretsFile,
    [LOCAL_ENVIRONMENT_KEYS.secretsPort]: '8443',
    [LOCAL_ENVIRONMENT_KEYS.kmsPort]: '8444',
    [LOCAL_ENVIRONMENT_KEYS.kmsMasterKey]: required(values, 'shop/local/kms/master'),
    [LOCAL_ENVIRONMENT_KEYS.kmsBearerToken]: prepared.kmsBearerToken,
    [LOCAL_ENVIRONMENT_KEYS.secretStoreBearerToken]: prepared.secretStoreBearerToken,
    [LOCAL_ENVIRONMENT_KEYS.objectsPort]: '8445',
    [LOCAL_ENVIRONMENT_KEYS.objectsDirectory]: join(local, 'data', 'objects'),
    [LOCAL_ENVIRONMENT_KEYS.objectsToken]: required(values, 'shop/local/objects/api'),
    [LOCAL_ENVIRONMENT_KEYS.postgresDatabase]: postgresDatabase,
    [LOCAL_ENVIRONMENT_KEYS.postgresUser]: 'shopadmin',
    [LOCAL_ENVIRONMENT_KEYS.postgresPassword]: required(values, 'local/postgres/admin-password'),
    [LOCAL_ENVIRONMENT_KEYS.postgresApiPassword]: required(values, 'local/postgres/api-password'),
    [LOCAL_ENVIRONMENT_KEYS.postgresJobsPassword]: required(values, 'local/postgres/jobs-password'),
    [LOCAL_ENVIRONMENT_KEYS.postgresProviderPassword]: required(values, 'local/postgres/provider-password'),
    [LOCAL_ENVIRONMENT_KEYS.postgresMigrationPassword]: required(values, 'local/postgres/migration-password'),
    [LOCAL_ENVIRONMENT_KEYS.redisPassword]: required(values, 'local/redis/password'),
    [LOCAL_ENVIRONMENT_KEYS.nodeExtraCaCertificates]: certificate,
  });
}

function commerceEnvironment(prepared: PreparedSecrets): string {
  const values = prepared.catalog;
  return lines({
    APP_ENV: 'development',
    SERVICE_VERSION: 'local',
    AUTH_MODE: 'membership',
    API_PORT: '3001',
    API_ALLOWED_ORIGINS: 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3002,http://127.0.0.1:3002,http://localhost:4173,http://127.0.0.1:4173',
    AUTH_RETURN_TARGETS: JSON.stringify({ console: 'http://127.0.0.1:4173', storefront: 'http://127.0.0.1:3000' }),
    PUBLIC_STOREFRONT_ORIGIN: 'http://127.0.0.1:3000',
    DATABASE_API_CONNECTION_REF: 'shop/local/database/api',
    DATABASE_JOB_CONNECTION_REF: 'shop/local/database/jobs',
    DATABASE_PROVIDER_CONNECTION_REF: 'shop/local/database/provider',
    REDIS_CONNECTION_REF: 'shop/local/redis/query',
    SESSION_KEY_REF: 'shop/local/identity/session',
    IDENTITY_KEY_REF: 'shop/local/identity/index',
    INVITATION_KEY_REF: 'shop/local/identity/invitation',
    NAVIGATION_KEY_REF: 'shop/local/navigation/hmac',
    QUOTE_KEY_REF: 'shop/local/checkout/quote',
    PII_KEY_REF: 'shop/local/pii',
    KMS_ENDPOINT: 'https://127.0.0.1:8444',
    KMS_BEARER_TOKEN: prepared.kmsBearerToken,
    WECHAT_APPLICATION_CONFIG_REF: 'shop/local/wechat/applications',
    WECHAT_PAYMENT_CONFIG_REF: 'shop/local/payment/wechat',
    INVOICE_CONFIG_REF: 'shop/local/invoice',
    PAYOUT_CONFIG_REF: 'shop/local/payout',
    NOTIFICATION_CONFIG_REF: 'shop/local/notification',
    OBJECT_STORE_ENDPOINT: 'https://127.0.0.1:8445',
    OBJECT_STORE_TOKEN_REF: 'shop/local/objects/api',
    EXTENSION_MANIFEST_KEY_REF: 'shop/local/extensions/manifest',
    SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8443',
    SECRET_STORE_BEARER_TOKEN: prepared.secretStoreBearerToken,
    PUBLIC_MEDIA_BASE_URL: 'https://127.0.0.1:8445',
    JOB_WORKER_ID: 'local-worker-1',
    PROVIDER_WORKER_ID: 'local-provider-1',
    MIGRATION_APPROVAL,
    MIGRATION_DATABASE_CONNECTION_REF: 'shop/local/database/migration',
    MIGRATION_DIRECTORY: join(root, 'database', 'migrations'),
    MIGRATION_DISTRIBUTOR_KEY_REF: 'channel/distributor',
    MIGRATION_IDENTITY_KEY_REF: 'identity/wechat',
    MIGRATION_PARTNER_KEY_REF: 'partner/address',
    MIGRATION_VOUCHER_KEY_REF: 'voucher/code',
    MIGRATION_SOURCE_SNAPSHOT_REF: 'local:source-snapshot',
    [LOCAL_ENVIRONMENT_KEYS.adminDatabaseConnectionRef]: 'shop/local/database/admin',
    [LOCAL_ENVIRONMENT_KEYS.ethanPasswordRef]: 'local/ethan/password',
    [LOCAL_ENVIRONMENT_KEYS.nodeExtraCaCertificates]: certificate,
  });
}

function viteEnvironment(port: number): string {
  return lines({ VITE_API_BASE_URL: 'http://127.0.0.1:3001', VITE_AUTH_BASE_URL: 'http://127.0.0.1:3002', VITE_STOREFRONT_ORIGIN: 'http://127.0.0.1:3000', VITE_CLIENT_VERSION: '0.0.0', PORT: String(port) });
}

function postgresUrl(user: string, password: string): string {
  return `postgres://${user}:${encodeURIComponent(password)}@127.0.0.1:5432/${postgresDatabase}`;
}
function databaseConnections(passwords: Readonly<{ admin: string; api: string; jobs: string; provider: string; migration: string }>): Readonly<Record<string, string>> {
  return {
    'shop/local/database/admin': postgresUrl('shopadmin', passwords.admin),
    'shop/local/database/api': postgresUrl('shopapp', passwords.api),
    'shop/local/database/jobs': postgresUrl('shopjob', passwords.jobs),
    'shop/local/database/provider': postgresUrl('shopprovider', passwords.provider),
    'shop/local/database/migration': postgresUrl('shopmigration', passwords.migration),
  };
}

function secret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
function selectBearer(primary: string | undefined, legacy: string | undefined, code: string): string {
  return bearerToken(primary ?? legacy ?? secret(), code);
}
async function persistedBearerTokens(): Promise<
  Readonly<{
    kmsBearerToken?: string;
    secretStoreBearerToken?: string;
  }>
> {
  const [infrastructure, commerce] = await Promise.all([readEnvironment(infrastructureEnvironmentFile), readEnvironment(commerceEnvironmentFile)]);
  const serverSecret = infrastructure[LOCAL_ENVIRONMENT_KEYS.secretStoreBearerToken];
  const clientSecret = commerce.SECRET_STORE_BEARER_TOKEN;
  const serverKms = infrastructure[LOCAL_ENVIRONMENT_KEYS.kmsBearerToken];
  const clientKms = commerce.KMS_BEARER_TOKEN;
  if (serverSecret !== undefined && clientSecret !== undefined && serverSecret !== clientSecret) {
    throw new Error('LOCAL_SECRET_STORE_BEARER_TOKEN_DRIFT');
  }
  if (serverKms !== undefined && clientKms !== undefined && serverKms !== clientKms) {
    throw new Error('LOCAL_KMS_BEARER_TOKEN_DRIFT');
  }
  return Object.freeze({
    ...((serverKms ?? clientKms) ? { kmsBearerToken: bearerToken(serverKms ?? clientKms, 'LOCAL_KMS_BEARER_TOKEN_INVALID') } : {}),
    ...((serverSecret ?? clientSecret) ? { secretStoreBearerToken: bearerToken(serverSecret ?? clientSecret, 'LOCAL_SECRET_STORE_BEARER_TOKEN_INVALID') } : {}),
  });
}
async function readEnvironment(path: string): Promise<Readonly<Record<string, string>>> {
  if (!(await exists(path))) return Object.freeze({});
  const result: Record<string, string> = {};
  for (const line of (await readFile(path, 'utf8')).split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) throw new Error('LOCAL_ENVIRONMENT_FILE_INVALID');
    const key = line.slice(0, separator);
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || Object.hasOwn(result, key)) throw new Error('LOCAL_ENVIRONMENT_FILE_INVALID');
    result[key] = line.slice(separator + 1);
  }
  return Object.freeze(result);
}
function required(values: Readonly<Record<string, string>>, name: string): string {
  const value = values[name];
  if (!value) throw new Error(`LOCAL_SECRET_MISSING:${name}`);
  return value;
}
function lines(values: Readonly<Record<string, string>>): string {
  return `${Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`;
}
function validSecretMap(value: unknown): value is Readonly<Record<string, string>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.entries(value).length > 0 && Object.values(value).every((item) => typeof item === 'string' && item.length > 0);
}
async function writePrivate(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, { mode: 0o600 });
  await chmod(path, 0o600);
}
async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
async function findOpenSsl(): Promise<string> {
  for (const candidate of ['/opt/homebrew/bin/openssl', '/usr/local/bin/openssl', '/usr/bin/openssl']) if (await exists(candidate)) return candidate;
  throw new Error('OPENSSL_NOT_FOUND');
}
