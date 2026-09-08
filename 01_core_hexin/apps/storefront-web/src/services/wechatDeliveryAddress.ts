import type { DeliveryAddress } from '../types';

export type ImportedDeliveryAddress = Omit<DeliveryAddress, 'id' | 'isDefault' | 'tag' | 'version'>;

type WechatAddressResult = Readonly<Record<string, unknown>>;

interface WechatAddressSdk {
  openAddress(options: {
    success: (result: WechatAddressResult) => void;
    cancel: () => void;
    fail: (result: WechatAddressResult) => void;
  }): void;
}

interface WechatAddressBridge {
  invoke(
    operation: 'editAddress',
    parameters: Readonly<Record<string, never>>,
    callback: (result: WechatAddressResult) => void,
  ): void;
}

type WechatAddressWindow = Window & {
  readonly wx?: WechatAddressSdk;
  readonly WeixinJSBridge?: WechatAddressBridge;
};

export type WechatAddressErrorCode = 'cancelled' | 'unavailable' | 'failed' | 'incomplete';

export class WechatAddressRequestError extends Error {
  constructor(message: string, readonly code: WechatAddressErrorCode, readonly partialAddress?: ImportedDeliveryAddress) {
    super(message);
    this.name = 'WechatAddressRequestError';
  }
}

export async function requestWechatDeliveryAddress(): Promise<ImportedDeliveryAddress> {
  if (typeof window === 'undefined') {
    throw new WechatAddressRequestError('当前环境无法读取微信地址，请手动填写', 'unavailable');
  }

  const target = window as WechatAddressWindow;
  const { ensureWechatAddressJsSdk, isWechatBrowser } = await import('./wechatJsSdk');
  if (isWechatBrowser()) {
    try {
      await ensureWechatAddressJsSdk();
    } catch {
      if (!target.WeixinJSBridge) {
        throw new WechatAddressRequestError('微信地址暂不可用，请手动填写', 'unavailable');
      }
    }
  }
  const configuredTarget = window as WechatAddressWindow;
  if (configuredTarget.wx?.openAddress) return requestFromSdk(configuredTarget.wx);
  if (configuredTarget.WeixinJSBridge) return requestFromBridge(configuredTarget.WeixinJSBridge);
  throw new WechatAddressRequestError('当前微信环境暂不能读取地址，请手动填写', 'unavailable');
}

function requestFromSdk(sdk: WechatAddressSdk): Promise<ImportedDeliveryAddress> {
  return new Promise((resolve, reject) => sdk.openAddress({
    success: (result) => completeAddressRequest(result, resolve, reject),
    cancel: () => reject(new WechatAddressRequestError('已取消获取微信地址', 'cancelled')),
    fail: () => reject(new WechatAddressRequestError('微信地址获取失败，请手动填写', 'failed')),
  }));
}

function requestFromBridge(bridge: WechatAddressBridge): Promise<ImportedDeliveryAddress> {
  return new Promise((resolve, reject) => bridge.invoke('editAddress', {}, (result) => {
    const message = value(result, 'err_msg', 'errMsg');
    if (message.includes('cancel')) {
      reject(new WechatAddressRequestError('已取消获取微信地址', 'cancelled'));
      return;
    }
    if (message && !message.endsWith(':ok')) {
      reject(new WechatAddressRequestError('微信地址获取失败，请手动填写', 'failed'));
      return;
    }
    completeAddressRequest(result, resolve, reject);
  }));
}

function completeAddressRequest(
  result: WechatAddressResult,
  resolve: (address: ImportedDeliveryAddress) => void,
  reject: (error: WechatAddressRequestError) => void,
) {
  const address = {
    name: value(result, 'userName'),
    phone: value(result, 'telNumber'),
    province: value(result, 'provinceName', 'proviceFirstStageName'),
    city: value(result, 'cityName', 'addressCitySecondStageName'),
    district: value(result, 'countryName', 'addressCountiesThirdStageName'),
    detail: value(result, 'detailInfo', 'addressDetailInfo'),
  };
  if (Object.values(address).some((item) => item.length === 0)) {
    reject(new WechatAddressRequestError('微信地址信息不完整，请手动补充', 'incomplete', address));
    return;
  }
  resolve(address);
}

function value(source: WechatAddressResult, ...keys: string[]): string {
  for (const key of keys) {
    const candidate = source[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
}
