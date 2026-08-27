import type { WechatPayConfig } from './Config';
import { isWechatPayOutTradeNo, WechatPayProtocolError } from './Models';
import { requestWechatPayNoContent, type WechatPayClientOptions } from './Transport';

export interface WechatPayCloseResult {
  providerRequestId: string | null;
}

export async function closeWechatPayTransaction(config: WechatPayConfig, outTradeNo: string, options: WechatPayClientOptions = {}): Promise<WechatPayCloseResult> {
  if (!isWechatPayOutTradeNo(outTradeNo)) {
    throw new WechatPayProtocolError('WECHAT_PAY_OUT_TRADE_NO_INVALID');
  }
  const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}/close`;
  const body = JSON.stringify({ mchid: config.mchId });
  return requestWechatPayNoContent(config, path, body, options);
}
