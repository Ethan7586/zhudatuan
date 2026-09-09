// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstantCartAddButton } from './InstantCartAddButton';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('instant cart add button', () => {
  it('shows local success without waiting for the server promise', () => {
    const onAdd = vi.fn(() => true);
    const { getByRole } = render(React.createElement(InstantCartAddButton, {
      ariaLabel: '加入购物车：福利商品',
      className: 'h-8 w-8',
      listingId: 'listing:one',
      onAdd,
    }));
    const button = getByRole('button', { name: '加入购物车：福利商品' });

    fireEvent.pointerDown(button);
    fireEvent.click(button);

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('data-cart-add-state')).toBe('added');
  });

  it('does not show success when the cart rejects the action', () => {
    const { getByRole } = render(React.createElement(InstantCartAddButton, {
      ariaLabel: '加入购物车：缺货商品',
      className: 'h-8 w-8',
      listingId: 'listing:none',
      onAdd: () => false,
    }));
    const button = getByRole('button', { name: '加入购物车：缺货商品' });
    fireEvent.click(button);
    expect(button.getAttribute('data-cart-add-state')).toBe('idle');
  });

  it('exposes reduced-motion-safe transform classes without changing button size', () => {
    const { getByRole } = render(React.createElement(InstantCartAddButton, {
      ariaLabel: '加入购物车：福利商品',
      className: 'h-8 w-8',
      listingId: 'listing:one',
      onAdd: () => true,
    }));
    const button = getByRole('button');
    expect(button.className).toContain('motion-reduce:transform-none');
    expect(button.className).toContain('transition-[transform,background-color,box-shadow]');
  });
});
