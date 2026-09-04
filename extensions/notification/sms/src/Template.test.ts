import { describe, expect, it } from 'vitest';

import { SmsTemplateCatalog } from './Template';

const catalog = new SmsTemplateCatalog({
  verificationTemplate: 'SMS_1000',
  templates: { transactional: { paid: 'SMS_2000' }, marketing: { campaign: 'SMS_3000' } },
  optOut: { variable: 'unsubscribe', text: '回复T退订', keywords: ['T'] },
});

describe('SMS template isolation', () => {
  it('resolves verification only through the dedicated template', () => {
    expect(catalog.resolve(request('verification', null, { code: '123456' }))).toEqual({ code: 'SMS_1000', variables: { code: '123456' } });
    expect(() => catalog.resolve(request('verification', 'paid', { code: '123456' }))).toThrow('SMS_VERIFICATION_TEMPLATE_ISOLATION_REQUIRED');
  });

  it('maps transactional and marketing aliases without crossing purposes', () => {
    expect(catalog.resolve(request('transactional', 'paid', { order: 'O1' })).code).toBe('SMS_2000');
    expect(catalog.resolve(request('marketing', 'campaign', { activity: 'A1' }))).toEqual({ code: 'SMS_3000', variables: { activity: 'A1', unsubscribe: '回复T退订' } });
    expect(() => catalog.resolve(request('marketing', 'paid', {}))).toThrow('SMS_TEMPLATE_PURPOSE_MISMATCH');
  });
});

function request(purpose: 'verification' | 'transactional' | 'marketing', providerTemplate: string | null, variables: Readonly<Record<string, string>>) {
  return { recipient: '13900000000', providerTemplate, purpose, variables, subject: null, body: '正文', idempotency: 'dispatch:one' } as const;
}
