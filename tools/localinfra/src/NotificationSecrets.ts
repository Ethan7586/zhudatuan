const notificationRef = 'shop/local/notification';
const emailCredentialRef = 'shop/local/notification/email';
const smsCredentialRef = 'shop/local/notification/sms';
const wechatCredentialRef = 'shop/local/notification/wechat';

const emailRuntimePolicy = Object.freeze({
  endpoint: 'https://email.local.invalid',
  provider: 'localemail',
  sender: 'noreply@local.invalid',
  credentialRef: emailCredentialRef,
  priority: 20,
});
const smsRuntimePolicy = Object.freeze({
  credentialRef: smsCredentialRef,
  endpoint: 'dysmsapi.aliyuncs.com',
  region: 'cn-hangzhou',
  roleName: null,
  signName: '本地商城',
  verificationTemplate: 'SMS_LOCALVERIFY',
  templates: Object.freeze({ transactional: Object.freeze({}), marketing: Object.freeze({}) }),
  optOut: Object.freeze({ variable: 'unsubscribe', text: '回复T退订', keywords: Object.freeze(['T', 'TD']) }),
});
const wechatRuntimePolicy = Object.freeze({
  appId: 'wxLocalMiniapp0001',
  credentialRef: wechatCredentialRef,
  page: 'pages/home/index',
  priority: 10,
  state: 'developer',
  templates: Object.freeze({
    paid: Object.freeze({ id: 'localtemplatepaid1', variables: Object.freeze({ order: 'character_string1' }) }),
  }),
});

interface SmsCredential {
  readonly accessKeyId: string;
  readonly accessKeySecret: string;
}

export interface LocalNotificationSecrets {
  readonly emailBearer: string;
  readonly smsAccessKeySecret: string;
  readonly wechatAppSecret: string;
}

export function createNotificationSecrets(secrets: LocalNotificationSecrets): Readonly<Record<string, string>> {
  return notificationSecrets(emailCredential(secrets.emailBearer), smsCredential({ accessKeyId: 'localaccesskey', accessKeySecret: secrets.smsAccessKeySecret }), wechatCredential(secrets.wechatAppSecret));
}

export function normalizeNotificationSecrets(catalog: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  const notification = record(parse(catalog[notificationRef]), 'LOCAL_NOTIFICATION_CONFIG_INVALID');
  const email = record(notification.email, 'LOCAL_EMAIL_CONFIG_INVALID');
  const sms = record(notification.sms, 'LOCAL_SMS_CONFIG_INVALID');
  const wechat = record(notification.wechat, 'LOCAL_WECHAT_CONFIG_INVALID');
  const normalized = {
    ...catalog,
    ...notificationSecrets(
      emailCredential(resolveSecret(catalog, email.bearer, email.credentialRef, emailCredentialRef, 'LOCAL_EMAIL_CREDENTIAL_INVALID')),
      resolveSmsCredential(catalog, sms),
      wechatCredential(resolveSecret(catalog, wechat.appSecret, wechat.credentialRef, wechatCredentialRef, 'LOCAL_WECHAT_CREDENTIAL_INVALID'))
    ),
  };
  removeSupersededReference(normalized, email.credentialRef, emailCredentialRef);
  removeSupersededReference(normalized, sms.credentialRef, smsCredentialRef);
  removeSupersededReference(normalized, wechat.credentialRef, wechatCredentialRef);
  if (sameCatalog(catalog, normalized)) return catalog;
  return Object.freeze(normalized);
}

function notificationSecrets(emailBearer: string, sms: SmsCredential, wechatAppSecret: string): Readonly<Record<string, string>> {
  return Object.freeze({
    [emailCredentialRef]: emailBearer,
    [smsCredentialRef]: JSON.stringify(sms),
    [wechatCredentialRef]: wechatAppSecret,
    [notificationRef]: JSON.stringify({
      email: emailRuntimePolicy,
      sms: smsRuntimePolicy,
      wechat: wechatRuntimePolicy,
    }),
  });
}

function resolveSmsCredential(catalog: Readonly<Record<string, string>>, sms: Readonly<Record<string, unknown>>): SmsCredential {
  if (sms.accessKeyId !== undefined || sms.accessKeySecret !== undefined) {
    if (sms.credentialRef !== undefined || (sms.roleName !== undefined && sms.roleName !== null)) throw new Error('LOCAL_SMS_CONFIG_INVALID');
    return smsCredential({ accessKeyId: sms.accessKeyId, accessKeySecret: sms.accessKeySecret });
  }
  if (sms.roleName !== undefined && sms.roleName !== null) throw new Error('LOCAL_SMS_CONFIG_INVALID');
  const value = referencedSecret(catalog, sms.credentialRef, smsCredentialRef, 'LOCAL_SMS_CREDENTIAL_INVALID');
  return smsCredential(parse(value));
}

function resolveSecret(catalog: Readonly<Record<string, string>>, inline: unknown, configuredReference: unknown, canonicalReference: string, code: string): string {
  if (inline !== undefined) {
    if (configuredReference !== undefined) throw new Error(code);
    return text(inline, code, 16, 1_024);
  }
  return referencedSecret(catalog, configuredReference, canonicalReference, code);
}

function referencedSecret(catalog: Readonly<Record<string, string>>, configuredReference: unknown, canonicalReference: string, code: string): string {
  const reference = configuredReference === undefined ? canonicalReference : text(configuredReference, code, 3, 256);
  return text(catalog[reference], code, 16, 4_096);
}

function emailCredential(value: unknown): string {
  return text(value, 'LOCAL_EMAIL_CREDENTIAL_INVALID', 16, 1_024);
}

function wechatCredential(value: unknown): string {
  return text(value, 'LOCAL_WECHAT_CREDENTIAL_INVALID', 16, 1_024);
}

function smsCredential(value: unknown): SmsCredential {
  const source = record(value, 'LOCAL_SMS_CREDENTIAL_INVALID');
  if (Object.keys(source).sort().join(',') !== 'accessKeyId,accessKeySecret') throw new Error('LOCAL_SMS_CREDENTIAL_INVALID');
  return Object.freeze({
    accessKeyId: text(source.accessKeyId, 'LOCAL_SMS_CREDENTIAL_INVALID', 8, 128),
    accessKeySecret: text(source.accessKeySecret, 'LOCAL_SMS_CREDENTIAL_INVALID', 16, 256),
  });
}

function removeSupersededReference(catalog: Record<string, string>, configured: unknown, canonical: string): void {
  if (typeof configured === 'string' && configured !== canonical && configured.startsWith(`${notificationRef}/`)) delete catalog[configured];
}

function sameCatalog(left: Readonly<Record<string, string>>, right: Readonly<Record<string, string>>): boolean {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
}

function parse(value: string | undefined): unknown {
  if (!value) throw new Error('LOCAL_NOTIFICATION_CONFIG_MISSING');
  try {
    return JSON.parse(value);
  } catch (cause) {
    throw new Error('LOCAL_NOTIFICATION_CONFIG_INVALID', { cause });
  }
}

function record(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown, code: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > maximum) throw new Error(code);
  return value.trim();
}
