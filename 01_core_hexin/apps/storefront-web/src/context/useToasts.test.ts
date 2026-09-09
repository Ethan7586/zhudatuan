// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useToasts } from './useToasts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('cart toast channel', () => {
  it('replaces rapid cart notices instead of stacking them', () => {
    let current!: ReturnType<typeof useToasts>;
    function Probe() {
      current = useToasts();
      return null;
    }
    render(React.createElement(Probe));

    act(() => {
      current.showToast('已加入购物车', 'success', { channel: 'cart' });
      current.showToast('已加入 3 件', 'success', { channel: 'cart' });
      current.showToast('已加入 5 件', 'success', { channel: 'cart' });
    });

    expect(current.toasts).toEqual([expect.objectContaining({ id: 'toast_cart', text: '已加入 5 件' })]);
  });

  it('naturally removes the compact notice after 1.2 seconds', () => {
    vi.useFakeTimers();
    let current!: ReturnType<typeof useToasts>;
    function Probe() {
      current = useToasts();
      return null;
    }
    render(React.createElement(Probe));
    act(() => current.showToast('已加入购物车', 'success', { channel: 'cart' }));
    act(() => vi.advanceTimersByTime(1_200));
    expect(current.toasts).toEqual([]);
  });
});
