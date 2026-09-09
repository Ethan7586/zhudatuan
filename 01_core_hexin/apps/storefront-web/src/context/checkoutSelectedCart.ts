import type { CartItem, DeliveryAddress, UserProfile } from '../types';
import { createSecureId } from '@shop/sdk/context';
import type { CanonicalPaymentProgress } from '../services/canonicalCheckout';
import type { WechatJsapiPaymentOutcome } from '../services/wechatJsapiPayment';
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
  wechatOutcome?: WechatJsapiPaymentOutcome;
}

export interface PreparedCheckoutSelection {
  readonly selectedItems: CartItem[];
  readonly address: DeliveryAddress;
  readonly items: readonly Readonly<{ listingId: string; quantity: number }>[];
  readonly amountMinor: number;
}

interface CheckoutSelectedCartOptions {
  readonly idempotencyKey?: string;
  readonly onPaymentProgress?: (progress: CanonicalPaymentProgress) => void | Promise<void>;
}

export function checkoutDeliveryAddress(addresses: readonly DeliveryAddress[]): DeliveryAddress | undefined {
  return addresses.find((item) => item.isDefault) ?? addresses[0];
}

export function prepareCheckoutSelection(cart: CartItem[], addresses: DeliveryAddress[], user: UserProfile): PreparedCheckoutSelection {
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
  const items = selectedItems.map((item) => ({ listingId: item.product.id, quantity: item.quantity }));
  const amountMinor = selectedItems.reduce((sum, item) => sum + Math.round(item.product.priceMall * 100) * item.quantity, 0);
  return Object.freeze({ selectedItems, address, items: Object.freeze(items), amountMinor });
}

export async function checkoutSelectedCartRequest(
  cart: CartItem[],
  addresses: DeliveryAddress[],
  user: UserProfile,
  options: CheckoutSelectedCartOptions = {},
): Promise<CheckoutResult> {
  const selection = prepareCheckoutSelection(cart, addresses, user);
  const productionApi = await loadProductionApi();
  const checkout = await productionApi.checkout({
    addressId: selection.address.id,
    items: selection.items,
    idempotencyKey: options.idempotencyKey ?? `checkout-${createSecureId()}`,
    onPaymentProgress: options.onPaymentProgress,
  });
  return { selectedItems: selection.selectedItems, ...checkout };
}
