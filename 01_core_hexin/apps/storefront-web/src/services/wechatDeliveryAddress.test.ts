import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestWechatDeliveryAddress } from './wechatDeliveryAddress';
import { clearWechatAddressDiagnostics, getWechatAddressDiagnostics } from './wechatAddressDiagnostics';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clearWechatAddressDiagnostics();
});

describe('wechat delivery address', () => {
  it('reads a configured WeChat JS-SDK address', async () => {
    const openAddress = vi.fn((options: { success: (result: Record<string, string>) => void }) => options.success({
      userName: '张三',
      telNumber: '13800000000',
      provinceName: '浙江省',
      cityName: '杭州市',
      countryName: '西湖区',
      detailInfo: '文一路 1 号',
    }));
    vi.stubGlobal('window', { wx: { openAddress } });

    await expect(requestWechatDeliveryAddress()).resolves.toEqual({
      name: '张三',
      phone: '13800000000',
      province: '浙江省',
      city: '杭州市',
      district: '西湖区',
      detail: '文一路 1 号',
    });
    expect(openAddress).toHaveBeenCalledOnce();
  });

  it('checks openAddress support before launch and reports the complete state sequence', async () => {
    const states: string[] = [];
    const checkJsApi = vi.fn((options: { success: (result: Record<string, unknown>) => void }) => options.success({
      checkResult: { openAddress: true },
      errMsg: 'checkJsApi:ok',
    }));
    const openAddress = vi.fn((options: { success: (result: Record<string, string>) => void }) => options.success({
      userName: '张三',
      telNumber: '13800000000',
      provinceName: '浙江省',
      cityName: '杭州市',
      countryName: '西湖区',
      detailInfo: '文一路 1 号',
    }));
    vi.stubGlobal('window', { wx: { checkJsApi, openAddress } });

    await requestWechatDeliveryAddress({ onStateChange: (state) => states.push(state) });

    expect(checkJsApi).toHaveBeenCalledBefore(openAddress);
    expect(states).toEqual(['preparing', 'launching', 'returned', 'filled']);
    expect(getWechatAddressDiagnostics().map(({ stage }) => stage)).toEqual([
      'capability-check',
      'callback',
      'launch',
    ]);
  });

  it('does not launch when checkJsApi reports openAddress unavailable', async () => {
    const openAddress = vi.fn();
    const rawResult = { checkResult: { openAddress: false }, errMsg: 'checkJsApi:ok' };
    const checkJsApi = vi.fn((options: { success: (result: typeof rawResult) => void }) => options.success(rawResult));
    vi.stubGlobal('window', { wx: { checkJsApi, openAddress } });

    await expect(requestWechatDeliveryAddress()).rejects.toMatchObject({
      code: 'unavailable',
      rawError: rawResult,
    });
    expect(openAddress).not.toHaveBeenCalled();
    expect(getWechatAddressDiagnostics()).toContainEqual(expect.objectContaining({
      stage: 'capability-check',
      status: 'unavailable',
      rawError: rawResult,
    }));
  });

  it('supports the native WeixinJSBridge address fields', async () => {
    const invoke = vi.fn((operation: string, _parameters: Record<string, never>, callback: (result: Record<string, string>) => void) => callback({
      err_msg: 'edit_address:ok',
      userName: '李四',
      telNumber: '13900000000',
      proviceFirstStageName: '广东省',
      addressCitySecondStageName: '深圳市',
      addressCountiesThirdStageName: '南山区',
      addressDetailInfo: '科技园 2 号',
    }));
    vi.stubGlobal('window', { WeixinJSBridge: { invoke } });

    await expect(requestWechatDeliveryAddress()).resolves.toMatchObject({
      name: '李四',
      district: '南山区',
      detail: '科技园 2 号',
    });
    expect(invoke).toHaveBeenCalledWith('editAddress', {}, expect.any(Function));
  });

  it('reports cancellation without creating an address', async () => {
    const invoke = vi.fn((_operation: string, _parameters: Record<string, never>, callback: (result: Record<string, string>) => void) => callback({
      err_msg: 'edit_address:cancel',
    }));
    vi.stubGlobal('window', { WeixinJSBridge: { invoke } });

    await expect(requestWechatDeliveryAddress()).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('keeps partial fields when the WeChat address is incomplete', async () => {
    const openAddress = vi.fn((options: { success: (result: Record<string, string>) => void }) => options.success({
      userName: '王五',
      telNumber: '13600000000',
      provinceName: '北京市',
      cityName: '北京市',
      detailInfo: '望京街 8 号',
    }));
    vi.stubGlobal('window', { wx: { openAddress } });

    await expect(requestWechatDeliveryAddress()).rejects.toMatchObject({
      code: 'incomplete',
      partialAddress: { name: '王五', phone: '13600000000', province: '北京市', city: '北京市', district: '', detail: '望京街 8 号' },
    });
  });

  it('falls back quietly when neither SDK nor Bridge is available', async () => {
    vi.stubGlobal('window', {});
    await expect(requestWechatDeliveryAddress()).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('reports a Bridge failure without retrying in a loop', async () => {
    const invoke = vi.fn((_operation: string, _parameters: Record<string, never>, callback: (result: Record<string, string>) => void) => callback({
      err_msg: 'edit_address:fail',
    }));
    vi.stubGlobal('window', { WeixinJSBridge: { invoke } });
    await expect(requestWechatDeliveryAddress()).rejects.toMatchObject({ code: 'failed', rawError: 'edit_address:fail' });
    expect(invoke).toHaveBeenCalledOnce();
  });

  it('preserves the original SDK errMsg for diagnosis and restores a failed terminal state', async () => {
    const states: string[] = [];
    const rawResult = { errMsg: 'openAddress:fail permission denied' };
    const openAddress = vi.fn((options: { fail: (result: typeof rawResult) => void }) => options.fail(rawResult));
    vi.stubGlobal('window', { wx: { openAddress } });

    await expect(requestWechatDeliveryAddress({ onStateChange: (state) => states.push(state) })).rejects.toMatchObject({
      code: 'failed',
      rawError: rawResult.errMsg,
    });

    expect(states).toEqual(['preparing', 'launching', 'returned', 'failed']);
    expect(getWechatAddressDiagnostics()).toContainEqual(expect.objectContaining({
      stage: 'callback',
      status: 'failed',
      rawError: rawResult.errMsg,
    }));
  });

  it('times out a missing callback instead of waiting for WeChat forever', async () => {
    vi.useFakeTimers();
    const states: string[] = [];
    vi.stubGlobal('window', { wx: { openAddress: vi.fn() } });
    const request = requestWechatDeliveryAddress({
      callbackTimeoutMs: 20,
      onStateChange: (state) => states.push(state),
    });
    const rejection = expect(request).rejects.toMatchObject({
      code: 'failed',
      rawError: 'WECHAT_ADDRESS_CALLBACK_TIMEOUT',
    });

    await vi.advanceTimersByTimeAsync(20);
    await rejection;

    expect(states).toEqual(['preparing', 'launching', 'failed']);
    expect(getWechatAddressDiagnostics()).toContainEqual(expect.objectContaining({
      stage: 'callback',
      status: 'failed',
      rawError: 'WECHAT_ADDRESS_CALLBACK_TIMEOUT',
    }));
  });
});
