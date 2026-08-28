import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { access, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { LOCAL_ENVIRONMENT_KEYS } from '@shop/config/server';

const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const local = join(root, 'infrastructure', 'local');
const tls = join(local, '.tls');
const certificate = join(tls, 'local.crt');
const privateKey = join(tls, 'local.key');
const secretsFile = join(local, 'secrets.local.json');
const infrastructureEnvironmentFile = join(local, '.env.local');
const commerceEnvironmentFile = join(root, 'services', 'commerce', '.env.local');

await Promise.all([
  mkdir(tls, { recursive: true }),
  mkdir(join(local, 'data', 'objects'), { recursive: true }),
]);
await prepareCertificate();
const values = await loadOrCreateSecrets();
await writePrivate(infrastructureEnvironmentFile, infrastructureEnvironment(values));
await writePrivate(commerceEnvironmentFile, commerceEnvironment());
const clientEnvironments: ReadonlyArray<readonly [string, string]> = [
  ['console', viteEnvironment(4173)],
  ['store', viteEnvironment(5174)],
  ['supplier', viteEnvironment(5175)],
  ['auth', viteEnvironment(3002)],
  ['storefront', viteEnvironment(3000)],
  ['miniapp', miniappEnvironment()],
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
  if (await exists(certificate) && await exists(privateKey)) return;
  const openssl = await findOpenSsl();
  await execute(openssl, [
    'req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes',
    '-keyout', privateKey, '-out', certificate, '-days', '3650',
    '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost',
    '-addext', 'keyUsage=digitalSignature,keyEncipherment', '-addext', 'extendedKeyUsage=serverAuth',
  ]);
  await Promise.all([chmod(privateKey, 0o600), chmod(certificate, 0o644)]);
}

async function loadOrCreateSecrets(): Promise<Readonly<Record<string, string>>> {
  if (await exists(secretsFile)) {
    const parsed: unknown = JSON.parse(await readFile(secretsFile, 'utf8'));
    if (!validSecretMap(parsed)) throw new Error('LOCAL_SECRETS_INVALID');
    return parsed;
  }
  const postgresAdmin = secret();
  const postgresApi = secret();
  const postgresJobs = secret();
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
  const wechatApplications = { applications: [
    { appId: 'wxLocalMiniapp0001', scene: 'miniapp' },
    { appId: 'wxLocalJsapi000002', scene: 'jsapi' },
  ] };
  const values: Readonly<Record<string, string>> = Object.freeze({
    'local/postgres/admin-password': postgresAdmin,
    'local/postgres/api-password': postgresApi,
    'local/postgres/jobs-password': postgresJobs,
    'local/postgres/migration-password': postgresMigration,
    'local/redis/password': redisPassword,
    'local/ethan/password': secret(18),
    'shop/local/database/admin': postgresUrl('shopadmin', postgresAdmin),
    'shop/local/database/api': postgresUrl('shopapp', postgresApi),
    'shop/local/database/jobs': postgresUrl('shopjob', postgresJobs),
    'shop/local/database/migration': postgresUrl('shopmigration', postgresMigration),
    'shop/local/redis/query': `redis://default:${encodeURIComponent(redisPassword)}@127.0.0.1:6379`,
    'shop/local/identity/session': secret(),
    'shop/local/identity/index': secret(),
    'shop/local/checkout/quote': secret(),
    'shop/local/pii': secret(),
    'shop/local/objects/api': objectToken,
    'shop/local/extensions/manifest': manifestKeys.publicKey,
    'shop/local/extensions/manifest-private': manifestKeys.privateKey,
    'shop/local/wechat/applications': JSON.stringify(wechatApplications),
    'shop/local/payment/wechat': JSON.stringify(payment),
    'shop/local/identity/wechat': JSON.stringify({ applications: [
      { appSecret: secret(), scene: 'miniapp' },
      { appSecret: secret(), authorizationCallbackUrl: 'https://auth.local.invalid/wechat/callback', scene: 'jsapi' },
    ] }),
    'shop/local/invoice': JSON.stringify({ bearer: secret(), endpoint: 'https://invoice.local.invalid', provider: 'localinvoice' }),
    'shop/local/payout': JSON.stringify({ bearer: secret(), endpoint: 'https://payout.local.invalid', provider: 'localpayout' }),
    'shop/local/notification': JSON.stringify({
      email: { bearer: secret(), endpoint: 'https://email.local.invalid', provider: 'localemail', sender: 'noreply@local.invalid' },
      sms: { accessKeyId: 'localaccesskey', accessKeySecret: secret(), endpoint: 'dysmsapi.aliyuncs.com', region: 'cn-hangzhou', signName: '本地商城', verificationTemplate: 'SMS_LOCAL_VERIFY' },
      wechat: { appId: 'wxLocalMiniapp0001', appSecret: secret(), page: 'pages/home/index', state: 'developer' },
    }),
    'shop/local/kms/master': randomBytes(32).toString('base64url'),
  });
  await writePrivate(secretsFile, `${JSON.stringify(values, null, 2)}\n`);
  return values;
}

function infrastructureEnvironment(values: Readonly<Record<string, string>>): string {
  return lines({
    [LOCAL_ENVIRONMENT_KEYS.tlsKeyFile]: privateKey,
    [LOCAL_ENVIRONMENT_KEYS.tlsCertificateFile]: certificate,
    [LOCAL_ENVIRONMENT_KEYS.secretsFile]: secretsFile,
    [LOCAL_ENVIRONMENT_KEYS.secretsPort]: '8443',
    [LOCAL_ENVIRONMENT_KEYS.kmsPort]: '8444',
    [LOCAL_ENVIRONMENT_KEYS.kmsMasterKey]: required(values, 'shop/local/kms/master'),
    [LOCAL_ENVIRONMENT_KEYS.objectsPort]: '8445',
    [LOCAL_ENVIRONMENT_KEYS.objectsDirectory]: join(local, 'data', 'objects'),
    [LOCAL_ENVIRONMENT_KEYS.objectsToken]: required(values, 'shop/local/objects/api'),
    [LOCAL_ENVIRONMENT_KEYS.postgresDatabase]: 'shop',
    [LOCAL_ENVIRONMENT_KEYS.postgresUser]: 'shopadmin',
    [LOCAL_ENVIRONMENT_KEYS.postgresPassword]: required(values, 'local/postgres/admin-password'),
    [LOCAL_ENVIRONMENT_KEYS.postgresApiPassword]: required(values, 'local/postgres/api-password'),
    [LOCAL_ENVIRONMENT_KEYS.postgresJobsPassword]: required(values, 'local/postgres/jobs-password'),
    [LOCAL_ENVIRONMENT_KEYS.postgresMigrationPassword]: required(values, 'local/postgres/migration-password'),
    [LOCAL_ENVIRONMENT_KEYS.redisPassword]: required(values, 'local/redis/password'),
    [LOCAL_ENVIRONMENT_KEYS.nodeExtraCaCertificates]: certificate,
  });
}

function commerceEnvironment(): string {
  return lines({
    APP_ENV: 'development',
    SERVICE_VERSION: 'local',
    AUTH_MODE: 'membership',
    API_PORT: '3001',
    API_ALLOWED_ORIGINS: 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3002,http://127.0.0.1:3002,http://localhost:4173,http://127.0.0.1:4173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:5175,http://127.0.0.1:5175',
    AUTH_RETURN_TARGETS: JSON.stringify({ console: 'http://127.0.0.1:4173', storefront: 'http://127.0.0.1:3000', store: 'http://127.0.0.1:5174', supplier: 'http://127.0.0.1:5175' }),
    DATABASE_API_CONNECTION_REF: 'shop/local/database/api',
    DATABASE_JOB_CONNECTION_REF: 'shop/local/database/jobs',
    REDIS_CONNECTION_REF: 'shop/local/redis/query',
    SESSION_KEY_REF: 'shop/local/identity/session',
    IDENTITY_KEY_REF: 'shop/local/identity/index',
    QUOTE_KEY_REF: 'shop/local/checkout/quote',
    PII_KEY_REF: 'shop/local/pii',
    KMS_ENDPOINT: 'https://127.0.0.1:8444',
    WECHAT_APPLICATION_CONFIG_REF: 'shop/local/wechat/applications',
    WECHAT_PAYMENT_CONFIG_REF: 'shop/local/payment/wechat',
    WECHAT_IDENTITY_CONFIG_REF: 'shop/local/identity/wechat',
    INVOICE_CONFIG_REF: 'shop/local/invoice',
    PAYOUT_CONFIG_REF: 'shop/local/payout',
    NOTIFICATION_CONFIG_REF: 'shop/local/notification',
    OBJECT_STORE_ENDPOINT: 'https://127.0.0.1:8445',
    OBJECT_STORE_TOKEN_REF: 'shop/local/objects/api',
    EXTENSION_MANIFEST_KEY_REF: 'shop/local/extensions/manifest',
    SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8443',
    PUBLIC_MEDIA_BASE_URL: 'https://127.0.0.1:8445',
    PUBLIC_MALL_SLUG: 'local',
    JOB_WORKER_ID: 'local-worker-1',
    MIGRATION_APPROVAL: 'hard-cut-20260821054000',
    MIGRATION_DATABASE_CONNECTION_REF: 'shop/local/database/migration',
    MIGRATION_DIRECTORY: join(root, 'database', 'supabase', 'migrations'),
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
  return lines({ VITE_API_BASE_URL: 'http://127.0.0.1:3001', VITE_AUTH_BASE_URL: 'http://127.0.0.1:3002', VITE_CLIENT_VERSION: '0.0.0', PORT: String(port) });
}

function miniappEnvironment(): string {
  return lines({ apiBaseUrl: 'https://api.local.invalid', clientVersion: '0.0.0', mallId: 'local' });
}

function postgresUrl(user: string, password: string): string {
  return `postgres://${user}:${encodeURIComponent(password)}@127.0.0.1:5432/shop`;
}

function secret(bytes = 32): string { return randomBytes(bytes).toString('base64url'); }
function required(values: Readonly<Record<string, string>>, name: string): string {
  const value = values[name];
  if (!value) throw new Error(`LOCAL_SECRET_MISSING:${name}`);
  return value;
}
function lines(values: Readonly<Record<string, string>>): string {
  return `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n')}\n`;
}
function validSecretMap(value: unknown): value is Readonly<Record<string, string>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.entries(value).length > 0
    && Object.values(value).every(item => typeof item === 'string' && item.length > 0);
}
async function writePrivate(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, { mode: 0o600 });
  await chmod(path, 0o600);
}
async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}
async function findOpenSsl(): Promise<string> {
  for (const candidate of ['/opt/homebrew/bin/openssl', '/usr/local/bin/openssl', '/usr/bin/openssl']) if (await exists(candidate)) return candidate;
  throw new Error('OPENSSL_NOT_FOUND');
}
