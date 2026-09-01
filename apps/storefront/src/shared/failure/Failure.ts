import { ApiError } from '@shop/sdk/error';

const ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  AUTHENTICATION_REQUIRED: '登录会话已失效，请重新登录',
  MOBILE_ASSURANCE_REQUIRED: '手机尚未验证，暂不能提交订单',
  STEPUP_REQUIRED: '为保护账户和收货信息，请先完成二次验证',
  STEPUP_DESTINATION_MISSING: '当前账号未绑定手机号，请先在安全中心完成绑定',
  STEPUP_ASSURANCE_INVALID: '身份验证未达到安全要求，请重新获取验证码',
  VALIDATION_FAILED: '提交信息格式不正确，请刷新商品与购物车后重试',
  CHECKOUT_REJECTED: '部分商品暂不满足结算条件，请返回购物车重新选择',
  INTERNAL_ERROR: '系统暂时未完成本次操作，请稍后重试',
  SCOPE_DENIED: '当前账号无权执行这项操作，请切换到正确的商城后重试',
  RESOURCE_NOT_FOUND: '未找到可操作的数据，可能已被更新或移除',
  CSRF_TOKEN_INVALID: '安全会话已更新，请刷新页面后重试',
  LISTING_NOT_PURCHASABLE: '该商品当前不可购买',
  CHECKOUT_VERSION_CONFLICT: '购物车已发生变化，请刷新后重试',
  PRICE_QUOTE_EXPIRED: '结算报价已过期，请重新提交',
  QUOTE_EXPIRED_OR_CONFLICT: '结算信息已变化，请重新提交',
  WECHAT_IDENTITY_REQUIRED: '该订单需要微信支付，但当前账号未绑定微信',
});

export class ProductionApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId?: string
  ) {
    super(message);
    this.name = 'ProductionApiError';
  }
}

export function productionError(cause: unknown): ProductionApiError {
  if (cause instanceof ProductionApiError) return cause;
  if (cause instanceof ApiError) return new ProductionApiError(ERROR_MESSAGES[cause.code] ?? cause.message ?? cause.code, cause.status, cause.code, cause.requestId);
  if (cause instanceof Error) {
    const code = cause.message.split(':', 1)[0] ?? cause.message;
    const message = ERROR_MESSAGES[code];
    if (message) return new ProductionApiError(message, 0, code);
  }
  return new ProductionApiError(cause instanceof Error ? cause.message : '平台 API 请求失败', 0, 'NETWORK_OR_CLIENT_ERROR');
}
