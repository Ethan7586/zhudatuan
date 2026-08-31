import { describe, expect, it } from 'vitest';
import { parseSmsConfiguration } from './Config';

describe('SmsConfiguration', () => {
  it('keeps credentials behind a SecretRef', () => {
    expect(parseSmsConfiguration({ signName: '商城', verificationTemplate: 'SMS_1234', endpoint: 'dysmsapi.aliyuncs.com', region: 'cn-hangzhou', credentialRef: 'notification/sms/credential', roleName: null }).credentialRef).toBe(
      'notification/sms/credential'
    );
  });

  it('rejects inline credential material', () => {
    expect(() =>
      parseSmsConfiguration({ signName: '商城', verificationTemplate: 'SMS_1234', endpoint: 'dysmsapi.aliyuncs.com', region: 'cn-hangzhou', credentialRef: 'notification/sms/credential', roleName: null, accessKeySecret: 'leak' })
    ).toThrow('SMS_CONFIGURATION_INVALID');
  });
});
