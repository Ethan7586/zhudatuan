import { describe, expect, it } from 'vitest';
import { parseSmsConfiguration } from './Config';

describe('SmsConfiguration', () => {
  it('keeps credentials behind a SecretRef', () => {
    expect(parseSmsConfiguration({ signName: '商城', verificationTemplate: 'SMS_1234', endpoint: 'dysmsapi.aliyuncs.com', region: 'cn-hangzhou', credentialRef: 'notification/sms/credential', roleName: null }).credentialRef).toBe(
      'notification/sms/credential'
    );
  });

  it('uses the runtime role instead of a long-lived key in managed environments', () => {
    expect(parseSmsConfiguration({ signName: '商城', verificationTemplate: 'SMS_1234', endpoint: 'dysmsapi.aliyuncs.com', region: 'cn-hangzhou', credentialRef: null, roleName: 'CommerceSmsRole' })).toMatchObject({
      credentialRef: null,
      roleName: 'CommerceSmsRole',
    });
  });

  it('requires exactly one environment-owned credential source', () => {
    const base = { signName: '商城', verificationTemplate: 'SMS_1234', endpoint: 'dysmsapi.aliyuncs.com', region: 'cn-hangzhou' };
    expect(() => parseSmsConfiguration(base)).toThrow('SMS_CREDENTIAL_SOURCE_INVALID');
    expect(() => parseSmsConfiguration({ ...base, credentialRef: 'notification/sms/credential', roleName: 'CommerceSmsRole' })).toThrow('SMS_CREDENTIAL_SOURCE_INVALID');
  });

  it('rejects inline credential material', () => {
    expect(() =>
      parseSmsConfiguration({ signName: '商城', verificationTemplate: 'SMS_1234', endpoint: 'dysmsapi.aliyuncs.com', region: 'cn-hangzhou', credentialRef: 'notification/sms/credential', roleName: null, accessKeySecret: 'leak' })
    ).toThrow('SMS_CONFIGURATION_INVALID');
  });
});
