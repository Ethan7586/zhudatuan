import { record, text } from './canonicalShape';
import { ProductionApiError } from './productionApi.error';

interface WechatJsapiBridge {
  invoke(
    operation: 'getBrandWCPayRequest',
    parameters: Readonly<Record<string, string>>,
    callback: (result: Readonly<Record<string, unknown>>) => void,
  ): void;
}

type WechatWindow = Window & { readonly WeixinJSBridge?: WechatJsapiBridge };

export type WechatJsapiPaymentOutcome = Readonly<{
  status: 'returned' | 'cancelled' | 'failed' | 'unknown';
  errMsg: string;
  code: string;
}>;

export async function requestWechatJsapiPayment(
  value: unknown,
  options: Readonly<{ onInvoked?: () => void | Promise<void> }> = {},
): Promise<WechatJsapiPaymentOutcome> {
  const source = record(value, 'payment.parameters');
  const parameters = Object.freeze({
    appId: text(source.appId, 'payment.parameters.appId'),
    timeStamp: text(source.timeStamp, 'payment.parameters.timeStamp'),
    nonceStr: text(source.nonceStr, 'payment.parameters.nonceStr'),
    package: text(source.package, 'payment.parameters.package'),
    signType: text(source.signType, 'payment.parameters.signType'),
    paySign: text(source.paySign, 'payment.parameters.paySign'),
  });
  let bridge: WechatJsapiBridge;
  try {
    bridge = await wechatBridge();
  } catch (cause) {
    const code = cause instanceof ProductionApiError ? cause.code : 'WECHAT_BRIDGE_UNAVAILABLE';
    return Object.freeze({ status: code === 'WECHAT_CLIENT_REQUIRED' ? 'failed' : 'unknown', errMsg: '', code });
  }
  await options.onInvoked?.();
  return new Promise<WechatJsapiPaymentOutcome>((resolve) => {
    let completed = false;
    const finish = (outcome: WechatJsapiPaymentOutcome) => {
      if (completed) return;
      completed = true;
      window.clearTimeout(timeout);
      resolve(Object.freeze(outcome));
    };
    const timeout = window.setTimeout(() => finish({
      status: 'unknown', errMsg: '', code: 'WECHAT_PAYMENT_CALLBACK_TIMEOUT',
    }), 120_000);
    try {
      bridge.invoke('getBrandWCPayRequest', parameters, (result) => {
        const message = typeof result.err_msg === 'string' ? result.err_msg : '';
        if (message === 'get_brand_wcpay_request:ok') {
          finish({ status: 'returned', errMsg: message, code: 'WECHAT_PAYMENT_RETURNED' });
        } else if (message === 'get_brand_wcpay_request:cancel') {
          finish({ status: 'cancelled', errMsg: message, code: 'PAYMENT_CANCELLED' });
        } else {
          finish({ status: 'failed', errMsg: message, code: 'WECHAT_PAYMENT_FAILED' });
        }
      });
    } catch {
      finish({ status: 'unknown', errMsg: '', code: 'WECHAT_PAYMENT_INVOKE_INTERRUPTED' });
    }
  });
}

export async function wechatBridge(): Promise<WechatJsapiBridge> {
  if (typeof window === 'undefined') throw new ProductionApiError('微信支付只能在微信客户端中完成', 409, 'WECHAT_CLIENT_REQUIRED');
  const target = window as WechatWindow;
  if (target.WeixinJSBridge) return target.WeixinJSBridge;
  return new Promise<WechatJsapiBridge>((resolve, reject) => {
    let completed = false;
    const targetDocument = typeof document === 'undefined' ? null : document;
    const cleanup = () => {
      window.clearTimeout(timeout);
      targetDocument?.removeEventListener('WeixinJSBridgeReady', ready);
      window.removeEventListener('WeixinJSBridgeReady', ready);
    };
    const ready = () => {
      if (completed) return;
      completed = true;
      cleanup();
      const bridge = (window as WechatWindow).WeixinJSBridge;
      if (bridge) resolve(bridge);
      else reject(new ProductionApiError('微信支付组件未就绪，请重新打开页面', 503, 'WECHAT_BRIDGE_UNAVAILABLE'));
    };
    const timeout = window.setTimeout(() => {
      if (completed) return;
      completed = true;
      cleanup();
      reject(new ProductionApiError('微信支付组件连接超时，请重新打开页面', 504, 'WECHAT_BRIDGE_TIMEOUT'));
    }, 10_000);
    targetDocument?.addEventListener('WeixinJSBridgeReady', ready, { once: true });
    window.addEventListener('WeixinJSBridgeReady', ready, { once: true });
  });
}
