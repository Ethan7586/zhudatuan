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

export async function requestWechatJsapiPayment(value: unknown): Promise<void> {
  const source = record(value, 'payment.parameters');
  const parameters = Object.freeze({
    appId: text(source.appId, 'payment.parameters.appId'),
    timeStamp: text(source.timeStamp, 'payment.parameters.timeStamp'),
    nonceStr: text(source.nonceStr, 'payment.parameters.nonceStr'),
    package: text(source.package, 'payment.parameters.package'),
    signType: text(source.signType, 'payment.parameters.signType'),
    paySign: text(source.paySign, 'payment.parameters.paySign'),
  });
  const bridge = await wechatBridge();
  await new Promise<void>((resolve, reject) => bridge.invoke('getBrandWCPayRequest', parameters, (result) => {
    const message = typeof result.err_msg === 'string' ? result.err_msg : '';
    if (message === 'get_brand_wcpay_request:ok') return resolve();
    if (message === 'get_brand_wcpay_request:cancel') {
      return reject(new ProductionApiError('已取消微信支付，订单仍保留在待付款状态', 409, 'PAYMENT_CANCELLED'));
    }
    reject(new ProductionApiError('微信支付未完成，请稍后从待付款订单重试', 502, 'WECHAT_PAYMENT_FAILED'));
  }));
}

async function wechatBridge(): Promise<WechatJsapiBridge> {
  if (typeof window === 'undefined') throw new ProductionApiError('微信支付只能在微信客户端中完成', 409, 'WECHAT_CLIENT_REQUIRED');
  const target = window as WechatWindow;
  if (target.WeixinJSBridge) return target.WeixinJSBridge;
  return new Promise<WechatJsapiBridge>((resolve, reject) => {
    const ready = () => {
      window.clearTimeout(timeout);
      window.removeEventListener('WeixinJSBridgeReady', ready);
      const bridge = (window as WechatWindow).WeixinJSBridge;
      if (bridge) resolve(bridge);
      else reject(new ProductionApiError('微信支付组件未就绪，请重新打开页面', 503, 'WECHAT_BRIDGE_UNAVAILABLE'));
    };
    const timeout = window.setTimeout(() => {
      window.removeEventListener('WeixinJSBridgeReady', ready);
      reject(new ProductionApiError('微信支付组件连接超时，请重新打开页面', 504, 'WECHAT_BRIDGE_TIMEOUT'));
    }, 10_000);
    window.addEventListener('WeixinJSBridgeReady', ready, { once: true });
  });
}
