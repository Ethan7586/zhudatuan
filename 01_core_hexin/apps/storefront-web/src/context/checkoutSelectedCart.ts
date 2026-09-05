import type { CartItem, DeliveryAddress, UserProfile } from '../types';
import { productionApi } from '../services/productionApi';

export interface CheckoutResult {
  selectedItems: CartItem[];
  orderId: string;
  paymentId: string;
  paymentState: 'captured' | 'authorizing' | 'reconciling';
}

export async function checkoutSelectedCartRequest(cart: CartItem[], addresses: DeliveryAddress[], user: UserProfile): Promise<CheckoutResult> {
  const selectedItems = cart.filter((item) => item.selected);
  const address = addresses.find((item) => item.isDefault) ?? addresses[0];
  if (!selectedItems.length) throw new Error('请先选择需要结算的商品');
  if (!address) throw new Error('请先设置有效的收货地址');
  if (!user.phoneVerified || !user.paymentEligible) {
    throw new Error('手机尚未验证，短信服务开通并完成验证后才能提交订单和付款');
  }
  if (selectedItems.some((item) => !item.product.skuId)) {
    throw new Error('购物车中的商品信息已失效，请从在线商品目录重新加入');
  }

  const checkout = await productionApi.checkout({
    addressId: address.id,
    items: selectedItems.map((item) => ({ listingId: item.product.id, quantity: item.quantity })),
    idempotencyKey: `checkout-${crypto.randomUUID()}`,
  });
  return { selectedItems, ...checkout };
}
