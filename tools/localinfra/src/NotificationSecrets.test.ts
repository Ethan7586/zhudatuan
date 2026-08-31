import { describe, expect, it } from 'vitest';
import { createNotificationSecrets, normalizeNotificationSecrets } from './NotificationSecrets';

describe('NotificationSecrets', () => {
  it('stores SMS credentials separately from delivery configuration', () => {
    const catalog = createNotificationSecrets({ emailBearer: 'email-bearer', smsAccessKeySecret: 'sms-secret-value-long', wechatAppSecret: 'wechat-secret' });
    const notification = JSON.parse(catalog['shop/local/notification']!);

    expect(notification.sms).toMatchObject({ credentialRef: 'shop/local/notification/sms', roleName: null });
    expect(notification.sms).not.toHaveProperty('accessKeyId');
    expect(JSON.parse(catalog['shop/local/notification/sms']!)).toEqual({ accessKeyId: 'localaccesskey', accessKeySecret: 'sms-secret-value-long' });
  });

  it('hard-cuts an existing inline SMS credential into a dedicated secret', () => {
    const catalog = normalizeNotificationSecrets({
      'shop/local/notification': JSON.stringify({
        email: {},
        sms: { accessKeyId: 'localaccesskey', accessKeySecret: 'sms-secret-value-long', endpoint: 'dysmsapi.aliyuncs.com' },
        wechat: {},
      }),
    });
    const notification = JSON.parse(catalog['shop/local/notification']!);

    expect(notification.sms).toEqual({ credentialRef: 'shop/local/notification/sms', endpoint: 'dysmsapi.aliyuncs.com', roleName: null });
    expect(JSON.parse(catalog['shop/local/notification/sms']!)).toEqual({ accessKeyId: 'localaccesskey', accessKeySecret: 'sms-secret-value-long' });
  });

  it('leaves an already referenced configuration unchanged', () => {
    const catalog = createNotificationSecrets({ emailBearer: 'email-bearer', smsAccessKeySecret: 'sms-secret-value-long', wechatAppSecret: 'wechat-secret' });
    expect(normalizeNotificationSecrets(catalog)).toBe(catalog);
  });
});
