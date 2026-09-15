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
