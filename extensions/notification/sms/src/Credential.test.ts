import { describe, expect, it, vi } from 'vitest';
import type { Transport } from '@shop/sdk';
import { EcsCredentialProvider } from './Credential';

describe('EcsCredentialProvider', () => {
  it('uses IMDSv2 only and caches valid temporary credentials', async () => {
    const send = vi
      .fn<Transport['send']>()
      .mockResolvedValueOnce({ status: 200, headers: {}, body: 'metadata-token' })
      .mockResolvedValueOnce({
        status: 200,
        headers: {},
        body: JSON.stringify({ Code: 'Success', AccessKeyId: 'temporary-key', AccessKeySecret: 'temporary-secret-value', SecurityToken: 'temporary-token', Expiration: new Date(Date.now() + 3_600_000).toISOString() }),
      });
    const provider = new EcsCredentialProvider('CommerceSmsRole', { send });
    const signal = new AbortController().signal;
    const first = await provider.resolve(signal);
    const second = await provider.resolve(signal);
    expect(first).toEqual({ accessKeyId: 'temporary-key', accessKeySecret: 'temporary-secret-value', securityToken: 'temporary-token' });
    expect(second).toBe(first);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0]).toMatchObject({ method: 'PUT', headers: { 'x-aliyun-ecs-metadata-token-ttl-seconds': '21600' } });
    expect(send.mock.calls[1]?.[0]).toMatchObject({ method: 'GET', headers: { 'x-aliyun-ecs-metadata-token': 'metadata-token' } });
  });

  it('rejects malformed metadata responses', async () => {
    const send = vi.fn<Transport['send']>().mockResolvedValueOnce({ status: 200, headers: {}, body: 'metadata-token' }).mockResolvedValueOnce({ status: 200, headers: {}, body: '{"Code":"Forbidden"}' });
    await expect(new EcsCredentialProvider('CommerceSmsRole', { send }).resolve(new AbortController().signal)).rejects.toThrow('ALIYUN_SMS_CREDENTIAL_INVALID');
  });
});
