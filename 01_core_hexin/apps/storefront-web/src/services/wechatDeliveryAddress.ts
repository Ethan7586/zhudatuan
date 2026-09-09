import type { DeliveryAddress } from '../types';
import { beginWechatAddressDiagnostic } from './wechatAddressDiagnostics';
import type { WechatJsSdk } from './wechatJsSdk';

export type ImportedDeliveryAddress = Omit<DeliveryAddress, 'id' | 'isDefault' | 'tag' | 'version'>;

type WechatAddressResult = Readonly<Record<string, unknown>>;

interface WechatAddressSdk extends WechatJsSdk {
  openAddress(options: {
    success: (result: WechatAddressResult) => void;
    cancel: (result?: WechatAddressResult) => void;
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
  readonly wx?: WechatJsSdk;
  readonly WeixinJSBridge?: WechatAddressBridge;
};

export type WechatAddressErrorCode = 'cancelled' | 'unavailable' | 'failed' | 'incomplete';
export type WechatAddressFlowState = 'preparing' | 'launching' | 'returned' | 'filled' | 'cancelled' | 'failed';

export interface WechatAddressRequestOptions {
  readonly onStateChange?: (state: WechatAddressFlowState) => void;
  readonly callbackTimeoutMs?: number;
}

export class WechatAddressRequestError extends Error {
  constructor(
    message: string,
    readonly code: WechatAddressErrorCode,
    readonly partialAddress?: ImportedDeliveryAddress,
    readonly rawError?: unknown,
  ) {
    super(message);
    this.name = 'WechatAddressRequestError';
  }
}

export async function prepareWechatDeliveryAddress(): Promise<void> {
  if (typeof window === 'undefined') return;
  const target = window as WechatAddressWindow;
  const { ensureWechatAddressJsSdk, isWechatBrowser } = await import('./wechatJsSdk');
  if (!isWechatBrowser()) return;
  try {
    await ensureWechatAddressJsSdk();
  } catch (error) {
    if (!target.WeixinJSBridge) {
      throw new WechatAddressRequestError('微信地址暂不可用，请手动填写', 'unavailable', undefined, error);
    }
  }
}

export async function requestWechatDeliveryAddress(
  options: WechatAddressRequestOptions = {},
): Promise<ImportedDeliveryAddress> {
  const transition = options.onStateChange ?? (() => undefined);
  transition('preparing');
  if (typeof window === 'undefined') {
    transition('failed');
    throw new WechatAddressRequestError('当前环境无法读取微信地址，请手动填写', 'unavailable');
  }

  const target = window as WechatAddressWindow;
  let sdkModule: typeof import('./wechatJsSdk');
  try {
    sdkModule = await import('./wechatJsSdk');
  } catch (error) {
    transition('failed');
    throw new WechatAddressRequestError('微信地址暂不可用，请手动填写', 'unavailable', undefined, error);
  }
  const { ensureWechatAddressJsSdk, isWechatBrowser } = sdkModule;
  let sdk = target.wx;
  if (isWechatBrowser()) {
    try {
      sdk = await ensureWechatAddressJsSdk();
    } catch (error) {
      if (!target.WeixinJSBridge) {
        transition('failed');
        throw new WechatAddressRequestError('微信地址暂不可用，请手动填写', 'unavailable', undefined, error);
      }
      sdk = undefined;
    }
  }

  try {
    const configuredTarget = window as WechatAddressWindow;
    const candidateSdk = sdk ?? configuredTarget.wx;
    if (isWechatAddressSdk(candidateSdk)) {
      const capability = await checkWechatAddressCapability(candidateSdk);
      if (capability.available) {
        transition('launching');
        const address = await requestFromSdk(
          candidateSdk,
          () => transition('returned'),
          options.callbackTimeoutMs,
        );
        transition('filled');
        return address;
      }
      if (!configuredTarget.WeixinJSBridge) {
        throw new WechatAddressRequestError(
          '当前微信版本暂不能读取地址，请手动填写',
          'unavailable',
          undefined,
          capability.rawError,
        );
      }
    }
    if (configuredTarget.WeixinJSBridge) {
      recordBridgeCapability();
      transition('launching');
      const address = await requestFromBridge(
        configuredTarget.WeixinJSBridge,
        () => transition('returned'),
        options.callbackTimeoutMs,
      );
      transition('filled');
      return address;
    }
    const finishCapability = beginWechatAddressDiagnostic('capability-check');
    finishCapability('unavailable', 'openAddress and WeixinJSBridge are unavailable');
    throw new WechatAddressRequestError('当前微信环境暂不能读取地址，请手动填写', 'unavailable');
  } catch (error) {
    const normalized = normalizeWechatAddressError(error);
    transition(normalized.code === 'cancelled' ? 'cancelled' : normalized.code === 'incomplete' ? 'filled' : 'failed');
    throw normalized;
  }
}

function requestFromSdk(
  sdk: WechatAddressSdk,
  onReturn: () => void,
  callbackTimeoutMs = 180_000,
): Promise<ImportedDeliveryAddress> {
  return new Promise((resolve, reject) => {
    const finishLaunch = beginWechatAddressDiagnostic('launch');
    const finishCallback = beginWechatAddressDiagnostic('callback');
    let settled = false;
    const timer = globalThis.setTimeout(() => {
      if (settled) return;
      settled = true;
      const rawError = 'WECHAT_ADDRESS_CALLBACK_TIMEOUT';
      finishCallback('failed', rawError);
      reject(new WechatAddressRequestError('微信地址响应超时，请重试或手动填写', 'failed', undefined, rawError));
    }, callbackTimeoutMs);
    const returnOnce = (status: 'succeeded' | 'cancelled' | 'failed', result: WechatAddressResult | undefined, complete: () => void) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      onReturn();
      finishCallback(status, status === 'succeeded' ? undefined : rawWechatError(result));
      complete();
    };
    try {
      sdk.openAddress({
        success: (result) => returnOnce('succeeded', result, () => completeAddressRequest(result, resolve, reject)),
        cancel: (result) => returnOnce('cancelled', result, () => reject(new WechatAddressRequestError(
          '已取消获取微信地址', 'cancelled', undefined, rawWechatError(result) ?? 'openAddress:cancel',
        ))),
        fail: (result) => returnOnce('failed', result, () => reject(new WechatAddressRequestError(
          '微信地址获取失败，请手动填写', 'failed', undefined, rawWechatError(result),
        ))),
      });
      finishLaunch('succeeded');
    } catch (error) {
      globalThis.clearTimeout(timer);
      settled = true;
      finishLaunch('failed', error);
      finishCallback('failed', error);
      reject(new WechatAddressRequestError('微信地址获取失败，请手动填写', 'failed', undefined, error));
    }
  });
}

function requestFromBridge(
  bridge: WechatAddressBridge,
  onReturn: () => void,
  callbackTimeoutMs = 180_000,
): Promise<ImportedDeliveryAddress> {
  return new Promise((resolve, reject) => {
    const finishLaunch = beginWechatAddressDiagnostic('launch');
    const finishCallback = beginWechatAddressDiagnostic('callback');
    let settled = false;
    const timer = globalThis.setTimeout(() => {
      if (settled) return;
      settled = true;
      const rawError = 'WECHAT_ADDRESS_CALLBACK_TIMEOUT';
      finishCallback('failed', rawError);
      reject(new WechatAddressRequestError('微信地址响应超时，请重试或手动填写', 'failed', undefined, rawError));
    }, callbackTimeoutMs);
    try {
      bridge.invoke('editAddress', {}, (result) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        onReturn();
        const message = value(result, 'err_msg', 'errMsg');
        if (message.includes('cancel')) {
          finishCallback('cancelled', message);
          reject(new WechatAddressRequestError('已取消获取微信地址', 'cancelled', undefined, message));
          return;
        }
        if (message && !message.endsWith(':ok')) {
          finishCallback('failed', message);
          reject(new WechatAddressRequestError('微信地址获取失败，请手动填写', 'failed', undefined, message));
          return;
        }
        finishCallback('succeeded');
        completeAddressRequest(result, resolve, reject);
      });
      finishLaunch('succeeded');
    } catch (error) {
      globalThis.clearTimeout(timer);
      settled = true;
      finishLaunch('failed', error);
      finishCallback('failed', error);
      reject(new WechatAddressRequestError('微信地址获取失败，请手动填写', 'failed', undefined, error));
    }
  });
}

