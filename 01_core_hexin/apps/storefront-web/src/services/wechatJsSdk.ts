import { requestH5WechatJsSdkConfiguration, type H5WechatJsSdkConfiguration } from './h5WechatIdentity';

interface WechatJsSdk {
  config(configuration: H5WechatJsSdkConfiguration & { debug: false }): void;
  ready(callback: () => void): void;
  error(callback: (error: unknown) => void): void;
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
  if (configuredSdk && configuredUrl === url) return configuredSdk;
  if (configurationRequest && configuredUrl === url) return configurationRequest;
  configuredUrl = url;
  configurationRequest = (async () => configure(await loadWechatJsSdk(), url))().then((sdk) => {
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
  const configuration = await requestH5WechatJsSdkConfiguration(url);
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('WECHAT_JSSDK_TIMEOUT')), 8_000);
    sdk.ready(() => {
      window.clearTimeout(timer);
      resolve();
    });
    sdk.error((error) => {
      window.clearTimeout(timer);
      reject(error instanceof Error ? error : new Error('WECHAT_JSSDK_CONFIG_FAILED'));
    });
    sdk.config({ ...configuration, debug: false });
  });
  return sdk;
}

function loadWechatJsSdk(): Promise<WechatJsSdk> {
  const existing = typeof window === 'undefined' ? undefined : (window as WechatWindow).wx;
  if (existing?.config) return Promise.resolve(existing);
  sdkRequest ??= loadSdkSource(0);
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
      else reject(new Error('WECHAT_JSSDK_UNAVAILABLE'));
    };
    script.onerror = () => {
      script.remove();
      loadSdkSource(index + 1).then(resolve, reject);
    };
    document.head.appendChild(script);
  });
}
