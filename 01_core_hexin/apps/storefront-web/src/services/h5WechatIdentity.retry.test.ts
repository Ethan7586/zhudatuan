import { describe, expect, it, vi } from 'vitest';
import { ProductionApiError } from './productionApi.error';
import { retryH5WechatNetworkRequest } from './h5WechatIdentity';

describe('H5 WeChat network recovery', () => {
  it('waits and retries transient mobile network failures', async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(new ProductionApiError('network', 0, 'NETWORK_OR_CLIENT_ERROR'))
      .mockRejectedValueOnce(new ProductionApiError('network', 0, 'NETWORK_OR_CLIENT_ERROR'))
      .mockResolvedValue('authorized');
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(retryH5WechatNetworkRequest(request, wait)).resolves.toBe('authorized');
    expect(request).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[600], [1_400]]);
  });

  it('does not retry an application response error', async () => {
    const error = new ProductionApiError('bad request', 400, 'VALIDATION_FAILED');
    const request = vi.fn().mockRejectedValue(error);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(retryH5WechatNetworkRequest(request, wait)).rejects.toBe(error);
    expect(request).toHaveBeenCalledOnce();
    expect(wait).not.toHaveBeenCalled();
  });
});
