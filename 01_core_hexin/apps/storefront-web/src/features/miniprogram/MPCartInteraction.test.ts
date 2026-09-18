// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem } from '../../types';

const state = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('../../components/mobile/WeChatCapsule', () => ({ WeChatCapsule: () => null }));
vi.mock('../../context/MallContext', () => ({ useMall: () => state.current }));

import { MPCartPage } from './MPCartPage';

const cartItem = (stock = 8, purchasable = true): CartItem => ({
  id: 'listing:one',
  productId: 'listing:one',
  quantity: 1,
  selected: true,
  selectedSpec: {},
  product: {
    id: 'listing:one', skuId: 'sku:one', title: '员工福利礼盒', subtitle: '', images: ['/product.jpg'],
    priceMall: 80, priceMarket: 100, priceWelfare: 80, categoryId: 'category:one', categoryName: '福利品', brand: '', tags: [],
    supplierId: 'supplier:one', supplierName: '供应商', supplierType: 'third_party', itemType: 'physical', allowedAccounts: ['welfare'],
    stock, salesCount: 0, rating: 5, reviewCount: 0, deliverySla: '次日达', purchasable,
  },
});

beforeEach(() => {
  const item = cartItem();
  state.current = {
    addAddress: vi.fn(),
    addToCart: vi.fn(() => true),
    addresses: [],
    cart: [item],
    checkoutSelectedCart: vi.fn(),
    currentMall: { mallName: '福福网' },
    isSubmittingOrder: false,
    removeCartItem: vi.fn(),
    setMpPage: vi.fn(),
    showToast: vi.fn(),
    toggleCartItemSelected: vi.fn(),
    toggleSelectAllCart: vi.fn(),
    triggerPendingFeature: vi.fn(),
    updateCartQuantity: vi.fn((_id: string, quantity: number) => {
      if (quantity === 0) state.current.cart = [];
      return true;
    }),
    user: { welfareBalance: 500 },
  };
});

afterEach(() => cleanup());

describe('cart quantity and inventory interaction', () => {
  it('offers an undo path instead of making a quantity-one row disappear without feedback', () => {
    const { getByRole } = render(React.createElement(MPCartPage));
    fireEvent.click(getByRole('button', { name: '减少员工福利礼盒数量' }));
    fireEvent.click(getByRole('button', { name: '撤销刚才的移除' }));
    expect(state.current.addToCart).toHaveBeenCalledWith(expect.objectContaining({ id: 'listing:one' }), 1, {});
  });

  it('excludes an unavailable row from settlement while keeping the rest of the cart usable', () => {
    state.current.cart = [cartItem(0, false)];
    const { getByRole } = render(React.createElement(MPCartPage));
    expect(getByRole('button', { name: '结算 (0)' }).hasAttribute('disabled')).toBe(true);
    expect(getByRole('button', { name: '取消选择：员工福利礼盒' }).hasAttribute('disabled')).toBe(true);
  });
});
