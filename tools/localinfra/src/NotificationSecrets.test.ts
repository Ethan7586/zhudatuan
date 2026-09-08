import { describe, expect, it } from 'vitest';
import { createNotificationSecrets, normalizeNotificationSecrets } from './NotificationSecrets';

const values = Object.freeze({
  emailBearer: 'email-bearer-value-long',
  smsAccessKeySecret: 'sms-secret-value-long',
  wechatAppSecret: 'wechat-secret-value-long',
});

describe('NotificationSecrets', () => {
  it('stores every provider credential separately from its delivery configuration', () => {
    const catalog = createNotificationSecrets(values);
    const notification = JSON.parse(catalog['shop/local/notification']!);

    expect(notification.email).toEqual({
      endpoint: 'https://email.local.invalid',
      provider: 'localemail',
      sender: 'noreply@local.invalid',
      credentialRef: 'shop/local/notification/email',
      priority: 20,
    });
    expect(notification.sms).toEqual({
      credentialRef: 'shop/local/notification/sms',
      endpoint: 'dysmsapi.aliyuncs.com',
      region: 'cn-hangzhou',
      roleName: null,
      signName: '本地商城',
      verificationTemplate: 'SMS_LOCALVERIFY',
      templates: { transactional: {}, marketing: {} },
      optOut: { variable: 'unsubscribe', text: '回复T退订', keywords: ['T', 'TD'] },
    });
    expect(notification.wechat).toEqual({
      appId: 'wxLocalMiniapp0001',
      credentialRef: 'shop/local/notification/wechat',
      page: 'pages/home/index',
      priority: 10,
      state: 'developer',
      templates: { paid: { id: 'localtemplatepaid1', variables: { order: 'character_string1' } } },
    });
    expect(notification.email).not.toHaveProperty('bearer');
    expect(notification.sms).not.toHaveProperty('accessKeyId');
    expect(notification.wechat).not.toHaveProperty('appSecret');
    expect(catalog['shop/local/notification/email']).toBe(values.emailBearer);
    expect(JSON.parse(catalog['shop/local/notification/sms']!)).toEqual({ accessKeyId: 'localaccesskey', accessKeySecret: values.smsAccessKeySecret });
    expect(catalog['shop/local/notification/wechat']).toBe(values.wechatAppSecret);
  });

  it('hard-cuts existing inline credentials into dedicated secrets', () => {
    const catalog = normalizeNotificationSecrets({
      'shop/local/notification': JSON.stringify({
        email: { bearer: values.emailBearer, endpoint: 'https://email.local.invalid', provider: 'localemail', sender: 'noreply@local.invalid' },
        sms: { accessKeyId: 'localaccesskey', accessKeySecret: values.smsAccessKeySecret, endpoint: 'dysmsapi.aliyuncs.com' },
        wechat: { appId: 'wxLocalMiniapp0001', appSecret: values.wechatAppSecret, page: 'pages/home/index', state: 'developer' },
      }),
    });
    const notification = JSON.parse(catalog['shop/local/notification']!);

    expect(notification.email.credentialRef).toBe('shop/local/notification/email');
    expect(notification.sms.credentialRef).toBe('shop/local/notification/sms');
    expect(notification.wechat.credentialRef).toBe('shop/local/notification/wechat');
    expect(notification.email).not.toHaveProperty('bearer');
    expect(notification.sms).not.toHaveProperty('accessKeyId');
    expect(notification.wechat).not.toHaveProperty('appSecret');
    expect(catalog['shop/local/notification/email']).toBe(values.emailBearer);
    expect(JSON.parse(catalog['shop/local/notification/sms']!)).toEqual({ accessKeyId: 'localaccesskey', accessKeySecret: values.smsAccessKeySecret });
    expect(catalog['shop/local/notification/wechat']).toBe(values.wechatAppSecret);
  });

  it('leaves an already referenced configuration unchanged', () => {
    const catalog = createNotificationSecrets(values);
    expect(normalizeNotificationSecrets(catalog)).toBe(catalog);
  });

  it('converges a persisted local runtime policy to every extension contract', () => {
    const catalog = createNotificationSecrets(values);
    const notification = JSON.parse(catalog['shop/local/notification']!);
    const drifted = {
      ...catalog,
      'shop/local/notification': JSON.stringify({
        email: { ...notification.email, priority: undefined },
        sms: { ...notification.sms, verificationTemplate: 'SMS_LOCAL_VERIFY', templates: undefined, optOut: undefined },
        wechat: { ...notification.wechat, priority: undefined, templates: undefined },
      }),
    };

    const normalized = normalizeNotificationSecrets(drifted);
    const result = JSON.parse(normalized['shop/local/notification']!);

    expect(result.email.priority).toBe(20);
    expect(result.sms).toMatchObject({
      verificationTemplate: 'SMS_LOCALVERIFY',
      templates: { transactional: {}, marketing: {} },
      optOut: { variable: 'unsubscribe', text: '回复T退订', keywords: ['T', 'TD'] },
    });
    expect(result.wechat).toMatchObject({
      priority: 10,
      templates: { paid: { id: 'localtemplatepaid1', variables: { order: 'character_string1' } } },
    });
  });
});
