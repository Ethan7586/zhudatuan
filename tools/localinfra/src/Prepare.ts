import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { access, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { LOCAL_CREDENTIAL_KEYS, LOCAL_ENVIRONMENT_KEYS, LOCAL_SECRET_REFS, MIGRATION_APPROVAL, bearerToken, localComposeEnvironment } from '@shop/config/server';
import { createNotificationSecrets, normalizeNotificationSecrets } from './NotificationSecrets';
import { localPassword } from './LocalPassword';
import { localVerificationCode } from './LocalVerificationCode';

const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const local = join(root, 'infrastructure', 'container', 'local');
const tls = join(local, '.tls');
const certificate = join(tls, 'local.crt');
const privateKey = join(tls, 'local.key');
const secretsFile = join(local, 'secrets.local.json');
const credentialsFile = join(local, 'credentials.local.json');
const composeSecrets = join(local, 'data', 'secrets');
const infrastructureEnvironmentFile = join(local, '.env.local');
const commerceEnvironmentFile = join(root, 'services', 'commerce', '.env.local');
const postgresDatabase = 'zhudatuan_registration';
const compose = localComposeEnvironment();
const composeProject = projectName(compose.project);
const postgresPort = compose.postgresPort;
const redisPort = compose.redisPort;
const legacySecretStoreBearerRef = 'local/internal/secret-store-bearer';
const legacyKmsBearerRef = 'local/internal/kms-bearer';
const rotate = process.argv.slice(2).includes('--rotate');

interface PreparedSecrets {
  readonly catalog: Readonly<Record<string, string>>;
  readonly kmsBearerToken: string;
  readonly secretStoreBearerToken: string;
}

await Promise.all([mkdir(tls, { recursive: true }), mkdir(join(local, 'data', 'objects'), { recursive: true }), mkdir(composeSecrets, { recursive: true })]);
await prepareCertificate();
const prepared = await loadOrCreateSecrets(rotate);
await writePrivate(credentialsFile, `${JSON.stringify({
  [LOCAL_CREDENTIAL_KEYS.kmsBearerToken]: prepared.kmsBearerToken,
  [LOCAL_CREDENTIAL_KEYS.secretStoreBearerToken]: prepared.secretStoreBearerToken,
}, null, 2)}\n`);
await Promise.all([
  writePrivate(join(composeSecrets, 'postgresadmin'), required(prepared.catalog, LOCAL_SECRET_REFS.postgresAdmin)),
  writePrivate(join(composeSecrets, 'postgresapi'), required(prepared.catalog, LOCAL_SECRET_REFS.postgresApi)),
  writePrivate(join(composeSecrets, 'postgresjobs'), required(prepared.catalog, LOCAL_SECRET_REFS.postgresJobs)),
  writePrivate(join(composeSecrets, 'postgresprovider'), required(prepared.catalog, LOCAL_SECRET_REFS.postgresProvider)),
  writePrivate(join(composeSecrets, 'redis'), required(prepared.catalog, LOCAL_SECRET_REFS.redis)),
  writePrivate(join(composeSecrets, 'objects'), required(prepared.catalog, LOCAL_SECRET_REFS.objects)),
]);
await writePrivate(infrastructureEnvironmentFile, infrastructureEnvironment());
await writePrivate(commerceEnvironmentFile, commerceEnvironment(prepared));
const clientEnvironments: ReadonlyArray<readonly [string, string]> = [
  ['console', viteEnvironment(4173)],
  ['auth', viteEnvironment(3002)],
  ['storefront', viteEnvironment(3000)],
  ['store', viteEnvironment(4175)],
  ['supplier', viteEnvironment(4176)],
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
if (rotate) process.stdout.write('LOCAL_CREDENTIALS_ROTATED\n');

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

async function loadOrCreateSecrets(forceRotation: boolean): Promise<PreparedSecrets> {
  const persisted: Awaited<ReturnType<typeof persistedBearerTokens>> = forceRotation ? Object.freeze({}) : await persistedBearerTokens();
  if (!forceRotation && (await exists(secretsFile))) {
    const parsed: unknown = JSON.parse(await readFile(secretsFile, 'utf8'));
    if (!validSecretMap(parsed)) throw new Error('LOCAL_SECRETS_INVALID');
    const existing = parsed as Readonly<Record<string, string>>;
    const secretStoreBearerToken = selectBearer(persisted.secretStoreBearerToken, existing[legacySecretStoreBearerRef], 'LOCAL_SECRET_STORE_BEARER_TOKEN_INVALID');
    const kmsBearerToken = selectBearer(persisted.kmsBearerToken, existing[legacyKmsBearerRef], 'LOCAL_KMS_BEARER_TOKEN_INVALID');
    if (secretStoreBearerToken === kmsBearerToken) throw new Error('LOCAL_WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
    const providerPassword = existing['local/postgres/provider-password'] ?? secret();
    const redisPassword = required(existing, LOCAL_SECRET_REFS.redis);
    const migrated: Record<string, string> = {
      ...existing,
      'local/ethan/password': localPassword(existing['local/ethan/password']),
      [LOCAL_SECRET_REFS.identityChallengeCode]: localVerificationCode(existing[LOCAL_SECRET_REFS.identityChallengeCode]),
      'local/postgres/provider-password': providerPassword,
      'shop/local/redis/query': redisUrl(redisPassword),
      ...databaseConnections({
        admin: required(existing, 'local/postgres/admin-password'),
        api: required(existing, 'local/postgres/api-password'),
        jobs: required(existing, 'local/postgres/jobs-password'),
        provider: providerPassword,
      }),
    };
    delete migrated['local/postgres/migration-password'];
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
    'local/redis/password': redisPassword,
    'local/ethan/password': localPassword(),
    [LOCAL_SECRET_REFS.identityChallengeCode]: localVerificationCode(),
    ...databaseConnections({ admin: postgresAdmin, api: postgresApi, jobs: postgresJobs, provider: postgresProvider }),
    'shop/local/redis/query': redisUrl(redisPassword),
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

function infrastructureEnvironment(): string {
  return lines({
    ...launchFiles(),
    [LOCAL_ENVIRONMENT_KEYS.tlsKeyFile]: privateKey,
    [LOCAL_ENVIRONMENT_KEYS.tlsCertificateFile]: certificate,
    [LOCAL_ENVIRONMENT_KEYS.secretsPort]: '8443',
    [LOCAL_ENVIRONMENT_KEYS.kmsPort]: '8444',
    [LOCAL_ENVIRONMENT_KEYS.objectsPort]: '8445',
    [LOCAL_ENVIRONMENT_KEYS.objectsDirectory]: join(local, 'data', 'objects'),
    [LOCAL_ENVIRONMENT_KEYS.composeProject]: composeProject,
    [LOCAL_ENVIRONMENT_KEYS.postgresPort]: String(postgresPort),
    [LOCAL_ENVIRONMENT_KEYS.redisPort]: String(redisPort),
    [LOCAL_ENVIRONMENT_KEYS.postgresDatabase]: postgresDatabase,
    [LOCAL_ENVIRONMENT_KEYS.postgresUser]: 'shopadmin',
    [LOCAL_ENVIRONMENT_KEYS.nodeExtraCaCertificates]: certificate,
  });
}

function commerceEnvironment(prepared: PreparedSecrets): string {
  const values = prepared.catalog;
  return lines({
    ...launchFiles(),
    APP_ENV: 'development',
    SERVICE_VERSION: 'local',
    AUTH_MODE: 'membership',
    API_PORT: '3001',
    API_ALLOWED_ORIGINS:
      'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3002,http://127.0.0.1:3002,http://localhost:4173,http://127.0.0.1:4173,http://localhost:4174,http://127.0.0.1:4174,http://localhost:4175,http://127.0.0.1:4175,http://localhost:4176,http://127.0.0.1:4176',
    AUTH_RETURN_TARGETS: JSON.stringify({
      console: 'http://127.0.0.1:4173',
      storefront: 'http://127.0.0.1:3000',
      miniapp: 'http://127.0.0.1:4174',
      store: 'http://127.0.0.1:4175',
      supplier: 'http://127.0.0.1:4176',
    }),
    PUBLIC_STOREFRONT_ORIGIN: 'http://127.0.0.1:3000',
    DATABASE_API_CONNECTION_REF: 'shop/local/database/api',
    DATABASE_JOB_CONNECTION_REF: 'shop/local/database/jobs',
    DATABASE_PROVIDER_CONNECTION_REF: 'shop/local/database/provider',
    REDIS_CONNECTION_REF: 'shop/local/redis/query',
    SESSION_KEY_REF: 'shop/local/identity/session',
    IDENTITY_KEY_REF: 'shop/local/identity/index',
    IDENTITY_CHALLENGE_CODE_REF: LOCAL_SECRET_REFS.identityChallengeCode,
    INVITATION_KEY_REF: 'shop/local/identity/invitation',
    NAVIGATION_KEY_REF: 'shop/local/navigation/hmac',
    QUOTE_KEY_REF: 'shop/local/checkout/quote',
    PII_KEY_REF: 'shop/local/pii',
    KMS_ENDPOINT: 'https://127.0.0.1:8444',
    WECHAT_APPLICATION_CONFIG_REF: 'shop/local/wechat/applications',
    WECHAT_PAYMENT_CONFIG_REF: 'shop/local/payment/wechat',
    INVOICE_CONFIG_REF: 'shop/local/invoice',
    PAYOUT_CONFIG_REF: 'shop/local/payout',
    NOTIFICATION_CONFIG_REF: 'shop/local/notification',
    OBJECT_STORE_ENDPOINT: 'https://127.0.0.1:8445',
    OBJECT_STORE_TOKEN_REF: 'shop/local/objects/api',
    EXTENSION_MANIFEST_KEY_REF: 'shop/local/extensions/manifest',
    SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8443',
    PUBLIC_MEDIA_BASE_URL: 'https://127.0.0.1:8445',
    JOB_WORKER_ID: 'local-worker-1',
    PROVIDER_WORKER_ID: 'local-provider-1',
    MIGRATION_APPROVAL,
    MIGRATION_PHASE: 'prepare',
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

function launchFiles(): Readonly<Record<string, string>> {
  return Object.freeze({
    [LOCAL_ENVIRONMENT_KEYS.credentialsFile]: credentialsFile,
    [LOCAL_ENVIRONMENT_KEYS.secretsFile]: secretsFile,
  });
}

function viteEnvironment(port: number): string {
  return lines({ VITE_API_BASE_URL: 'http://127.0.0.1:3001', VITE_AUTH_BASE_URL: 'http://127.0.0.1:3002', VITE_STOREFRONT_ORIGIN: 'http://127.0.0.1:3000', VITE_CLIENT_VERSION: '0.0.0', PORT: String(port) });
}

function postgresUrl(user: string, password: string): string {
  return `postgres://${user}:${encodeURIComponent(password)}@127.0.0.1:${postgresPort}/${postgresDatabase}`;
}
function redisUrl(password: string): string {
  return `redis://default:${encodeURIComponent(password)}@127.0.0.1:${redisPort}`;
}
function databaseConnections(passwords: Readonly<{ admin: string; api: string; jobs: string; provider: string }>): Readonly<Record<string, string>> {
  return {
    'shop/local/database/admin': postgresUrl('shopadmin', passwords.admin),
    'shop/local/database/api': postgresUrl('shopapp', passwords.api),
    'shop/local/database/jobs': postgresUrl('shopjob', passwords.jobs),
    'shop/local/database/provider': postgresUrl('shopprovider', passwords.provider),
    'shop/local/database/migration': postgresUrl('shopadmin', passwords.admin),
  };
}

function secret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
function projectName(value: string | undefined): string {
  const selected = value?.trim() || 'zhudatuan-local';
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(selected)) throw new Error('LOCAL_COMPOSE_PROJECT_INVALID');
  return selected;
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
  const [infrastructure, commerce, credentials] = await Promise.all([
    readEnvironment(infrastructureEnvironmentFile),
    readEnvironment(commerceEnvironmentFile),
    readCredentials(credentialsFile),
  ]);
  const serverSecret = stableCredential(
    [credentials[LOCAL_CREDENTIAL_KEYS.secretStoreBearerToken], infrastructure[LOCAL_ENVIRONMENT_KEYS.secretStoreBearerToken], commerce.SECRET_STORE_BEARER_TOKEN],
    'LOCAL_SECRET_STORE_BEARER_TOKEN_DRIFT'
  );
  const serverKms = stableCredential(
    [credentials[LOCAL_CREDENTIAL_KEYS.kmsBearerToken], infrastructure[LOCAL_ENVIRONMENT_KEYS.kmsBearerToken], commerce.KMS_BEARER_TOKEN],
    'LOCAL_KMS_BEARER_TOKEN_DRIFT'
  );
  return Object.freeze({
    ...(serverKms ? { kmsBearerToken: bearerToken(serverKms, 'LOCAL_KMS_BEARER_TOKEN_INVALID') } : {}),
    ...(serverSecret ? { secretStoreBearerToken: bearerToken(serverSecret, 'LOCAL_SECRET_STORE_BEARER_TOKEN_INVALID') } : {}),
  });
}
async function readCredentials(path: string): Promise<Readonly<Record<string, string>>> {
  if (!(await exists(path))) return Object.freeze({});
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (!validSecretMap(parsed)) throw new Error('LOCAL_CREDENTIALS_INVALID');
  return Object.freeze(parsed);
}
function stableCredential(values: readonly (string | undefined)[], code: string): string | undefined {
  const present = values.filter((value): value is string => value !== undefined);
  if (new Set(present).size > 1) throw new Error(code);
  return present[0];
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
