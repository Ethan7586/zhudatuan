import type { CartItem, DeliveryAddress, UserProfile } from '../types';
import { createSecureId } from '@shop/sdk/context';
import { loadProductionApi } from '../services/productionApiLoader';

export class PaymentPhoneVerificationRequired extends Error {
  constructor() {
    super('手机尚未验证，请先完成支付前验证');
    this.name = 'PaymentPhoneVerificationRequired';
  }
}

export interface CheckoutResult {
  selectedItems: CartItem[];
  orderId: string;
  paymentId: string;
  paymentState: 'captured' | 'authorizing' | 'reconciling';
}

export function checkoutDeliveryAddress(addresses: readonly DeliveryAddress[]): DeliveryAddress | undefined {
  return addresses.find((item) => item.isDefault) ?? addresses[0];
}

export async function checkoutSelectedCartRequest(cart: CartItem[], addresses: DeliveryAddress[], user: UserProfile): Promise<CheckoutResult> {
  const selectedItems = cart.filter((item) => item.selected);
  const address = checkoutDeliveryAddress(addresses);
  if (!selectedItems.length) throw new Error('请先选择需要结算的商品');
  if (!address) throw new Error('请先设置有效的收货地址');
  if (!user.phoneVerified || !user.paymentEligible) {
    throw new PaymentPhoneVerificationRequired();
  }
  if (selectedItems.some((item) => !item.product.skuId)) {
    throw new Error('购物车中的商品信息已失效，请从在线商品目录重新加入');
  }

  const productionApi = await loadProductionApi();
  const checkout = await productionApi.checkout({
    addressId: address.id,
    items: selectedItems.map((item) => ({ listingId: item.product.id, quantity: item.quantity })),
    idempotencyKey: `checkout-${createSecureId()}`,
  });
  return { selectedItems, ...checkout };
}
