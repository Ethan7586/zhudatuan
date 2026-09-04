import { describe, expect, it, vi } from 'vitest';
import { WechatTransport, type WechatRequest } from './WechatTransport';

describe('WechatTransport', () => {
  it('aborts the native request task when its RequestContext signal changes', async () => {
    const abort = vi.fn();
    let nativeRequest: WechatRequest | undefined;
    const transport = new WechatTransport((request) => {
      nativeRequest = request;
      return { abort };
    });
    const controller = new AbortController();

    const pending = transport.send({
      url: 'https://shop.example/api/v1/catalog/listings',
      method: 'GET',
      headers: {},
      signal: controller.signal,
    });
    controller.abort(new Error('scope changed'));

    await expect(pending).rejects.toThrow('scope changed');
    expect(nativeRequest).toBeDefined();
    expect(abort).toHaveBeenCalledOnce();
  });
});
