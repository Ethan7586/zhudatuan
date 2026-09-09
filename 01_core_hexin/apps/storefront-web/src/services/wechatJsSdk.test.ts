import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requestConfiguration = vi.hoisted(() => vi.fn());

vi.mock('./h5WechatIdentity', () => ({
  requestH5WechatJsSdkConfiguration: requestConfiguration,
}));

beforeEach(() => {
  vi.resetModules();
  requestConfiguration.mockReset().mockResolvedValue({
    appId: 'wx4df4137881a1d2bd',
    timestamp: 1_788_800_000,
    nonceStr: 'nonce-one',
    signature: 'a'.repeat(40),
    jsApiList: ['openAddress'],
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('WeChat JS-SDK address bootstrap', () => {
  it('signs the actual URL without its hash and configures openAddress only once', async () => {
    let ready: (() => void) | undefined;
    const sdk = {
      openAddress: vi.fn(),
      ready: vi.fn((callback: () => void) => { ready = callback; }),
      error: vi.fn(),
      config: vi.fn(() => ready?.()),
    };
    vi.stubGlobal('navigator', { userAgent: 'MicroMessenger/8.0.50' });
    vi.stubGlobal('window', {
      location: { href: 'https://hbbtzn.com/?source=wechat#/address' },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      wx: sdk,
    });
    const { ensureWechatAddressJsSdk } = await import('./wechatJsSdk');
    const { getWechatAddressDiagnostics } = await import('./wechatAddressDiagnostics');

    await ensureWechatAddressJsSdk();
    await ensureWechatAddressJsSdk();

    expect(requestConfiguration).toHaveBeenCalledOnce();
    expect(requestConfiguration).toHaveBeenCalledWith('https://hbbtzn.com/?source=wechat');
    expect(sdk.config).toHaveBeenCalledWith(expect.objectContaining({ debug: false, jsApiList: ['openAddress'] }));
    expect(getWechatAddressDiagnostics().map(({ stage, status }) => `${stage}:${status}`)).toEqual([
      'sdk-load:succeeded',
      'signature:succeeded',
      'configuration:succeeded',
      'sdk-load:cached',
      'signature:cached',
      'configuration:cached',
    ]);
  });

  it('keeps the original wx.config error in the configuration diagnostic', async () => {
    let sdkError: ((error: unknown) => void) | undefined;
    const rawError = { errMsg: 'config:invalid signature' };
    const sdk = {
      openAddress: vi.fn(),
      ready: vi.fn(),
      error: vi.fn((callback: (error: unknown) => void) => { sdkError = callback; }),
      config: vi.fn(() => sdkError?.(rawError)),
    };
    vi.stubGlobal('navigator', { userAgent: 'MicroMessenger/8.0.50' });
    vi.stubGlobal('window', {
      location: { href: 'https://hbbtzn.com/address' },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      wx: sdk,
    });
    const { ensureWechatAddressJsSdk } = await import('./wechatJsSdk');
    const { getWechatAddressDiagnostics } = await import('./wechatAddressDiagnostics');

    await expect(ensureWechatAddressJsSdk()).rejects.toBe(rawError);
    expect(getWechatAddressDiagnostics()).toContainEqual(expect.objectContaining({
      stage: 'configuration',
      status: 'failed',
      rawError,
    }));
  });
});
