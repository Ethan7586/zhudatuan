import { describe, expect, it } from 'vitest';
import { parseSmsConfiguration } from './Config';

describe('SmsConfiguration', () => {
  it('keeps credentials behind a SecretRef', () => {
    expect(parseSmsConfiguration({ ...configuration(), credentialRef: 'notification/sms/credential', roleName: null }).credentialRef).toBe(
      'notification/sms/credential'
    );
  });

  it('uses the runtime role instead of a long-lived key in managed environments', () => {
    expect(parseSmsConfiguration({ ...configuration(), credentialRef: null, roleName: 'CommerceSmsRole' })).toMatchObject({
      credentialRef: null,
      roleName: 'CommerceSmsRole',
    });
  });

  it('requires exactly one environment-owned credential source', () => {
    const base = configuration();
    expect(() => parseSmsConfiguration(base)).toThrow('SMS_CREDENTIAL_SOURCE_INVALID');
    expect(() => parseSmsConfiguration({ ...base, credentialRef: 'notification/sms/credential', roleName: 'CommerceSmsRole' })).toThrow('SMS_CREDENTIAL_SOURCE_INVALID');
  });

  it('rejects inline credential material', () => {
    expect(() =>
      parseSmsConfiguration({ ...configuration(), credentialRef: 'notification/sms/credential', roleName: null, accessKeySecret: 'leak' })
    ).toThrow('SMS_CONFIGURATION_INVALID');
  });

  it('rejects a provider template shared by verification and marketing', () => {
    expect(() => parseSmsConfiguration({ ...configuration(), credentialRef: null, roleName: 'CommerceSmsRole', templates: { transactional: {}, marketing: { campaign: 'SMS_1234' } } }))
      .toThrow('SMS_TEMPLATE_PURPOSE_OVERLAP');
  });
});

function configuration() {
  return {
    signName: '商城', verificationTemplate: 'SMS_1234', endpoint: 'dysmsapi.aliyuncs.com', region: 'cn-hangzhou',
    templates: { transactional: { paid: 'SMS_2000' }, marketing: { campaign: 'SMS_3000' } },
    optOut: { variable: 'unsubscribe', text: '回复T退订', keywords: ['T', 'TD'] },
  };
}
