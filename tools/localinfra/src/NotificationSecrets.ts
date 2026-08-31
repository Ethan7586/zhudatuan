const notificationRef = 'shop/local/notification';
const smsCredentialRef = 'shop/local/notification/sms';

export interface LocalNotificationSecrets {
  readonly emailBearer: string;
  readonly smsAccessKeySecret: string;
  readonly wechatAppSecret: string;
}

export function createNotificationSecrets(secrets: LocalNotificationSecrets): Readonly<Record<string, string>> {
  return Object.freeze({
    [smsCredentialRef]: JSON.stringify({ accessKeyId: 'localaccesskey', accessKeySecret: secrets.smsAccessKeySecret }),
    [notificationRef]: JSON.stringify({
      email: { bearer: secrets.emailBearer, endpoint: 'https://email.local.invalid', provider: 'localemail', sender: 'noreply@local.invalid' },
      sms: { credentialRef: smsCredentialRef, endpoint: 'dysmsapi.aliyuncs.com', region: 'cn-hangzhou', roleName: null, signName: '本地商城', verificationTemplate: 'SMS_LOCAL_VERIFY' },
      wechat: { appId: 'wxLocalMiniapp0001', appSecret: secrets.wechatAppSecret, page: 'pages/home/index', state: 'developer' },
    }),
  });
}

export function normalizeNotificationSecrets(catalog: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  const notification = record(parse(catalog[notificationRef]), 'LOCAL_NOTIFICATION_CONFIG_INVALID');
  const sms = record(notification.sms, 'LOCAL_SMS_CONFIG_INVALID');
  const inlineId = sms.accessKeyId;
  const inlineSecret = sms.accessKeySecret;
  if (inlineId === undefined && inlineSecret === undefined) return catalog;
  if (typeof inlineId !== 'string' || inlineId.length < 8 || typeof inlineSecret !== 'string' || inlineSecret.length < 16 || sms.credentialRef !== undefined || sms.roleName !== undefined) {
    throw new Error('LOCAL_SMS_CONFIG_INVALID');
  }
  const { accessKeyId: _id, accessKeySecret: _secret, ...configuration } = sms;
  return Object.freeze({
    ...catalog,
    [smsCredentialRef]: JSON.stringify({ accessKeyId: inlineId, accessKeySecret: inlineSecret }),
    [notificationRef]: JSON.stringify({ ...notification, sms: { ...configuration, credentialRef: smsCredentialRef, roleName: null } }),
  });
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
