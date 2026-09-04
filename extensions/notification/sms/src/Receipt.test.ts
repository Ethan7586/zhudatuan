import { describe, expect, it } from 'vitest';

import { parseSmsProviderReceipt } from './Receipt';

describe('Aliyun SMS receipts', () => {
  it('maps delivery receipts without exposing the mobile number', () => {
    const receipt = parseSmsProviderReceipt({ phone_number: '13900000000', biz_id: 'sms:one', success: true, report_time: '2026-09-06T10:00:00+08:00' }, ['T']);
    expect(receipt).toMatchObject({ kind: 'delivery', externalId: 'sms:one', state: 'delivered', errorCode: null });
    expect(JSON.stringify(receipt)).not.toContain('13900000000');
  });

  it('turns an allowlisted upstream keyword into an idempotent opt-out event', () => {
    expect(parseSmsProviderReceipt({ phone_number: '13900000000', content: ' t ', send_time: '2026-09-06T10:01:00+08:00' }, ['T'])).toMatchObject({ kind: 'optout', keyword: 'T' });
    expect(() => parseSmsProviderReceipt({ phone_number: '13900000000', content: '你好', send_time: '2026-09-06T10:01:00+08:00' }, ['T'])).toThrow('ALIYUN_SMS_UPSTREAM_UNSUPPORTED');
  });
});
