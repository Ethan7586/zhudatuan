import { describe, expect, it, vi } from 'vitest';
import { sendVerificationSms, smsProviderAvailable } from './smsProvider';
import type { WorkerEnv } from './types';

const input = {
  mobile: '13800138000',
  code: '482913',
  challengeId: '11111111-1111-4111-8111-111111111111',
  purpose: 'registration' as const,
};

describe('SMS provider', () => {
  it('keeps debug codes inside development and test environments', async () => {
    const clientFactory = vi.fn();
    await expect(sendVerificationSms({ APP_ENV: 'test', SMS_PROVIDER: 'debug' }, input, clientFactory)).resolves.toEqual({
      provider: 'debug',
      debugCode: input.code,
    });
    expect(clientFactory).not.toHaveBeenCalled();
    expect(smsProviderAvailable({ APP_ENV: 'production', SMS_PROVIDER: 'debug' })).toBe(false);
  });

  it('sends the approved Aliyun template once with no automatic retry', async () => {
    const sendSmsWithOptions = vi.fn(async (_request: unknown, _runtime: unknown) => ({ body: { code: 'OK', bizId: 'biz-1', requestId: 'request-1' } }));
    const env: WorkerEnv = {
      APP_ENV: 'production',
      SMS_PROVIDER: 'aliyun',
      ALIYUN_SMS_SIGN_NAME: '智慧翼',
      ALIYUN_SMS_TEMPLATE_CODE_VERIFICATION: 'SMS_123456789',
    };

    await expect(sendVerificationSms(env, input, () => ({ sendSmsWithOptions }) as never)).resolves.toEqual({
      provider: 'aliyun',
      providerMessageId: 'biz-1',
      providerRequestId: 'request-1',
    });
    expect(sendSmsWithOptions).toHaveBeenCalledTimes(1);
    const [request, runtime] = sendSmsWithOptions.mock.calls[0];
    expect(request).toMatchObject({
      phoneNumbers: input.mobile,
      signName: '智慧翼',
      templateCode: 'SMS_123456789',
      templateParam: JSON.stringify({ code: input.code }),
      outId: input.challengeId,
    });
    expect(runtime).toMatchObject({ autoretry: false, maxAttempts: 1, connectTimeout: 3000, readTimeout: 3000 });
  });

  it('maps provider rejections to a stable error without leaking raw detail', async () => {
    const sendSmsWithOptions = vi.fn(async (_request: unknown, _runtime: unknown) => ({ body: { code: 'isv.BUSINESS_LIMIT_CONTROL<script>', message: 'provider raw detail' } }));
    const promise = sendVerificationSms(
      {
        APP_ENV: 'production',
        SMS_PROVIDER: 'aliyun',
        ALIYUN_SMS_SIGN_NAME: '智慧翼',
        ALIYUN_SMS_TEMPLATE_CODE_VERIFICATION: 'SMS_123456789',
      },
      input,
      () => ({ sendSmsWithOptions }) as never
    );

    await expect(promise).rejects.toMatchObject({
      code: 'ALIYUN_SMS_isv.BUSINESS_LIMIT_CONTROLscript',
      message: '验证码发送失败，请稍后重试',
    });
  });
});
