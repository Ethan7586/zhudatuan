import { describe, expect, it, vi } from 'vitest';
import type { Transport, TransportRequest } from '@shop/sdk';
import { SmsClient } from './Client';

describe('sms notification client', () => {
  it('propagates the bounded task and signed trace headers without exposing its credential', async () => {
    let sent: TransportRequest | undefined;
    const transport: Transport = { send: vi.fn(async (request) => {
      sent = request;
      return { status: 200, headers: {}, body: '{"Code":"OK","BizId":"sms:one"}' };
    }) };
    const client = new SmsClient(configuration(), { accessKeyId: 'test-access-key', accessKeySecret: 'test-secret-value' }, transport);
    await expect(client.send({ ...request(), requestId: 'dispatch:one', traceId: 'trace:one', deadline: Date.now() + 1_000,
      signal: new AbortController().signal })).resolves.toEqual({ provider: 'aliyun', externalId: 'sms:one' });
    expect(sent?.headers['x-request-id']).toBe('dispatch:one');
    expect(sent?.headers['x-trace-id']).toBe('trace:one');
    expect(sent?.headers.authorization).toContain('x-request-id;x-trace-id');
    expect(JSON.stringify(sent)).not.toContain('test-secret-value');
  });

  it('does not enter transport after the parent task is cancelled', async () => {
    const transport: Transport = { send: vi.fn() };
    const client = new SmsClient(configuration(), { accessKeyId: 'test-access-key', accessKeySecret: 'test-secret-value' }, transport);
    const controller = new AbortController();
    controller.abort(new Error('TASK_CANCELLED'));
    await expect(client.send({ ...request(), signal: controller.signal })).rejects.toThrow();
    expect(transport.send).not.toHaveBeenCalled();
  });
});

function configuration() {
  return {
    signName: '商城', verificationTemplate: 'SMS_1234', endpoint: 'dysmsapi.aliyuncs.com', region: 'cn-hangzhou', credentialRef: null, roleName: 'SmsRole',
    templates: { transactional: { paid: 'SMS_2000' }, marketing: { campaign: 'SMS_3000' } },
    optOut: { variable: 'unsubscribe', text: '回复T退订', keywords: ['T'] },
  } as const;
}

function request() {
  return { recipient: '13900000000', providerTemplate: 'paid', purpose: 'transactional' as const, variables: { order: 'O1' }, subject: null, body: '正文', idempotency: 'dispatch:one' };
}
