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

    expect(current.toasts).toEqual([expect.objectContaining({ id: 'cart', text: '已加入 5 件' })]);
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

  it('replaces the previous message in every channel', () => {
    let current!: ReturnType<typeof useToasts>;
    function Probe() {
      current = useToasts();
      return null;
    }
    render(React.createElement(Probe));

    act(() => {
      current.showToast('第一次', 'info');
      current.showToast('第二次', 'error');
    });

    expect(current.toasts).toEqual([
      expect.objectContaining({ id: 'default', text: '第二次', type: 'error' }),
    ]);
  });

  it('keeps unrelated channels independent', () => {
    let current!: ReturnType<typeof useToasts>;
    function Probe() {
      current = useToasts();
      return null;
    }
    render(React.createElement(Probe));
    act(() => {
      current.showToast('购物车', 'success', { channel: 'cart' });
      current.showToast('默认提示', 'info');
    });
    expect(current.toasts.map((toast) => toast.channel)).toEqual(['cart', 'default']);
  });

  it('does not let an old timer remove a replacement', () => {
    vi.useFakeTimers();
    let current!: ReturnType<typeof useToasts>;
    function Probe() {
      current = useToasts();
      return null;
    }
    render(React.createElement(Probe));
    act(() => current.showToast('旧提示', 'info', { durationMs: 100 }));
    act(() => vi.advanceTimersByTime(50));
    act(() => current.showToast('新提示', 'success', { durationMs: 200 }));
    act(() => vi.advanceTimersByTime(60));
    expect(current.toasts).toEqual([expect.objectContaining({ text: '新提示' })]);
    act(() => vi.advanceTimersByTime(140));
    expect(current.toasts).toEqual([]);
  });
});
