import { describe, expect, it } from 'vitest';
import { parseIdentityNotificationConfiguration } from './IdentityNotificationConfiguration';

const roleConfiguration = JSON.stringify({ sms: {
  signName: '主打團',
  verificationTemplate: 'SMS_12345678',
  endpoint: 'dysmsapi.aliyuncs.com',
  region: 'cn-hangzhou',
  roleName: 'zhudatuan-identity-notification',
} });

describe('identity notification configuration', () => {
  it('accepts only an explicit Aliyun SMS role configuration', () => {
    expect(parseIdentityNotificationConfiguration(roleConfiguration)).toEqual({ sms: {
      signName: '主打團', verificationTemplate: 'SMS_12345678', endpoint: 'dysmsapi.aliyuncs.com',
      region: 'cn-hangzhou', roleName: 'zhudatuan-identity-notification',
    } });
  });

  it('rejects full notification configuration, unknown providers, and ambiguous credentials', () => {
    expect(() => parseIdentityNotificationConfiguration(JSON.stringify({
      ...JSON.parse(roleConfiguration), email: {}, wechat: {},
    }))).toThrow('IDENTITY_NOTIFICATION_CONFIGURATION_INVALID');
    expect(() => parseIdentityNotificationConfiguration(JSON.stringify({ sms: {
      ...JSON.parse(roleConfiguration).sms, payoutToken: 'forbidden',
    } }))).toThrow('IDENTITY_NOTIFICATION_CONFIGURATION_INVALID');
    expect(() => parseIdentityNotificationConfiguration(JSON.stringify({ sms: {
      ...JSON.parse(roleConfiguration).sms, accessKeyId: 'key', accessKeySecret: 'secret',
    } }))).toThrow('IDENTITY_NOTIFICATION_CONFIGURATION_INVALID');
  });
});
