// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { presentProduct } from '../infrastructure/ProductMapper';
import { productFixture } from '../../../../test/Fixture';
import { ProductCard } from './ProductCard';

afterEach(cleanup);

describe('ProductCard', () => {
  it('opens the product identity and adds the selected listing SKU', () => {
    const open = vi.fn();
    const add = vi.fn();
    const product = presentProduct(productFixture());
    render(<ProductCard product={product} open={open} add={add} />);

    fireEvent.click(screen.getByRole('button', { name: /^测试商品/ }));
    fireEvent.click(screen.getByRole('button', { name: '将测试商品加入购物车' }));
    expect(open).toHaveBeenCalledWith('product-one');
    expect(add).toHaveBeenCalledWith(product);
  });

  it('explains every blocking dependency and prevents a false purchase action', () => {
    const product = presentProduct(productFixture({ saleability: { state: 'blocked', reasons: ['qualification_failed', 'price_unavailable', 'inventory_unavailable'] }, qualification: { eligible: false, policyVersion: 8 }, stock: 0 }));
    render(<ProductCard product={product} open={vi.fn()} add={vi.fn()} />);

    expect(screen.getByText(/当前商品不满足经营资格要求/)).toBeTruthy();
    expect(screen.getByText(/当前报价暂不可用/)).toBeTruthy();
    expect(screen.getByText(/库存状态暂不可用/)).toBeTruthy();
    expect(screen.getByText('报价暂不可用')).toBeTruthy();
    expect(screen.getByRole('button', { name: '将测试商品加入购物车' }).hasAttribute('disabled')).toBe(true);
  });
});