async function checkWechatAddressCapability(sdk: WechatAddressSdk): Promise<Readonly<{ available: boolean; rawError?: unknown }>> {
  const finishCapability = beginWechatAddressDiagnostic('capability-check');
  const checkJsApi = sdk.checkJsApi;
  if (!checkJsApi) {
    finishCapability('succeeded');
    return Object.freeze({ available: true });
  }
  return new Promise((resolve) => {
    let settled = false;
    const timer = globalThis.setTimeout(() => {
      if (settled) return;
      settled = true;
      const rawError = 'WECHAT_CHECK_JSAPI_TIMEOUT';
      finishCapability('failed', rawError);
      resolve(Object.freeze({ available: false, rawError }));
    }, 1_200);
    const complete = (available: boolean, result: WechatAddressResult, status: 'succeeded' | 'failed' | 'unavailable') => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      const rawError = available ? undefined : status === 'unavailable' ? result : rawWechatError(result) ?? result;
      finishCapability(status, rawError);
      resolve(Object.freeze({ available, ...(rawError === undefined ? {} : { rawError }) }));
    };
    try {
      checkJsApi({
        jsApiList: ['openAddress'],
        success: (result) => {
          const available = readOpenAddressCapability(result);
          complete(available, result, available ? 'succeeded' : 'unavailable');
        },
        fail: (result) => complete(false, result, 'failed'),
      });
    } catch (error) {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      finishCapability('failed', error);
      resolve(Object.freeze({ available: false, rawError: error }));
    }
  });
}

function readOpenAddressCapability(result: WechatAddressResult): boolean {
  const checkResult = result.checkResult;
  if (typeof checkResult === 'string') {
    try {
      return readOpenAddressCapability({ checkResult: JSON.parse(checkResult) });
    } catch {
      return false;
    }
  }
  return Boolean(checkResult && typeof checkResult === 'object'
    && (checkResult as Readonly<Record<string, unknown>>).openAddress === true);
}

function recordBridgeCapability(): void {
  const finishCapability = beginWechatAddressDiagnostic('capability-check');
  finishCapability('succeeded');
}

function isWechatAddressSdk(sdk: WechatJsSdk | undefined): sdk is WechatAddressSdk {
  return typeof sdk?.openAddress === 'function';
}

function normalizeWechatAddressError(error: unknown): WechatAddressRequestError {
  return error instanceof WechatAddressRequestError
    ? error
    : new WechatAddressRequestError('微信地址获取失败，请手动填写', 'failed', undefined, error);
}

function rawWechatError(result: WechatAddressResult | undefined): unknown {
  if (!result) return undefined;
  return value(result, 'errMsg', 'err_msg') || result;
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
