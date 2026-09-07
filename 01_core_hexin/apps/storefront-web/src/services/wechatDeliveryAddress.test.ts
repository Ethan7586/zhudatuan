import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestWechatDeliveryAddress } from './wechatDeliveryAddress';

afterEach(() => vi.unstubAllGlobals());

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
});
