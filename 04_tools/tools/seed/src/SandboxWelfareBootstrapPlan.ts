const DATABASE_NAME = 'zhudatuan_registration';
const DATABASE_ROLE = 'zhudatuansandboxbootstrap';
const DATABASE_HOST = '127.0.0.1';
const DATABASE_PORT = '55432';
const SENTINEL_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const MEMBERSHIP_PATTERN = /^[A-Za-z0-9:._-]{3,255}$/;

export const SANDBOX_WELFARE_CONFIRMATION = 'OWNER_APPROVES_ONE_EXPLICIT_SANDBOX_WELFARE_GRANT';
export const SANDBOX_WELFARE_SCHEMA_VERSION = '20260828180000';
export const SANDBOX_WELFARE_SCHEMA_CHECKSUM = '0d3eb3e766c32ea0dada6a982bb07a1e797f0b3a08d8104235f2894f3721d81c';

export interface SandboxWelfareBootstrapEnvironment {
  readonly amountMinor: number;
  readonly confirmation: typeof SANDBOX_WELFARE_CONFIRMATION;
  readonly connectionString: string;
  readonly currency: 'CNY';
  readonly expectedDatabase: typeof DATABASE_NAME;
  readonly membership: string;
  readonly sentinel: string;
}

export function sandboxWelfareBootstrapEnvironment(source: NodeJS.ProcessEnv): SandboxWelfareBootstrapEnvironment {
  if (source.APP_ENV !== 'test') throw new Error('SANDBOX_WELFARE_TEST_ENV_REQUIRED');
  if (source.ZHUDATUAN_SANDBOX_WELFARE_CONFIRM !== SANDBOX_WELFARE_CONFIRMATION) {
    throw new Error('SANDBOX_WELFARE_OWNER_CONFIRMATION_REQUIRED');
  }
  const connectionString = required(source.ZHUDATUAN_SANDBOX_WELFARE_DATABASE_URL,
    'SANDBOX_WELFARE_DATABASE_URL_REQUIRED');
  let databaseUrl: URL;
  try { databaseUrl = new URL(connectionString); }
  catch { throw new Error('SANDBOX_WELFARE_DATABASE_URL_INVALID'); }
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol) || databaseUrl.hash || databaseUrl.search
    || databaseUrl.hostname !== DATABASE_HOST || databaseUrl.port !== DATABASE_PORT
    || decodeURIComponent(databaseUrl.pathname.slice(1)) !== DATABASE_NAME
    || decodeURIComponent(databaseUrl.username) !== DATABASE_ROLE || databaseUrl.password.length < 16) {
    throw new Error('SANDBOX_WELFARE_DATABASE_ENDPOINT_INVALID');
  }
  const expectedDatabase = required(source.ZHUDATUAN_SANDBOX_WELFARE_DATABASE_NAME,
    'SANDBOX_WELFARE_DATABASE_NAME_REQUIRED');
  if (expectedDatabase !== DATABASE_NAME) throw new Error('SANDBOX_WELFARE_DATABASE_NAME_MISMATCH');
  const sentinel = required(source.ZHUDATUAN_SANDBOX_WELFARE_SENTINEL, 'SANDBOX_WELFARE_SENTINEL_REQUIRED');
  if (!SENTINEL_PATTERN.test(sentinel)) throw new Error('SANDBOX_WELFARE_SENTINEL_INVALID');
  const membership = required(source.ZHUDATUAN_SANDBOX_WELFARE_MEMBERSHIP, 'SANDBOX_WELFARE_MEMBERSHIP_REQUIRED');
  if (!MEMBERSHIP_PATTERN.test(membership)) throw new Error('SANDBOX_WELFARE_MEMBERSHIP_INVALID');
  const amountSource = required(source.ZHUDATUAN_SANDBOX_WELFARE_AMOUNT_MINOR, 'SANDBOX_WELFARE_AMOUNT_REQUIRED');
  if (!/^[1-9][0-9]{0,6}$/.test(amountSource)) throw new Error('SANDBOX_WELFARE_AMOUNT_INVALID');
  const amountMinor = Number(amountSource);
  if (!Number.isSafeInteger(amountMinor) || amountMinor > 1_000_000) throw new Error('SANDBOX_WELFARE_AMOUNT_INVALID');
  const currency = required(source.ZHUDATUAN_SANDBOX_WELFARE_CURRENCY, 'SANDBOX_WELFARE_CURRENCY_REQUIRED');
  if (currency !== 'CNY') throw new Error('SANDBOX_WELFARE_CURRENCY_INVALID');
  return Object.freeze({ amountMinor, confirmation: SANDBOX_WELFARE_CONFIRMATION, connectionString,
    currency: 'CNY', expectedDatabase: DATABASE_NAME, membership, sentinel });
}

export function sandboxWelfareBootstrapSummary(membership: string, amountMinor: number): string {
  return `ZHUDATUAN_SANDBOX_WELFARE_READY membership=${membership} amountMinor=${amountMinor} currency=CNY sandbox=true`;
}

function required(value: string | undefined, code: string): string {
  const result = value?.trim();
  if (!result) throw new Error(code);
  return result;
}
