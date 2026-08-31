import type { PaymentAction } from '../model/PaymentAction';
import { textValue } from '../../../shared/format/Text';

type PaymentBridge = Readonly<{ invoke(name: string, parameters: Readonly<Record<string, string>>, callback: (result: Readonly<Record<string, unknown>>) => void): void }>;

export class ContinuePayment {
  execute(action: PaymentAction): Promise<void> {
    const bridge = (window as typeof window & { WeixinJSBridge?: PaymentBridge }).WeixinJSBridge;
    if (!bridge) return Promise.reject(new Error('PAYMENT_CLIENT_UNAVAILABLE'));
    return new Promise((resolve, reject) =>
      bridge.invoke('getBrandWCPayRequest', action.parameters, (result) => {
        const message = textValue(result.err_msg ?? result.errMsg);
        if (message.endsWith(':ok')) resolve();
        else reject(new Error(message.includes('cancel') ? 'PAYMENT_CANCELLED' : 'PAYMENT_CLIENT_FAILED'));
      })
    );
  }
}
