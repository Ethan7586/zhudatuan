import { constants } from 'node:fs';
import { access, lstat, readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import {
  FULL_ROOT,
  base64Url32,
  bearer,
  canonical,
  containsPlaceholder,
  digest,
  fixedValuesMatch,
  matchEvidence,
  matchFileFingerprint,
  parseEnvironment,
  record,
  redactPolicyTokens,
  sameStrings,
  valueAt,
} from './readiness-common.mjs';

export async function verifyLiveHostConfiguration(evidence, expectedPhase, observed) {
  const missing = [];
  const shared = `${FULL_ROOT}/shared`;
  const contract = `${FULL_ROOT}/current/infrastructure/zhudatuan/aliyun/staging`;
  const internalEnvironmentFile = `${shared}/full-internal-runtime.env`;
  const proxyEnvironmentFile = `${shared}/full-postgres-proxy.env`;
  const accessFile = `${shared}/full-internal-access.json`;
  const catalogFile = `${shared}/full-secrets.json`;
  let internalEnvironment;
  let proxyEnvironment;
  let policy;
  let catalog;
  try {
    internalEnvironment = parseEnvironment(await readFile(internalEnvironmentFile, 'utf8'));
    proxyEnvironment = parseEnvironment(await readFile(proxyEnvironmentFile, 'utf8'));
    policy = JSON.parse(await readFile(accessFile, 'utf8'));
    catalog = JSON.parse(await readFile(catalogFile, 'utf8'));
  } catch {
    return ['live:host-configuration:unreadable'];
  }
  if (!record(policy) || policy.phase !== expectedPhase || !record(policy.secretStore) || !record(policy.kms)
    || !record(catalog)) return ['live:host-configuration:phase-or-shape'];

  let expectedPolicy;
  let expectedCatalog;
  try {
    const suffix = expectedPhase === 'bootstrap' ? '.bootstrap' : '';
    expectedPolicy = JSON.parse(await readFile(`${contract}/full-internal-access${suffix}.example.json`, 'utf8'));
    expectedCatalog = JSON.parse(await readFile(`${contract}/full-secrets${suffix}.example.json`, 'utf8'));
    if (canonical(redactPolicyTokens(policy)) !== canonical(redactPolicyTokens(expectedPolicy))) {
      missing.push('live:access-policy:boundary');
    }
    if (!sameStrings(Object.keys(catalog), Object.keys(expectedCatalog))) missing.push('live:secret-catalog:key-set');
  } catch {
    return ['live:host-configuration:release-contract'];
  }
  if (containsPlaceholder(policy) || containsPlaceholder(catalog)) missing.push('live:host-configuration:placeholder');

  const grants = [...Object.values(policy.secretStore), ...Object.values(policy.kms)];
  if (!grants.every((grant) => record(grant) && typeof grant.bearerToken === 'string'
    && bearer(grant.bearerToken) && Array.isArray(grant.resources))) missing.push('live:access-policy:grant');
  const bearers = grants.flatMap((grant) => record(grant) && typeof grant.bearerToken === 'string' ? [grant.bearerToken] : []);
  const objectToken = internalEnvironment.LOCAL_OBJECTS_TOKEN;
  if (new Set(bearers).size !== bearers.length || typeof objectToken !== 'string' || !bearer(objectToken)
    || bearers.includes(objectToken)) missing.push('live:access-policy:token-isolation');
  if (catalog['zhudatuan/staging/full/objects/jobs'] !== objectToken) missing.push('live:object-store:catalog-token-mismatch');
  if (internalEnvironment.LOCAL_WORKLOAD_ACCESS_POLICY_FILE !== accessFile
    || internalEnvironment.LOCAL_SECRETS_FILE !== catalogFile
    || internalEnvironment.LOCAL_OBJECTS_DIRECTORY !== '/var/lib/zhudatuan-staging-full/objects'
    || internalEnvironment.LOCAL_OBJECTS_PORT !== '8645'
    || !base64Url32(internalEnvironment.LOCAL_KMS_MASTER_KEY)) missing.push('live:internal-runtime:file-or-key-boundary');

  const workloadFiles = expectedPhase === 'bootstrap' ? {
    migration: `${shared}/full-migration.env`,
    'owner-bootstrap': `${shared}/full-owner-bootstrap.env`,
  } : {
    'identity-registration-api': `${shared}/full-identity-registration-api.env`,
    'identity-notification-jobs': `${shared}/full-identity-notification-jobs.env`,
    'full-jobs': `${shared}/full-jobs.env`,
  };
  const parsedEnvironments = new Map();
  for (const [workload, file] of Object.entries(workloadFiles)) {
    try {
      const environment = parseEnvironment(await readFile(file, 'utf8'));
      const example = parseEnvironment(await readFile(`${contract}/${basename(file)}.example`, 'utf8'));
      parsedEnvironments.set(file, environment);
      if (!sameStrings(Object.keys(environment), Object.keys(example)) || !fixedValuesMatch(environment, example)
        || containsPlaceholder(environment)) missing.push(`live:environment:${workload}:contract`);
      const secretGrant = policy.secretStore[workload];
      const kmsGrant = policy.kms[workload];
      if (secretGrant !== undefined && environment.SECRET_STORE_BEARER_TOKEN !== secretGrant.bearerToken) {
        missing.push(`live:access-policy:${workload}:secret-token`);
      }
      if (kmsGrant !== undefined && environment.KMS_BEARER_TOKEN !== kmsGrant.bearerToken) {
        missing.push(`live:access-policy:${workload}:kms-token`);
      }
      if (environment.SERVICE_VERSION !== undefined && environment.SERVICE_VERSION !== valueAt(evidence, 'candidate.commit')) {
        missing.push(`live:environment:${workload}:release`);
      }
    } catch {
      missing.push(`live:environment:${workload}`);
    }
  }
  const rdsInitFile = '/run/zhudatuan-staging-full/rds-init.env';
  const databaseRetireFile = '/run/zhudatuan-staging-full/database-retire.env';
  if (expectedPhase === 'bootstrap') {
    try {
      const environment = parseEnvironment(await readFile(rdsInitFile, 'utf8'));
      const example = parseEnvironment(await readFile(`${contract}/full-rds-init.env.example`, 'utf8'));
      parsedEnvironments.set(rdsInitFile, environment);
      const credentials = Object.entries(environment).filter(([key]) => key === 'PGPASSWORD' || key.endsWith('_PASSWORD'))
        .map(([, value]) => value);
      if (!sameStrings(Object.keys(environment), Object.keys(example)) || !fixedValuesMatch(environment, example)
        || containsPlaceholder(environment) || credentials.some((value) => value.length < 16)
        || new Set(credentials).size !== credentials.length) missing.push('live:environment:rds-init:contract');
    } catch {
      missing.push('live:environment:rds-init');
    }
    try {
      const environment = parseEnvironment(await readFile(databaseRetireFile, 'utf8'));
      const example = parseEnvironment(await readFile(`${contract}/full-database-retire.env.example`, 'utf8'));
      parsedEnvironments.set(databaseRetireFile, environment);
      const rdsInit = parsedEnvironments.get(rdsInitFile);
      if (!sameStrings(Object.keys(environment), Object.keys(example)) || !fixedValuesMatch(environment, example)
        || containsPlaceholder(environment) || environment.PGPASSWORD.length < 16
        || environment.PGUSER !== rdsInit?.POSTGRES_USER || environment.PGPASSWORD !== rdsInit?.PGPASSWORD) {
        missing.push('live:environment:database-retire:contract');
      }
    } catch {
      missing.push('live:environment:database-retire');
    }
  }
  try {
    const internalExample = parseEnvironment(await readFile(`${contract}/full-internal-runtime.env.example`, 'utf8'));
    const proxyExample = parseEnvironment(await readFile(`${contract}/full-postgres-proxy.env.example`, 'utf8'));
    if (!sameStrings(Object.keys(internalEnvironment), Object.keys(internalExample))
      || !fixedValuesMatch(internalEnvironment, internalExample) || containsPlaceholder(internalEnvironment)) {
      missing.push('live:environment:internal-runtime:contract');
    }
    if (!sameStrings(Object.keys(proxyEnvironment), Object.keys(proxyExample))
      || !fixedValuesMatch(proxyEnvironment, proxyExample) || containsPlaceholder(proxyEnvironment)) {
      missing.push('live:environment:postgres-proxy:contract');
    }
  } catch {
    missing.push('live:environment:release-contract');
  }

  const upstreamHost = proxyEnvironment.ZHUDATUAN_POSTGRES_PROXY_UPSTREAM_HOST;
  if (typeof upstreamHost !== 'string' || proxyEnvironment.ZHUDATUAN_POSTGRES_PROXY_UPSTREAM_PORT !== '5432'
    || proxyEnvironment.ZHUDATUAN_POSTGRES_PROXY_CA_FILE !== `${shared}/tls/aliyun-rds-ca.pem`
    || digest(upstreamHost) !== valueAt(evidence, 'rds.privateEndpointFingerprint')) {
    missing.push('live:postgres-proxy:registered-upstream');
  }

  if (expectedPhase === 'bootstrap') {
    validateDatabaseDsn(catalog['zhudatuan/staging/full/database/migration'], 'shopmigration', 'migration', missing);
    const ownerEnvironment = parsedEnvironments.get(`${shared}/full-owner-bootstrap.env`);
    validateDatabaseDsn(ownerEnvironment?.ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_URL, 'zhudatuanbootstrap', 'owner-bootstrap', missing);
    const rdsInit = parsedEnvironments.get(rdsInitFile);
    if (databasePassword(catalog['zhudatuan/staging/full/database/migration']) !== rdsInit?.SHOPMIGRATION_PASSWORD
      || databasePassword(ownerEnvironment?.ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_URL) !== rdsInit?.ZHUDATUAN_BOOTSTRAP_PASSWORD) {
      missing.push('live:rds-init:role-password-binding');
    }
    if (typeof rdsInit?.ZHUDATUAN_DATABASE_SENTINEL !== 'string'
      || rdsInit.ZHUDATUAN_DATABASE_SENTINEL !== ownerEnvironment?.ZHUDATUAN_OWNER_BOOTSTRAP_SENTINEL) {
      missing.push('live:rds-init:sentinel-binding');
    }
  } else {
    for (const retired of [`${shared}/full-migration.env`, `${shared}/full-owner-bootstrap.env`,
      '/run/zhudatuan-staging-full/rds-init.env', '/run/zhudatuan-staging-full/database-retire.env']) {
      try {
        await access(retired, constants.F_OK);
        missing.push(`live:one-shot-secret-not-removed:${basename(retired)}`);
      } catch (cause) {
        if (cause?.code !== 'ENOENT') missing.push(`live:one-shot-secret-removal-unverified:${basename(retired)}`);
      }
    }
    validateDatabaseDsn(catalog['zhudatuan/staging/full/database/identity-api'], 'zhudatuanidentityapi', 'identity-api', missing);
    validateDatabaseDsn(catalog['zhudatuan/staging/full/database/identity-notification-jobs'], 'zhudatuanidentityjob', 'identity-notification-jobs', missing);
    validateDatabaseDsn(catalog['zhudatuan/staging/full/database/jobs'], 'shopjob', 'full-jobs', missing);
    validateRuntimeHostsAndSms(evidence, parsedEnvironments, catalog, missing);
  }

  const protectedFiles = [
    internalEnvironmentFile, accessFile, catalogFile,
    `${shared}/tls/internal.key`, `${shared}/tls/internal.crt`, `${shared}/tls/internal-ca.crt`, `${shared}/tls/aliyun-rds-ca.pem`,
    proxyEnvironmentFile, ...Object.values(workloadFiles),
    ...(expectedPhase === 'bootstrap' ? [rdsInitFile, databaseRetireFile] : []),
  ];
  const modeLines = [];
  try {
    if (process.getuid?.() !== 0) throw new Error('ROOT_REQUIRED');
    for (const file of protectedFiles) {
      const information = await lstat(file);
      const mode = information.mode & 0o777;
      modeLines.push(`${file}:${information.uid}:${information.gid}:${mode.toString(8).padStart(4, '0')}`);
      if (!information.isFile() || information.isSymbolicLink() || information.uid !== 0
        || information.gid !== 0 || mode !== 0o600) missing.push(`live:file-boundary:${basename(file)}`);
    }
  } catch {
    missing.push('live:file-boundary:audit');
  }

  const environmentInventory = [...parsedEnvironments.entries(), [internalEnvironmentFile, internalEnvironment], [proxyEnvironmentFile, proxyEnvironment]]
    .map(([file, environment]) => `${basename(file)}:${Object.keys(environment).sort().join(',')}`).sort().join('\n');
  if (expectedPhase === 'bootstrap') {
    matchEvidence(evidence, 'hostConfiguration.fileModeAuditSha256', digest(modeLines.sort().join('\n')), missing, observed);
    matchEvidence(evidence, 'hostConfiguration.environmentInventorySha256', digest(environmentInventory), missing, observed);
    matchEvidence(evidence, 'hostConfiguration.secretCatalogKeySetSha256', digest(Object.keys(catalog).sort().join('\n')), missing, observed);
    await matchFileFingerprint(evidence, 'hostConfiguration.internalTlsCertificateFingerprint', `${shared}/tls/internal.crt`, missing, observed);
    matchEvidence(evidence, 'hostConfiguration.kmsMasterKeyFingerprint', digest(internalEnvironment.LOCAL_KMS_MASTER_KEY), missing, observed);
    await matchFileFingerprint(evidence, 'hostConfiguration.rdsCaFingerprint', `${shared}/tls/aliyun-rds-ca.pem`, missing, observed);
  } else {
    matchEvidence(evidence, 'hostConfiguration.kmsMasterKeyFingerprint', digest(internalEnvironment.LOCAL_KMS_MASTER_KEY), missing, observed);
    const boundary = canonical({ environmentInventory, fileModes: modeLines.sort(), policy: redactPolicyTokens(policy),
      secretKeys: Object.keys(catalog).sort(), upstreamHostFingerprint: digest(upstreamHost ?? '') });
    matchEvidence(evidence, 'hostConfiguration.runtimeBoundarySha256', digest(boundary), missing, observed);
  }
  return missing;
}

function validateDatabaseDsn(value, expectedUser, label, missing) {
  try {
    if (typeof value !== 'string') throw new Error('MISSING');
    const connection = new URL(value);
    const query = [...connection.searchParams.entries()];
    if (!['postgres:', 'postgresql:'].includes(connection.protocol) || connection.username !== expectedUser
      || (databasePassword(value)?.length ?? 0) < 16 || connection.hostname !== '127.0.0.1' || connection.port !== '55442'
      || connection.pathname !== '/zhudatuan_registration' || connection.hash
      || canonical(query) !== canonical([['sslmode', 'disable']])) throw new Error('BOUNDARY');
  } catch {
    missing.push(`live:database-dsn:${label}`);
  }
}

function databasePassword(value) {
  try { return typeof value === 'string' ? decodeURIComponent(new URL(value).password) : undefined; }
  catch { return undefined; }
}

function validateRuntimeHostsAndSms(evidence, environments, catalog, missing) {
  const api = environments.get(`${FULL_ROOT}/shared/full-identity-registration-api.env`);
  const hosts = {
    accounts: valueAt(evidence, 'runtime.accountsHost'),
    console: valueAt(evidence, 'runtime.consoleHost'),
  };
  if (!api || new Set((api.API_ALLOWED_ORIGINS ?? '').split(',')).size !== 2
    || !sameStrings((api.API_ALLOWED_ORIGINS ?? '').split(','), [`https://${hosts.accounts}`, `https://${hosts.console}`])) {
    missing.push('live:identity-api:origins');
  }
  try {
    const targets = JSON.parse(api?.AUTH_RETURN_TARGETS ?? '');
    if (!record(targets) || targets.console !== `https://${hosts.console}`
      || typeof targets.store !== 'string' || !targets.store.startsWith(`https://${hosts.console}/`)
      || typeof targets.supplier !== 'string' || !targets.supplier.startsWith(`https://${hosts.console}/`)) throw new Error('TARGETS');
  } catch {
    missing.push('live:identity-api:return-targets');
  }
  try {
    const redis = new URL(catalog['zhudatuan/staging/full/redis/jobs']);
    if (redis.protocol !== 'rediss:' || !redis.hostname || !redis.password
      || digest(redis.hostname) !== valueAt(evidence, 'tair.privateEndpointFingerprint')) throw new Error('REDIS');
  } catch {
    missing.push('live:redis:registered-tls-endpoint');
  }
  try {
    const configuration = JSON.parse(catalog['zhudatuan/staging/full/notification/identity-sms']);
    const sms = configuration?.sms;
    if (!record(configuration) || !record(sms) || Object.hasOwn(sms, 'accessKeyId') || Object.hasOwn(sms, 'accessKeySecret')
      || sms.roleName !== valueAt(evidence, 'sms.runtimeRoleName')
      || digest(sms.signName ?? '') !== valueAt(evidence, 'sms.signNameFingerprint')
      || digest(sms.verificationTemplate ?? '') !== valueAt(evidence, 'sms.templateCodeFingerprint')
      || typeof sms.endpoint !== 'string' || !sms.endpoint.endsWith('.aliyuncs.com')) throw new Error('SMS');
  } catch {
    missing.push('live:sms:ram-role-configuration');
  }
}
