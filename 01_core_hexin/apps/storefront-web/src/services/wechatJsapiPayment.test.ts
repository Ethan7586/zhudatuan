import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestWechatJsapiPayment, wechatBridge } from './wechatJsapiPayment';

const PARAMETERS = Object.freeze({
  appId: 'wx-public-mall',
  timeStamp: '1788336000',
  nonceStr: 'nonce-one',
  package: 'prepay_id=one',
  signType: 'RSA',
  paySign: 'signed',
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('WeChat JSAPI payment bridge', () => {
  it('waits for the official document WeixinJSBridgeReady event', async () => {
    const documentTarget = new EventTarget();
    const windowTarget = browserTarget();
    vi.stubGlobal('document', documentTarget);
    vi.stubGlobal('window', windowTarget);

    const bridgePromise = wechatBridge();
    const bridge = { invoke: vi.fn() };
    Object.assign(windowTarget, { WeixinJSBridge: bridge });
    documentTarget.dispatchEvent(new Event('WeixinJSBridgeReady'));

    await expect(bridgePromise).resolves.toBe(bridge);
  });

  it('reports cancellation as a recoverable outcome instead of throwing order failure', async () => {
    const invoke = vi.fn((_operation, _parameters, callback: (result: Record<string, string>) => void) => {
      callback({ err_msg: 'get_brand_wcpay_request:cancel' });
    });
    vi.stubGlobal('window', Object.assign(browserTarget(), { WeixinJSBridge: { invoke } }));

    await expect(requestWechatJsapiPayment(PARAMETERS)).resolves.toEqual({
      status: 'cancelled', errMsg: 'get_brand_wcpay_request:cancel', code: 'PAYMENT_CANCELLED',
    });
  });

  it('enters recovery when WeChat does not return a callback', async () => {
    vi.useFakeTimers();
    const invoke = vi.fn();
    vi.stubGlobal('window', Object.assign(browserTarget(), { WeixinJSBridge: { invoke } }));

    const outcome = requestWechatJsapiPayment(PARAMETERS);
    await vi.advanceTimersByTimeAsync(120_000);

    await expect(outcome).resolves.toEqual({
      status: 'unknown', errMsg: '', code: 'WECHAT_PAYMENT_CALLBACK_TIMEOUT',
    });
    expect(invoke).toHaveBeenCalledOnce();
  });
});

function browserTarget(): EventTarget & Pick<Window, 'setTimeout' | 'clearTimeout'> {
  return Object.assign(new EventTarget(), {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  });
}
