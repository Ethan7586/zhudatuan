import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { LOCAL_CREDENTIAL_KEYS, LOCAL_ENVIRONMENT_KEYS, LOCAL_SECRET_REFS, localLaunchEnvironment } from '@shop/config/server';

const arguments_ = process.argv.slice(2);
if (arguments_.length === 0) throw new Error('LOCAL_LAUNCH_ARGUMENTS_MISSING');
const launchEnvironment = localLaunchEnvironment();
const credentialsFile = requiredPath(launchEnvironment.credentialsFile, 'LOCAL_CREDENTIALS_FILE_INVALID');
const secretsFile = requiredPath(launchEnvironment.secretsFile, 'LOCAL_SECRETS_FILE_INVALID');
const credentials = await json(credentialsFile);
const secrets = await json(secretsFile);

const environment: NodeJS.ProcessEnv = {
  ...process.env,
  [LOCAL_ENVIRONMENT_KEYS.kmsBearerToken]: required(credentials, LOCAL_CREDENTIAL_KEYS.kmsBearerToken),
  [LOCAL_ENVIRONMENT_KEYS.secretStoreBearerToken]: required(credentials, LOCAL_CREDENTIAL_KEYS.secretStoreBearerToken),
  KMS_BEARER_TOKEN: required(credentials, LOCAL_CREDENTIAL_KEYS.kmsBearerToken),
  SECRET_STORE_BEARER_TOKEN: required(credentials, LOCAL_CREDENTIAL_KEYS.secretStoreBearerToken),
  [LOCAL_ENVIRONMENT_KEYS.kmsMasterKey]: required(secrets, LOCAL_SECRET_REFS.kmsMaster),
  [LOCAL_ENVIRONMENT_KEYS.objectsToken]: required(secrets, LOCAL_SECRET_REFS.objects),
  [LOCAL_ENVIRONMENT_KEYS.postgresPassword]: required(secrets, LOCAL_SECRET_REFS.postgresAdmin),
  [LOCAL_ENVIRONMENT_KEYS.postgresApiPassword]: required(secrets, LOCAL_SECRET_REFS.postgresApi),
  [LOCAL_ENVIRONMENT_KEYS.postgresJobsPassword]: required(secrets, LOCAL_SECRET_REFS.postgresJobs),
  [LOCAL_ENVIRONMENT_KEYS.postgresProviderPassword]: required(secrets, LOCAL_SECRET_REFS.postgresProvider),
  [LOCAL_ENVIRONMENT_KEYS.redisPassword]: required(secrets, LOCAL_SECRET_REFS.redis),
};
const child = spawn(process.execPath, arguments_, { cwd: process.cwd(), env: environment, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => child.kill(signal));
child.once('error', (cause) => {
  throw cause;
});
child.once('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

async function json(path: string): Promise<Readonly<Record<string, string>>> {
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Object.values(parsed).every((value) => typeof value === 'string' && value.length > 0)) throw new Error('LOCAL_CREDENTIAL_CATALOG_INVALID');
  return Object.freeze(parsed as Record<string, string>);
}

function required(source: Readonly<Record<string, string>>, key: string): string {
  const value = source[key];
  if (!value) throw new Error(`LOCAL_CREDENTIAL_MISSING:${key}`);
  return value;
}

function requiredPath(value: string | undefined, code: string): string {
  if (!value || !isAbsolute(value) || value === '/') throw new Error(code);
  return value;
}
