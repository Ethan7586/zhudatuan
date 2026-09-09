// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddressRegionPicker } from './AddressRegionPicker';
import type { RegionSelection } from './regionSelection';

const INITIAL_VALUE: RegionSelection = {
  province: '浙江省',
  city: '杭州市',
  district: '西湖区',
};

async function waitForReady(container: HTMLElement) {
  await waitFor(() => {
    expect(container.querySelector('[data-region-picker-state]')?.getAttribute('data-region-picker-state')).toBe('ready');
  });
}

afterEach(() => {
  cleanup();
});

describe('address region picker', () => {
  it('paints a complete loading sheet synchronously, then exposes all three wheels', async () => {
    const startedAt = performance.now();
    const { container, getByRole } = render(React.createElement(AddressRegionPicker, {
      value: INITIAL_VALUE,
      onCancel: vi.fn(),
      onConfirm: vi.fn(),
    }));
    const shellMs = performance.now() - startedAt;
    const dialog = getByRole('dialog', { name: '选择省市区' });

    expect(shellMs).toBeLessThan(100);
    expect(dialog.getAttribute('data-region-picker-state')).toBe('loading');
    expect(container.querySelectorAll('[data-region-wheel-skeleton]')).toHaveLength(3);
    expect(getByRole('button', { name: '取消' })).toBeTruthy();
    expect(getByRole('button', { name: '完成地区选择' }).hasAttribute('disabled')).toBe(true);

    await waitForReady(container);
    expect(getByRole('listbox', { name: '省选择' })).toBeTruthy();
    expect(getByRole('listbox', { name: '市选择' })).toBeTruthy();
    expect(getByRole('listbox', { name: '区选择' })).toBeTruthy();
    expect(container.querySelector('[data-region-selection-frame]')?.className).toContain('top-1/2');
    expect(container.querySelector('[data-region-selection-frame]')?.className).toContain('-translate-y-1/2');
  });

  it('keeps the supplied value untouched when a changed draft is cancelled', async () => {
    const original = { ...INITIAL_VALUE };
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { container, getByRole } = render(React.createElement(AddressRegionPicker, {
      value: original,
      onCancel,
      onConfirm,
    }));
    await waitForReady(container);

    fireEvent.click(getByRole('option', { name: '湖北省' }));
    fireEvent.click(getByRole('button', { name: '取消' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(original).toEqual(INITIAL_VALUE);
  });

  it('commits the linked draft exactly once on completion', async () => {
    const onConfirm = vi.fn();
    const { container, getByRole } = render(React.createElement(AddressRegionPicker, {
      value: INITIAL_VALUE,
      onCancel: vi.fn(),
      onConfirm,
    }));
    await waitForReady(container);

    fireEvent.click(getByRole('option', { name: '湖北省' }));
    fireEvent.click(getByRole('option', { name: '襄阳市' }));
    fireEvent.click(getByRole('button', { name: '完成地区选择' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      province: '湖北省',
      city: '襄阳市',
    }));
  });

  it('publishes the centered option in animation frames without manual smooth scrolling', async () => {
    const { container, getByRole } = render(React.createElement(AddressRegionPicker, {
      value: { province: '北京市', city: '北京市', district: '东城区' },
      onCancel: vi.fn(),
      onConfirm: vi.fn(),
    }));
    await waitForReady(container);
    const provinceWheel = getByRole('listbox', { name: '省选择' });
    const scrollTo = vi.fn();
    provinceWheel.scrollTo = scrollTo;
    provinceWheel.scrollTop = 88;

    fireEvent.scroll(provinceWheel);
    await act(async () => {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    });

    await waitFor(() => {
      expect(within(provinceWheel).getAllByRole('option')[2]?.getAttribute('aria-selected')).toBe('true');
    });
    expect(provinceWheel.scrollTop).toBe(88);
    expect(provinceWheel.className).toContain('snap-proximity');
    expect(provinceWheel.className).not.toContain('snap-mandatory');
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('disables backdrop blur for low-capability devices', async () => {
    const previous = Object.getOwnPropertyDescriptor(navigator, 'hardwareConcurrency');
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 2 });
    try {
      const { container } = render(React.createElement(AddressRegionPicker, {
        value: INITIAL_VALUE,
        onCancel: vi.fn(),
        onConfirm: vi.fn(),
      }));
      expect(container.querySelector('[data-economy-effects]')?.getAttribute('data-economy-effects')).toBe('true');
      await waitForReady(container);
    } finally {
      if (previous) Object.defineProperty(navigator, 'hardwareConcurrency', previous);
      else delete (navigator as unknown as { hardwareConcurrency?: number }).hardwareConcurrency;
    }
  });
});
