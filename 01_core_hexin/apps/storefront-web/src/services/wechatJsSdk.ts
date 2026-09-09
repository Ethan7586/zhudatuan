import { requestH5WechatJsSdkConfiguration, type H5WechatJsSdkConfiguration } from './h5WechatIdentity';
import { beginWechatAddressDiagnostic, recordCachedWechatAddressDiagnostic } from './wechatAddressDiagnostics';

export interface WechatJsSdk {
  config(configuration: H5WechatJsSdkConfiguration & { debug: false }): void;
  ready(callback: () => void): void;
  error(callback: (error: unknown) => void): void;
  checkJsApi?(options: {
    jsApiList: readonly ['openAddress'];
    success: (result: Readonly<Record<string, unknown>>) => void;
    fail: (result: Readonly<Record<string, unknown>>) => void;
  }): void;
  openAddress?: unknown;
}

type WechatWindow = Window & { wx?: WechatJsSdk };

const SDK_SOURCES = [
  'https://res.wx.qq.com/open/js/jweixin-1.6.0.js',
  'https://res2.wx.qq.com/open/js/jweixin-1.6.0.js',
] as const;

let configuredUrl = '';
let configuredSdk: WechatJsSdk | undefined;
let configurationRequest: Promise<WechatJsSdk> | undefined;
let sdkRequest: Promise<WechatJsSdk> | undefined;

export function isWechatBrowser(userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /MicroMessenger/i.test(userAgent);
}

export async function ensureWechatAddressJsSdk(): Promise<WechatJsSdk> {
  if (typeof window === 'undefined' || !isWechatBrowser()) throw new Error('WECHAT_JSSDK_UNAVAILABLE');
  const url = window.location.href.split('#')[0] ?? window.location.href;
  if (configuredSdk && configuredUrl === url) {
    recordCachedWechatAddressDiagnostic('sdk-load');
    recordCachedWechatAddressDiagnostic('signature');
    recordCachedWechatAddressDiagnostic('configuration');
    return configuredSdk;
  }
  if (configurationRequest && configuredUrl === url) return configurationRequest;
  configuredUrl = url;
  configurationRequest = (async () => {
    const finishSdkLoad = beginWechatAddressDiagnostic('sdk-load');
    try {
      const sdk = await loadWechatJsSdk();
      finishSdkLoad('succeeded');
      return configure(sdk, url);
    } catch (error) {
      finishSdkLoad('failed', error);
      throw error;
    }
  })().then((sdk) => {
    configuredSdk = sdk;
    configurationRequest = undefined;
    return sdk;
  }).catch((error) => {
    configuredUrl = '';
    configuredSdk = undefined;
    configurationRequest = undefined;
    throw error;
  });
  return configurationRequest;
}

async function configure(sdk: WechatJsSdk, url: string): Promise<WechatJsSdk> {
  const finishSignature = beginWechatAddressDiagnostic('signature');
  let configuration: H5WechatJsSdkConfiguration;
  try {
    configuration = await requestH5WechatJsSdkConfiguration(url);
    finishSignature('succeeded');
  } catch (error) {
    finishSignature('failed', error);
    throw error;
  }

  const finishConfiguration = beginWechatAddressDiagnostic('configuration');
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('WECHAT_JSSDK_TIMEOUT')), 8_000);
      sdk.ready(() => {
        window.clearTimeout(timer);
        resolve();
      });
      sdk.error((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
      sdk.config({ ...configuration, debug: false });
    });
    finishConfiguration('succeeded');
  } catch (error) {
    finishConfiguration('failed', error);
    throw error;
  }
  return sdk;
}

function loadWechatJsSdk(): Promise<WechatJsSdk> {
  const existing = typeof window === 'undefined' ? undefined : (window as WechatWindow).wx;
  if (existing?.config) return Promise.resolve(existing);
  sdkRequest ??= loadSdkSource(0).catch((error) => {
    sdkRequest = undefined;
    throw error;
  });
  return sdkRequest;
}

function loadSdkSource(index: number): Promise<WechatJsSdk> {
  const source = SDK_SOURCES[index];
  if (!source || typeof document === 'undefined') return Promise.reject(new Error('WECHAT_JSSDK_UNAVAILABLE'));
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source;
    script.async = true;
    script.onload = () => {
      const sdk = (window as WechatWindow).wx;
      if (sdk?.config) resolve(sdk);
      else {
        script.remove();
        loadSdkSource(index + 1).then(resolve, reject);
      }
    };
    script.onerror = () => {
      script.remove();
      loadSdkSource(index + 1).then(resolve, reject);
    };
    document.head.appendChild(script);
  });
}
