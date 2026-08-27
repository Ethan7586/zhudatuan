import type { CartItem, DeliveryAddress, UserProfile } from '../types';
import { productionApi } from '../services/productionApi';

export interface CheckoutResult {
  selectedItems: CartItem[];
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

  const payableCents = selectedItems.reduce((sum, item) => sum + Math.round(item.product.priceWelfare * 100) * item.quantity, 0);
  const welfareCents = Math.min(payableCents, Math.round(user.welfareBalance * 100));
  const mealCents = Math.min(payableCents - welfareCents, Math.round(user.mealBalance * 100));
  if (welfareCents + mealCents !== payableCents) {
    throw new Error('福利账户余额不足，外部支付接口尚未接入');
  }

  const requestId = crypto.randomUUID();
  const created = await productionApi.createOrder(
    {
      items: selectedItems.map((item) => ({
        skuId: item.product.skuId!,
        quantity: item.quantity,
      })),
      recipient: {
        name: address.name,
        mobile: address.phone,
        province: address.province,
        city: address.city,
        district: address.district,
        address: address.detail,
      },
    },
    `order-${requestId}`
  );
  await productionApi.payWithInternalAccounts(created.order.id, { welfareCents, mealCents }, `payment-${requestId}`);
  return { selectedItems };
}
