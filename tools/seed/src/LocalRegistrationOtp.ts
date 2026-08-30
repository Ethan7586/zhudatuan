import { createHmac } from 'node:crypto';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const SECRET_REFERENCE = /^[a-z0-9][a-z0-9/.-]{2,255}$/;
const MOBILE = /^(?:1[3-9][0-9]{9}|\+[1-9][0-9]{7,14})$/;

export const LOCAL_REGISTRATION_OTP_COPIED = 'LOCAL_REGISTRATION_OTP_COPIED\n';

export interface LocalRegistrationOtpInput {
  readonly appEnv: string | undefined;
  readonly mobile: string | undefined;
  readonly platform: NodeJS.Platform;
  readonly secretStoreEndpoint: string;
  readonly kmsEndpoint: string;
  readonly adminDatabaseConnectionRef: string;
  readonly identityKeyRef: string;
}

interface RegistrationChallenge {
  readonly id: string;
  readonly code_ciphertext: string;
}

interface Database {
  query(text: string, values: readonly unknown[]): Promise<{ readonly rows: readonly RegistrationChallenge[] }>;
  end(): Promise<void>;
}

export interface LocalRegistrationOtpDependencies {
  readonly readSecret: (endpoint: string, reference: string) => Promise<string>;
  readonly openDatabase: (connectionString: string) => Promise<Database>;
  readonly decrypt: (endpoint: string, keyRef: string, ciphertext: string, context: Readonly<Record<string, string>>) => Promise<string>;
  readonly copy: (value: string) => Promise<void>;
}

export async function copyLatestLocalRegistrationOtp(
  input: LocalRegistrationOtpInput,
  dependencies: LocalRegistrationOtpDependencies
): Promise<void> {
  const mobile = localInput(input);
  const [connectionString, identityKey] = await Promise.all([
    dependencies.readSecret(input.secretStoreEndpoint, input.adminDatabaseConnectionRef),
    dependencies.readSecret(input.secretStoreEndpoint, input.identityKeyRef),
  ]);
  assertLoopbackPostgres(connectionString);
  if (identityKey.length < 32) throw new Error('LOCAL_OTP_IDENTITY_KEY_INVALID');

  const database = await dependencies.openDatabase(connectionString);
  let challenge: RegistrationChallenge | undefined;
  try {
    const destinationHash = createHmac('sha256', identityKey).update(mobile.toLowerCase()).digest('hex');
    const result = await database.query(`select challenge.id,secret.code_ciphertext
      from identity.challenge challenge join identity.challengesecret secret on secret.challenge_id=challenge.id
      where challenge.purpose='registration' and challenge.destination_hash=$1
        and challenge.consumed_at is null and challenge.expires_at>clock_timestamp() and challenge.attempts<10
      order by challenge.created_at desc,challenge.id desc limit 1`, [destinationHash]);
    challenge = result.rows[0];
  } finally {
    await database.end();
  }
  if (!challenge) throw new Error('LOCAL_REGISTRATION_OTP_NOT_FOUND');

  const code = await dependencies.decrypt(input.kmsEndpoint, 'identity/challenge', challenge.code_ciphertext, {
    challenge: challenge.id,
    purpose: 'registration',
  });
  if (!/^[0-9]{6}$/.test(code)) throw new Error('LOCAL_REGISTRATION_OTP_INVALID');
  await dependencies.copy(code);
}

function localInput(input: LocalRegistrationOtpInput): string {
  if (input.appEnv !== 'development') throw new Error('LOCAL_OTP_ENVIRONMENT_REQUIRED');
  if (input.platform !== 'darwin') throw new Error('LOCAL_OTP_MACOS_REQUIRED');
  assertLoopbackHttps(input.secretStoreEndpoint, 'LOCAL_OTP_SECRET_STORE_INVALID');
  assertLoopbackHttps(input.kmsEndpoint, 'LOCAL_OTP_KMS_INVALID');
  if (!SECRET_REFERENCE.test(input.adminDatabaseConnectionRef) || !SECRET_REFERENCE.test(input.identityKeyRef)) {
    throw new Error('LOCAL_OTP_SECRET_REFERENCE_INVALID');
  }
  const mobile = input.mobile?.trim() ?? '';
  if (!MOBILE.test(mobile)) throw new Error('LOCAL_OTP_MOBILE_INVALID');
  return mobile;
}

function assertLoopbackHttps(value: string, code: string): void {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new Error(code);
  }
  if (endpoint.protocol !== 'https:' || !LOCAL_HOSTS.has(endpoint.hostname) || endpoint.username || endpoint.password) throw new Error(code);
}

function assertLoopbackPostgres(value: string): void {
  let connection: URL;
  try {
    connection = new URL(value);
  } catch {
    throw new Error('LOCAL_OTP_DATABASE_INVALID');
  }
  if (!['postgres:', 'postgresql:'].includes(connection.protocol) || !LOCAL_HOSTS.has(connection.hostname)) {
    throw new Error('LOCAL_OTP_DATABASE_INVALID');
  }
}
