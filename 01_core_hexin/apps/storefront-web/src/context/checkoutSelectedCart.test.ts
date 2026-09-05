import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOCK_ADDRESSES, MOCK_USER } from '../mock/base';
import type { CartItem } from '../types';
import { checkoutSelectedCartRequest, PaymentPhoneVerificationRequired } from './checkoutSelectedCart';

const contextRoot = dirname(fileURLToPath(import.meta.url));

afterEach(() => vi.unstubAllGlobals());

describe('checkout identity assurance', () => {
  it('explains the phone restriction before any order request leaves the browser', async () => {
    const network = vi.fn();
    vi.stubGlobal('fetch', network);
    const cart: CartItem[] = [
      {
        id: 'cart-one',
        productId: 'product-one',
        product: {
          id: 'product-one',
          skuId: 'sku-one',
          title: '测试商品',
          subtitle: '',
          images: [],
          priceMarket: 10,
          priceMall: 10,
          priceWelfare: 10,
          categoryId: 'category',
          categoryName: '测试',
          brand: '测试',
          tags: [],
          supplierId: 'supplier-one',
          supplierName: '测试供应商',
          supplierType: 'self_operated',
          itemType: 'physical',
          allowedAccounts: ['welfare'],
          stock: 10,
          salesCount: 0,
          rating: 5,
          reviewCount: 0,
          deliverySla: '次日达',
        },
        quantity: 1,
        selectedSpec: {},
        selected: true,
      },
    ];

    const checkout = checkoutSelectedCartRequest(cart, MOCK_ADDRESSES, {
        ...MOCK_USER,
        assuranceLevel: 'account',
        phoneVerified: false,
        paymentEligible: false,
      });

    await expect(checkout).rejects.toBeInstanceOf(PaymentPhoneVerificationRequired);
    expect(network).not.toHaveBeenCalled();
  });

  it('routes payment verification through the existing OTP modal before retrying checkout', () => {
    const context = readFileSync(resolve(contextRoot, 'MallContext.tsx'), 'utf8');

    expect(context).toContain('error instanceof PaymentPhoneVerificationRequired');
    expect(context).toContain('<PaymentPhoneVerificationModal');
    expect(context).toContain('await submitSelectedCart(verifiedUser)');
  });

  it('routes a missing delivery address into the real server-backed address flow', () => {
    const cartPage = readFileSync(resolve(contextRoot, '../features/miniprogram/MPCartPage.tsx'), 'utf8');
    const addressPage = readFileSync(resolve(contextRoot, '../features/miniprogram/MPAddressPage.tsx'), 'utf8');
    const profilePage = readFileSync(resolve(contextRoot, '../features/miniprogram/MPProfilePage.tsx'), 'utf8');

    expect(cartPage).toContain("if (addresses.length === 0)");
    expect(cartPage).toContain("setMpPage('address')");
    expect(addressPage).toContain('const saved = await addAddress');
    expect(addressPage).toContain("if (saved) setMpPage('cart')");
    expect(profilePage).toContain("onClick={() => setMpPage('address')}");
  });
});
