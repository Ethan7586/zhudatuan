const DATABASE_NAME = 'zhudatuan_registration';
const DATABASE_ROLE = 'zhudatuansandboxbootstrap';
const DATABASE_HOST = '127.0.0.1';
const DATABASE_PORT = '55432';
const SENTINEL_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const MEMBERSHIP_PATTERN = /^[A-Za-z0-9:._-]{3,255}$/;

export const SANDBOX_QUALIFICATION_CONFIRMATION = 'QUALIFY_ONE_REGISTERED_ZHUDATUAN_SANDBOX_MEMBER_ONLY';
export const SANDBOX_QUALIFICATION_SCHEMA_VERSION = '20260828180000';
export const SANDBOX_QUALIFICATION_SCHEMA_CHECKSUM = '0d3eb3e766c32ea0dada6a982bb07a1e797f0b3a08d8104235f2894f3721d81c';

export interface SandboxQualificationBootstrapEnvironment {
  readonly connectionString: string;
  readonly expectedDatabase: typeof DATABASE_NAME;
  readonly membership: string;
  readonly sentinel: string;
}

export function sandboxQualificationBootstrapEnvironment(source: NodeJS.ProcessEnv): SandboxQualificationBootstrapEnvironment {
  if (source.APP_ENV !== 'test') throw new Error('SANDBOX_QUALIFICATION_TEST_ENV_REQUIRED');
  if (source.ZHUDATUAN_SANDBOX_QUALIFICATION_CONFIRM !== SANDBOX_QUALIFICATION_CONFIRMATION) {
    throw new Error('SANDBOX_QUALIFICATION_CONFIRMATION_REQUIRED');
  }
  const connectionString = required(source.ZHUDATUAN_SANDBOX_QUALIFICATION_DATABASE_URL,
    'SANDBOX_QUALIFICATION_DATABASE_URL_REQUIRED');
  let databaseUrl: URL;
  try { databaseUrl = new URL(connectionString); }
  catch { throw new Error('SANDBOX_QUALIFICATION_DATABASE_URL_INVALID'); }
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol) || databaseUrl.hash || databaseUrl.search
    || databaseUrl.hostname !== DATABASE_HOST || databaseUrl.port !== DATABASE_PORT
    || decodeURIComponent(databaseUrl.pathname.slice(1)) !== DATABASE_NAME
    || decodeURIComponent(databaseUrl.username) !== DATABASE_ROLE || databaseUrl.password.length < 16) {
    throw new Error('SANDBOX_QUALIFICATION_DATABASE_ENDPOINT_INVALID');
  }
  const expectedDatabase = required(source.ZHUDATUAN_SANDBOX_QUALIFICATION_DATABASE_NAME,
    'SANDBOX_QUALIFICATION_DATABASE_NAME_REQUIRED');
  if (expectedDatabase !== DATABASE_NAME) throw new Error('SANDBOX_QUALIFICATION_DATABASE_NAME_MISMATCH');
  const sentinel = required(source.ZHUDATUAN_SANDBOX_QUALIFICATION_SENTINEL,
    'SANDBOX_QUALIFICATION_SENTINEL_REQUIRED');
  if (!SENTINEL_PATTERN.test(sentinel)) throw new Error('SANDBOX_QUALIFICATION_SENTINEL_INVALID');
  const membership = required(source.ZHUDATUAN_SANDBOX_QUALIFICATION_MEMBERSHIP,
    'SANDBOX_QUALIFICATION_MEMBERSHIP_REQUIRED');
  if (!MEMBERSHIP_PATTERN.test(membership)) throw new Error('SANDBOX_QUALIFICATION_MEMBERSHIP_INVALID');
  return Object.freeze({ connectionString, expectedDatabase: DATABASE_NAME, membership, sentinel });
}

export function sandboxQualificationBootstrapSummary(membership: string): string {
  return `ZHUDATUAN_SANDBOX_QUALIFICATION_READY membership=${membership} status=active benefitMinor=0 sandbox=true`;
}

function required(value: string | undefined, code: string): string {
  const result = value?.trim();
  if (!result) throw new Error(code);
  return result;
}
