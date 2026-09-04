import type {
  AliyunSmsConfiguration,
} from './AliyunSmsChannel';

export interface IdentityNotificationConfiguration {
  readonly sms: AliyunSmsConfiguration;
}

export function parseIdentityNotificationConfiguration(source: string): IdentityNotificationConfiguration {
  const root = parseObject(source);
  if (Object.keys(root).join(',') !== 'sms' || !isObject(root.sms)) invalid();
  const sms = root.sms;
  const allowed = new Set(['accessKeyId', 'accessKeySecret', 'endpoint', 'region', 'roleName', 'signName', 'verificationTemplate']);
  if (Object.keys(sms).some((key) => !allowed.has(key))) invalid();
  const signName = requiredText(sms.signName);
  const verificationTemplate = requiredText(sms.verificationTemplate);
  const endpoint = requiredText(sms.endpoint).toLowerCase();
  const region = requiredText(sms.region).toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?\.aliyuncs\.com$/.test(endpoint)
    || !/^cn-[a-z0-9-]{2,30}$/.test(region)
    || !/^SMS_[0-9]{4,32}$/.test(verificationTemplate)) invalid();
  const roleName = optionalText(sms.roleName);
  const accessKeyId = optionalText(sms.accessKeyId);
  const accessKeySecret = optionalText(sms.accessKeySecret);
  if ((roleName !== null) === (accessKeyId !== null || accessKeySecret !== null)
    || (accessKeyId === null) !== (accessKeySecret === null)) invalid();
  const configuration: AliyunSmsConfiguration = {
    signName,
    verificationTemplate,
    endpoint,
    region,
    ...(roleName !== null ? { roleName } : { accessKeyId: accessKeyId!, accessKeySecret: accessKeySecret! }),
  };
  return Object.freeze({ sms: Object.freeze(configuration) });
}

function parseObject(source: string): Readonly<Record<string, unknown>> {
  let value: unknown;
  try { value = JSON.parse(source); } catch { invalid(); }
  if (!isObject(value)) invalid();
  return value;
}

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) invalid();
  return value.trim();
}

function optionalText(value: unknown): string | null {
  if (value === undefined) return null;
  return requiredText(value);
}

function invalid(): never { throw new Error('IDENTITY_NOTIFICATION_CONFIGURATION_INVALID'); }
