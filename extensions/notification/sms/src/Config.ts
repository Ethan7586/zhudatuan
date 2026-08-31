import { secretRef, type SecretRef } from '@shop/contract';

export interface SmsConfiguration {
  readonly signName: string;
  readonly verificationTemplate: string;
  readonly endpoint: string;
  readonly region: string;
  readonly credentialRef: SecretRef | null;
  readonly roleName: string | null;
}

export interface SmsCredential {
  readonly accessKeyId: string;
  readonly accessKeySecret: string;
}

export function parseSmsConfiguration(value: unknown): SmsConfiguration {
  const source = record(value, 'SMS_CONFIGURATION_INVALID');
  const allowed = ['credentialRef', 'endpoint', 'region', 'roleName', 'signName', 'verificationTemplate'];
  if (Object.keys(source).some((key) => !allowed.includes(key))) throw new Error('SMS_CONFIGURATION_INVALID');
  const credentialRef = source.credentialRef === null || source.credentialRef === undefined ? null : secretRef(source.credentialRef);
  const roleName = source.roleName === null || source.roleName === undefined ? null : text(source.roleName, 'SMS_ROLE_INVALID', 2, 64);
  if ((credentialRef === null) === (roleName === null)) throw new Error('SMS_CREDENTIAL_SOURCE_INVALID');
  const endpoint = text(source.endpoint, 'SMS_ENDPOINT_INVALID', 3, 255);
  if (!/^[a-z0-9.-]+\.aliyuncs\.com$/.test(endpoint)) throw new Error('SMS_ENDPOINT_INVALID');
  return Object.freeze({
    signName: text(source.signName, 'SMS_SIGN_INVALID', 1, 100),
    verificationTemplate: text(source.verificationTemplate, 'SMS_TEMPLATE_INVALID', 4, 64),
    endpoint,
    region: text(source.region, 'SMS_REGION_INVALID', 2, 64),
    credentialRef,
    roleName,
  });
}

export function parseSmsCredential(value: string): SmsCredential {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('SMS_CREDENTIAL_INVALID');
  }
  const source = record(parsed, 'SMS_CREDENTIAL_INVALID');
  if (Object.keys(source).sort().join(',') !== 'accessKeyId,accessKeySecret') throw new Error('SMS_CREDENTIAL_INVALID');
  return Object.freeze({ accessKeyId: text(source.accessKeyId, 'SMS_CREDENTIAL_INVALID', 8, 128), accessKeySecret: text(source.accessKeySecret, 'SMS_CREDENTIAL_INVALID', 16, 256) });
}

function record(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown, code: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > maximum) throw new Error(code);
  return value.trim();
}
