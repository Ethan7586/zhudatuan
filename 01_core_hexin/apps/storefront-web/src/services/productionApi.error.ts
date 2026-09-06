import { ApiError } from '@shop/sdk/error';

const ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  AUTHENTICATION_REQUIRED: '登录会话已失效，请重新登录',
  MOBILE_ASSURANCE_REQUIRED: '手机尚未验证，暂不能提交订单',
  CSRF_TOKEN_INVALID: '安全会话已更新，请刷新页面后重试',
  LISTING_NOT_PURCHASABLE: '该商品当前不可购买',
  CHECKOUT_VERSION_CONFLICT: '购物车已发生变化，请刷新后重试',
  PRICE_QUOTE_EXPIRED: '结算报价已过期，请重新提交',
  QUOTE_EXPIRED_OR_CONFLICT: '结算信息已变化，请重新提交',
  WECHAT_IDENTITY_REQUIRED: '该订单需要微信支付，但当前账号未绑定微信',
  CHALLENGE_INVALID: '验证码不正确、已过期或已经使用',
  STEP_UP_DESTINATION_MISSING: '当前账号没有可验证的手机号',
});

export class ProductionApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ProductionApiError';
  }
}

export function productionError(cause: unknown): ProductionApiError {
  if (cause instanceof ProductionApiError) return cause;
  if (cause instanceof ApiError) {
    return new ProductionApiError(ERROR_MESSAGES[cause.code] ?? cause.message ?? cause.code, cause.status, cause.code, cause.requestId);
  }
  if (cause instanceof TypeError && /failed to fetch|load failed|network request failed/i.test(cause.message)) {
    return new ProductionApiError('商城网络连接失败，请刷新页面后重试', 0, 'NETWORK_OR_CLIENT_ERROR');
  }
  const message = cause instanceof Error ? cause.message : '平台 API 请求失败';
  return new ProductionApiError(message, 0, 'NETWORK_OR_CLIENT_ERROR');
}
