/** Turns an authoritative product availability reason into a customer-facing message. */
export function purchaseAvailabilityMessage(reason: string | undefined): string {
  switch (reason) {
    case 'PURCHASE_LIMIT_EXCEEDED':
      return '已达到该商品的限购上限';
    case 'OUT_OF_STOCK':
      return '该商品暂时缺货，补货后可加入购物车';
    case 'PRICE_UNAVAILABLE':
      return '该商品暂未配置可用价格';
    case 'LISTING_UNAVAILABLE':
      return '该商品当前未上架';
    case 'LOGIN_REQUIRED':
      return '登录后才能确认会员价与加入购物车';
    default:
      return '该商品暂不可购买，请稍后重试';
  }
}

/**
 * The anonymous catalogue intentionally marks every item LOGIN_REQUIRED. Once
 * identity has authenticated the member, that stale presentation flag must not
 * disable the cart control: the cart command remains the server-side authority
 * for membership, price, stock, and purchase-limit validation.
 */
export function canAttemptAuthenticatedCartAdd(
  purchasable: boolean | undefined,
  purchaseReason: string | undefined,
  authenticated: boolean,
): boolean {
  return authenticated && purchasable === false && purchaseReason === 'LOGIN_REQUIRED';
}
